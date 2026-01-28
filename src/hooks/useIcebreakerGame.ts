import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { withRetry, staggeredStart } from '@/lib/retry-utils';

type CardLevel = Database['public']['Enums']['card_level'];
type GameMode = Database['public']['Enums']['game_mode'];

interface GameState {
  gameId: string | null;
  roomCode: string | null;
  currentCard: {
    id: string;
    content: string;
    contentEn: string | null;
    level: CardLevel;
  } | null;
  cardsRemaining: number;
  currentLevel: CardLevel;
  passCount: number;
  isFlipped: boolean;
  isLoading: boolean;
  isDrawing: boolean;
  mode: GameMode;
  isHost: boolean;
  sessionId: string | null;
  groupNumber: number | null;
  // Timer sync state
  timerDuration: number;
  timerStartedAt: string | null;
  timerRunning: boolean;
}

const MAX_PASSES = 2;

interface UseIcebreakerGameOptions {
  sessionId?: string;
  groupNumber?: number;
  roomCode?: string; // For joining existing game
}

export function useIcebreakerGame(options: UseIcebreakerGameOptions = {}) {
  const [state, setState] = useState<GameState>({
    gameId: null,
    roomCode: null,
    currentCard: null,
    cardsRemaining: 0,
    currentLevel: 'L1',
    passCount: 0,
    isFlipped: false,
    isLoading: false,
    isDrawing: false,
    mode: 'standalone',
    isHost: true,
    sessionId: options.sessionId || null,
    groupNumber: options.groupNumber || null,
    timerDuration: 60,
    timerStartedAt: null,
    timerRunning: false,
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to real-time updates for group mode
  useEffect(() => {
    if (!state.gameId || state.mode === 'standalone') return;

    const channel = supabase
      .channel(`icebreaker-game-${state.gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'icebreaker_games',
          filter: `id=eq.${state.gameId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          
          // Sync timer state for all participants
          setState(prev => ({
            ...prev,
            timerDuration: updated.timer_duration ?? prev.timerDuration,
            timerStartedAt: updated.timer_started_at,
            timerRunning: updated.timer_running ?? false,
          }));
          
          // Only update card if we're not the one who triggered the change
          if (updated.current_card_id && updated.current_card_id !== state.currentCard?.id) {
            // Fetch the card content
            fetchCardContent(updated.current_card_id).then((cardData) => {
              if (cardData) {
                setState(prev => ({
                  ...prev,
                  currentCard: {
                    id: updated.current_card_id,
                    content: cardData.content,
                    contentEn: cardData.contentEn,
                    level: updated.current_level,
                  },
                  currentLevel: updated.current_level,
                  passCount: updated.pass_count || 0,
                  isFlipped: true,
                  isDrawing: false,
                }));
              }
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.gameId, state.mode, state.currentCard?.id]);

  // Fetch card content by ID (including English)
  const fetchCardContent = async (cardId: string): Promise<{ content: string; contentEn: string | null } | null> => {
    const { data, error } = await supabase
      .from('card_questions')
      .select('content_text, content_text_en')
      .eq('id', cardId)
      .single();

    if (error || !data) return null;
    return { content: data.content_text, contentEn: data.content_text_en };
  };

  // Create a new game with retry logic
  const createGame = useCallback(async (mode: GameMode = 'standalone') => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Stagger game creation to prevent race conditions
      await staggeredStart(1000);
      
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('icebreaker_games')
          .insert({
            mode,
            current_level: 'L1',
            bible_study_session_id: options.sessionId || null,
            group_number: options.groupNumber || null,
          })
          .select('id, room_code')
          .single();

        if (error) throw error;
        return data;
      }, { maxRetries: 2, baseDelayMs: 500 });

      setState(prev => ({
        ...prev,
        gameId: data.id,
        roomCode: data.room_code,
        isLoading: false,
        currentLevel: 'L1',
        passCount: 0,
        currentCard: null,
        isFlipped: false,
        mode,
        isHost: true,
      }));

      return data;
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error('無法建立遊戲');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [options.sessionId, options.groupNumber]);

  // Join an existing game by room code
  const joinGame = useCallback(async (roomCode: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase
        .from('icebreaker_games')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single();

      if (error || !data) {
        toast.error('找不到此遊戲房間');
        setState(prev => ({ ...prev, isLoading: false }));
        return null;
      }

      // Fetch current card content if exists
      let currentCard = null;
      if (data.current_card_id) {
        const cardData = await fetchCardContent(data.current_card_id);
        if (cardData) {
          currentCard = {
            id: data.current_card_id,
            content: cardData.content,
            contentEn: cardData.contentEn,
            level: data.current_level as CardLevel,
          };
        }
      }

      setState(prev => ({
        ...prev,
        gameId: data.id,
        roomCode: data.room_code,
        isLoading: false,
        currentLevel: (data.current_level as CardLevel) || 'L1',
        passCount: data.pass_count || 0,
        currentCard,
        isFlipped: !!currentCard,
        mode: data.mode as GameMode,
        isHost: false,
        sessionId: data.bible_study_session_id,
        groupNumber: data.group_number,
      }));

      toast.success('已加入遊戲！');
      return data;
    } catch (error) {
      console.error('Failed to join game:', error);
      toast.error('加入遊戲失敗');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, []);

  // Find existing game for session/group with retry
  const findSessionGame = useCallback(async () => {
    if (!options.sessionId || !options.groupNumber) return null;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Stagger initial search to prevent thundering herd
      await staggeredStart(1000);
      
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('icebreaker_games')
          .select('*')
          .eq('bible_study_session_id', options.sessionId)
          .eq('group_number', options.groupNumber)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data;
      }, { maxRetries: 2, baseDelayMs: 500 });

      if (data) {
        // Found existing game - join it
        let currentCard = null;
        if (data.current_card_id) {
          const cardData = await fetchCardContent(data.current_card_id);
          if (cardData) {
            currentCard = {
              id: data.current_card_id,
              content: cardData.content,
              contentEn: cardData.contentEn,
              level: data.current_level as CardLevel,
            };
          }
        }

        setState(prev => ({
          ...prev,
          gameId: data.id,
          roomCode: data.room_code,
          isLoading: false,
          currentLevel: (data.current_level as CardLevel) || 'L1',
          passCount: data.pass_count || 0,
          currentCard,
          isFlipped: !!currentCard,
          mode: 'session',
          isHost: false,
        }));

        return data;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    } catch (error) {
      console.error('Failed to find session game:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [options.sessionId, options.groupNumber]);

  // Draw a card with retry
  const drawCard = useCallback(async (level?: CardLevel) => {
    if (!state.gameId) {
      toast.error('請先開始遊戲');
      return;
    }

    setState(prev => ({ ...prev, isDrawing: true, isFlipped: false }));

    // Add a small delay for the flip-back animation
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase.rpc('draw_next_card', {
          p_game_id: state.gameId,
          p_level: level || state.currentLevel,
        });

        if (error) throw error;
        return data?.[0];
      }, { maxRetries: 2, baseDelayMs: 300 });
      
      if (!result?.card_id) {
        toast.info(result?.card_content || '這個等級的牌已經抽完了！');
        setState(prev => ({ ...prev, isDrawing: false }));
        return;
      }

      // Fetch English content for the card
      const cardData = await fetchCardContent(result.card_id);

      // Trigger flip animation after a brief delay
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentCard: {
            id: result.card_id,
            content: result.card_content,
            contentEn: cardData?.contentEn || null,
            level: result.card_level as CardLevel,
          },
          cardsRemaining: result.cards_remaining,
          currentLevel: result.card_level as CardLevel,
          isDrawing: false,
          isFlipped: true,
        }));
      }, 100);

    } catch (error) {
      console.error('Failed to draw card:', error);
      toast.error('抽牌失敗，請重試');
      setState(prev => ({ ...prev, isDrawing: false }));
    }
  }, [state.gameId, state.currentLevel]);

  // Pass current card
  const passCard = useCallback(() => {
    if (state.passCount >= MAX_PASSES) {
      toast.error('PASS 次數已用完！');
      return;
    }

    setState(prev => ({
      ...prev,
      passCount: prev.passCount + 1,
    }));

    // Update pass count in database
    if (state.gameId) {
      supabase
        .from('icebreaker_games')
        .update({ pass_count: state.passCount + 1 })
        .eq('id', state.gameId)
        .then();
    }

    toast.info(`PASS！剩餘 ${MAX_PASSES - state.passCount - 1} 次`);
    drawCard();
  }, [state.gameId, state.passCount, drawCard]);

  // Change level
  const changeLevel = useCallback((level: CardLevel) => {
    setState(prev => ({ ...prev, currentLevel: level }));
  }, []);

  // Reset deck
  const resetDeck = useCallback(async () => {
    if (!state.gameId) return;

    try {
      const { error } = await supabase.rpc('reset_icebreaker_deck', {
        p_game_id: state.gameId,
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        currentCard: null,
        passCount: 0,
        isFlipped: false,
      }));

      toast.success('牌堆已重置！');
    } catch (error) {
      console.error('Failed to reset deck:', error);
      toast.error('重置失敗');
    }
  }, [state.gameId]);

  // Sync timer state to database
  const syncTimer = useCallback(async (duration: number, startedAt: string | null, running: boolean) => {
    if (!state.gameId) return;

    // Update local state immediately
    setState(prev => ({
      ...prev,
      timerDuration: duration,
      timerStartedAt: startedAt,
      timerRunning: running,
    }));

    // Sync to database for other participants
    try {
      await supabase
        .from('icebreaker_games')
        .update({
          timer_duration: duration,
          timer_started_at: startedAt,
          timer_running: running,
        })
        .eq('id', state.gameId);
    } catch (error) {
      console.error('Failed to sync timer:', error);
    }
  }, [state.gameId]);

  // Get remaining passes
  const remainingPasses = MAX_PASSES - state.passCount;

  return {
    ...state,
    remainingPasses,
    maxPasses: MAX_PASSES,
    createGame,
    joinGame,
    findSessionGame,
    drawCard,
    passCard,
    changeLevel,
    resetDeck,
    syncTimer,
  };
}
