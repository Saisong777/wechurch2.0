import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type CardLevel = Database['public']['Enums']['card_level'];

interface GameState {
  gameId: string | null;
  roomCode: string | null;
  currentCard: {
    id: string;
    content: string;
    level: CardLevel;
  } | null;
  cardsRemaining: number;
  currentLevel: CardLevel;
  passCount: number;
  isFlipped: boolean;
  isLoading: boolean;
  isDrawing: boolean;
}

const MAX_PASSES = 2;

export function useIcebreakerGame() {
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
  });

  // Create a new game
  const createGame = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase
        .from('icebreaker_games')
        .insert({
          mode: 'standalone',
          current_level: 'L1',
        })
        .select('id, room_code')
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        gameId: data.id,
        roomCode: data.room_code,
        isLoading: false,
        currentLevel: 'L1',
        passCount: 0,
        currentCard: null,
        isFlipped: false,
      }));

      return data;
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error('無法建立遊戲');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, []);

  // Draw a card
  const drawCard = useCallback(async (level?: CardLevel) => {
    if (!state.gameId) {
      toast.error('請先開始遊戲');
      return;
    }

    setState(prev => ({ ...prev, isDrawing: true, isFlipped: false }));

    // Add a small delay for the flip-back animation
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const { data, error } = await supabase.rpc('draw_next_card', {
        p_game_id: state.gameId,
        p_level: level || state.currentLevel,
      });

      if (error) throw error;

      const result = data?.[0];
      
      if (!result?.card_id) {
        toast.info(result?.card_content || '這個等級的牌已經抽完了！');
        setState(prev => ({ ...prev, isDrawing: false }));
        return;
      }

      // Trigger flip animation after a brief delay
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentCard: {
            id: result.card_id,
            content: result.card_content,
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
      const { data, error } = await supabase.rpc('reset_icebreaker_deck', {
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

  // Get remaining passes
  const remainingPasses = MAX_PASSES - state.passCount;

  return {
    ...state,
    remainingPasses,
    maxPasses: MAX_PASSES,
    createGame,
    drawCard,
    passCard,
    changeLevel,
    resetDeck,
  };
}
