import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { withRetry, staggeredStart } from '@/lib/retry-utils';

type CardLevel = 'L1' | 'L2' | 'L3';
type GameMode = 'standalone' | 'session';

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
  timerDuration: number;
  timerStartedAt: string | null;
  timerRunning: boolean;
}

const MAX_PASSES = 2;

interface UseIcebreakerGameOptions {
  sessionId?: string;
  groupNumber?: number;
  roomCode?: string;
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

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCardContent = async (cardId: string): Promise<{ content: string; contentEn: string | null } | null> => {
    try {
      const response = await fetch(`/api/icebreaker/cards/${cardId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return { content: data.contentText, contentEn: data.contentTextEn };
    } catch {
      return null;
    }
  };

  const pollGameState = useCallback(async () => {
    if (!state.gameId || state.mode === 'standalone') return;

    try {
      const response = await fetch(`/api/icebreaker/games/${state.roomCode}`);
      if (!response.ok) return;
      
      const updated = await response.json();
      
      setState(prev => ({
        ...prev,
        timerDuration: updated.timerDuration ?? prev.timerDuration,
        timerStartedAt: updated.timerStartedAt,
        timerRunning: updated.timerRunning ?? false,
      }));
      
      if (updated.currentCardId && updated.currentCardId !== state.currentCard?.id) {
        const cardData = await fetchCardContent(updated.currentCardId);
        if (cardData) {
          setState(prev => ({
            ...prev,
            currentCard: {
              id: updated.currentCardId,
              content: cardData.content,
              contentEn: cardData.contentEn,
              level: updated.currentLevel,
            },
            currentLevel: updated.currentLevel,
            passCount: updated.passCount || 0,
            isFlipped: true,
            isDrawing: false,
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to poll game state:', err);
    }
  }, [state.gameId, state.mode, state.roomCode, state.currentCard?.id]);

  useEffect(() => {
    if (!state.gameId || state.mode === 'standalone') return;

    pollingRef.current = setInterval(pollGameState, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [state.gameId, state.mode, pollGameState]);

  const createGame = useCallback(async (mode: GameMode = 'standalone') => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await staggeredStart(1000);
      
      const data = await withRetry(async () => {
        const response = await fetch('/api/icebreaker/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            currentLevel: 'L1',
            bibleStudySessionId: options.sessionId || null,
            groupNumber: options.groupNumber || null,
          }),
        });
        if (!response.ok) throw new Error('Failed to create game');
        return response.json();
      }, { maxRetries: 2, baseDelayMs: 500 });

      setState(prev => ({
        ...prev,
        gameId: data.id,
        roomCode: data.roomCode,
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

  const joinGame = useCallback(async (roomCode: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`/api/icebreaker/games/${roomCode.toUpperCase()}`);
      
      if (!response.ok) {
        toast.error('找不到此遊戲房間');
        setState(prev => ({ ...prev, isLoading: false }));
        return null;
      }

      const data = await response.json();

      let currentCard = null;
      if (data.currentCardId) {
        const cardData = await fetchCardContent(data.currentCardId);
        if (cardData) {
          currentCard = {
            id: data.currentCardId,
            content: cardData.content,
            contentEn: cardData.contentEn,
            level: data.currentLevel as CardLevel,
          };
        }
      }

      setState(prev => ({
        ...prev,
        gameId: data.id,
        roomCode: data.roomCode,
        isLoading: false,
        currentLevel: (data.currentLevel as CardLevel) || 'L1',
        passCount: data.passCount || 0,
        currentCard,
        isFlipped: !!currentCard,
        mode: data.mode as GameMode,
        isHost: false,
        sessionId: data.bibleStudySessionId,
        groupNumber: data.groupNumber,
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

  const findSessionGame = useCallback(async () => {
    if (!options.sessionId || !options.groupNumber) return null;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await staggeredStart(1000);
      
      const data = await withRetry(async () => {
        const response = await fetch(
          `/api/icebreaker/session-game?sessionId=${options.sessionId}&groupNumber=${options.groupNumber}`
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to find session game');
        return response.json();
      }, { maxRetries: 2, baseDelayMs: 500 });

      if (data) {
        let currentCard = null;
        if (data.currentCardId) {
          const cardData = await fetchCardContent(data.currentCardId);
          if (cardData) {
            currentCard = {
              id: data.currentCardId,
              content: cardData.content,
              contentEn: cardData.contentEn,
              level: data.currentLevel as CardLevel,
            };
          }
        }

        setState(prev => ({
          ...prev,
          gameId: data.id,
          roomCode: data.roomCode,
          isLoading: false,
          currentLevel: (data.currentLevel as CardLevel) || 'L1',
          passCount: data.passCount || 0,
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

  const drawCard = useCallback(async (level?: CardLevel) => {
    if (!state.gameId) {
      toast.error('請先開始遊戲');
      return;
    }

    setState(prev => ({ ...prev, isDrawing: true, isFlipped: false }));

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const result = await withRetry(async () => {
        const response = await fetch(`/api/icebreaker/games/${state.gameId}/draw-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: level || state.currentLevel }),
        });
        if (!response.ok) throw new Error('Failed to draw card');
        return response.json();
      }, { maxRetries: 2, baseDelayMs: 300 });
      
      if (!result?.cardId) {
        toast.info(result?.cardContent || '這個等級的牌已經抽完了！');
        setState(prev => ({ ...prev, isDrawing: false }));
        return;
      }

      const cardData = await fetchCardContent(result.cardId);

      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentCard: {
            id: result.cardId,
            content: result.cardContent,
            contentEn: cardData?.contentEn || null,
            level: result.cardLevel as CardLevel,
          },
          cardsRemaining: result.cardsRemaining,
          currentLevel: result.cardLevel as CardLevel,
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

  const passCard = useCallback(() => {
    if (state.passCount >= MAX_PASSES) {
      toast.error('PASS 次數已用完！');
      return;
    }

    setState(prev => ({
      ...prev,
      passCount: prev.passCount + 1,
    }));

    if (state.gameId) {
      fetch(`/api/icebreaker/games/${state.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCount: state.passCount + 1 }),
      }).catch(console.warn);
    }

    toast.info(`PASS！剩餘 ${MAX_PASSES - state.passCount - 1} 次`);
    drawCard();
  }, [state.gameId, state.passCount, drawCard]);

  const changeLevel = useCallback((level: CardLevel) => {
    setState(prev => ({ ...prev, currentLevel: level }));
  }, []);

  const resetDeck = useCallback(async () => {
    if (!state.gameId) return;

    try {
      const response = await fetch(`/api/icebreaker/games/${state.gameId}/reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reset deck');

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

  const syncTimer = useCallback(async (duration: number, startedAt: string | null, running: boolean) => {
    if (!state.gameId) return;

    setState(prev => ({
      ...prev,
      timerDuration: duration,
      timerStartedAt: startedAt,
      timerRunning: running,
    }));

    try {
      await fetch(`/api/icebreaker/games/${state.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timerDuration: duration,
          timerStartedAt: startedAt,
          timerRunning: running,
        }),
      });
    } catch (error) {
      console.error('Failed to sync timer:', error);
    }
  }, [state.gameId]);

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
