import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IcebreakerCard } from './IcebreakerCard';
import { LevelSelector } from './LevelSelector';
import { GameLobby } from './GameLobby';
import { GameTimer } from './GameTimer';
import { useIcebreakerGame } from '@/hooks/useIcebreakerGame';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RotateCcw, SkipForward, Sparkles, Dumbbell, Users, Copy, Check, Languages, Volume2, VolumeX, Timer, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface IcebreakerGameProps {
  sessionId?: string;
  groupNumber?: number;
  autoStart?: boolean; // For session mode - skip lobby
}

export const IcebreakerGame: React.FC<IcebreakerGameProps> = ({
  sessionId,
  groupNumber,
  autoStart = false,
}) => {
  const {
    gameId,
    roomCode,
    currentCard,
    cardsRemaining,
    currentLevel,
    isFlipped,
    isLoading,
    isDrawing,
    remainingPasses,
    maxPasses,
    mode,
    isHost,
    timerDuration,
    timerStartedAt,
    timerRunning,
    createGame,
    joinGame,
    findSessionGame,
    drawCard,
    passCard,
    changeLevel,
    resetDeck,
    syncTimer,
  } = useIcebreakerGame({ sessionId, groupNumber });

  const [showLobby, setShowLobby] = useState(!autoStart);
  const [copied, setCopied] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTimer, setShowTimer] = useState(false);
  const [autoPassEnabled, setAutoPassEnabled] = useState(true);
  const [isStartingSharing, setIsStartingSharing] = useState(false);

  const { playFlipSound, playDrawSound } = useSoundEffects({ enabled: soundEnabled });

  // Determine if we're in sync mode (group mode)
  const isSyncMode = mode === 'session';

  // Auto-start for session mode
  useEffect(() => {
    const init = async () => {
      if (autoStart && sessionId && groupNumber) {
        // Try to find existing game for this group
        const existingGame = await findSessionGame();
        if (!existingGame) {
          // Create new game for this group
          await createGame('session');
        }
        setShowLobby(false);
      }
    };
    init();
  }, [autoStart, sessionId, groupNumber, findSessionGame, createGame]);

  const handleCreateGame = async () => {
    const game = await createGame('standalone');
    if (game) {
      setShowLobby(false);
    }
  };

  const handleJoinGame = async (code: string) => {
    const game = await joinGame(code);
    if (game) {
      setShowLobby(false);
    }
  };

  const handleCardTap = useCallback(() => {
    // In group mode, only host can draw
    if (mode === 'session' && !isHost) {
      toast.info('等待主持人抽牌...');
      return;
    }
    if (!isFlipped && !isDrawing) {
      playFlipSound();
      drawCard();
    }
  }, [mode, isHost, isFlipped, isDrawing, playFlipSound, drawCard]);

  // Play sound when card is successfully drawn
  useEffect(() => {
    if (isFlipped && currentCard) {
      playDrawSound();
    }
  }, [isFlipped, currentCard?.id, playDrawSound]);

  const handleTimerEnd = useCallback(() => {
    toast.info(showEnglish ? "Time's up! Move to the next question." : '時間到！請進入下一題。');
    
    // Auto-pass: draw next card when timer ends (only for host)
    if (autoPassEnabled && (mode === 'standalone' || isHost) && isFlipped) {
      // Small delay before auto-drawing next card
      setTimeout(() => {
        drawCard();
      }, 1500);
    }
  }, [showEnglish, autoPassEnabled, mode, isHost, isFlipped, drawCard]);

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success('房間代碼已複製！');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Start sharing round - enables sharing mode for this game
  const startSharingRound = async () => {
    if (!gameId || isStartingSharing) return;
    
    setIsStartingSharing(true);
    try {
      const response = await fetch(`/api/icebreaker/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sharingMode: true,
          sharedMemberIds: [],
        }),
      });

      if (!response.ok) throw new Error('Failed to start sharing');
      toast.success(showEnglish ? 'Sharing round started!' : '分享環節已開始！');
    } catch (error) {
      console.error('[IcebreakerGame] Failed to start sharing:', error);
      toast.error(showEnglish ? 'Failed to start sharing' : '開啟分享環節失敗');
    } finally {
      setIsStartingSharing(false);
    }
  };

  if (isLoading && !gameId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full gradient-gold flex items-center justify-center animate-pulse">
            <Dumbbell className="w-8 h-8 text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground">準備遊戲中...</p>
        </div>
      </div>
    );
  }

  if (showLobby && !gameId) {
    return (
      <GameLobby
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          {showEnglish ? 'Icebreaker' : '破冰遊戲'}
        </h1>
        
        {/* Room Code Display */}
        {roomCode && (
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-sm font-mono px-3 py-1">
              {showEnglish ? 'Room' : '房間'}: {roomCode}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={copyRoomCode}
            >
              {copied ? (
                <Check className="w-4 h-4 text-accent" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        {/* Mode indicator */}
        {mode === 'session' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>
              {showEnglish 
                ? `Group Mode ${isHost ? '(Host)' : '(Syncing)'}`
                : `小組模式 ${isHost ? '(主持人)' : '(同步中)'}`
              }
            </span>
          </div>
        )}
      </div>

      {/* Language & Sound Toggles */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {/* Language Toggle */}
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="language-toggle" className="text-sm text-muted-foreground cursor-pointer">
            中文
          </Label>
          <Switch
            id="language-toggle"
            checked={showEnglish}
            onCheckedChange={setShowEnglish}
          />
          <Label htmlFor="language-toggle" className="text-sm text-muted-foreground cursor-pointer">
            English
          </Label>
        </div>

        {/* Sound Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-muted-foreground"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </Button>

        {/* Timer Toggle - only for host */}
        {(mode === 'standalone' || isHost) && (
          <Button
            variant={showTimer ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowTimer(!showTimer)}
            className="text-muted-foreground"
          >
            <Timer className="w-4 h-4 mr-1" />
            {showEnglish ? 'Timer' : '計時'}
          </Button>
        )}
      </div>

      {/* Timer - show when enabled */}
      {showTimer && (
        <div className="space-y-2">
          <GameTimer
            isHost={mode === 'standalone' || isHost}
            showEnglish={showEnglish}
            onTimerEnd={handleTimerEnd}
            syncedDuration={isSyncMode ? timerDuration : undefined}
            syncedStartedAt={isSyncMode ? timerStartedAt : undefined}
            syncedRunning={isSyncMode ? timerRunning : undefined}
            onTimerSync={isSyncMode ? syncTimer : undefined}
          />
          
          {/* Auto-pass toggle - only for host */}
          {(mode === 'standalone' || isHost) && (
            <div className="flex items-center justify-center gap-2">
              <Switch
                id="auto-pass-toggle"
                checked={autoPassEnabled}
                onCheckedChange={setAutoPassEnabled}
              />
              <Label htmlFor="auto-pass-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {showEnglish ? 'Auto next on timeout' : '時間到自動下一題'}
              </Label>
            </div>
          )}
        </div>
      )}

      {/* Level Selector - only for host in group mode */}
      {(mode === 'standalone' || isHost) && (
        <LevelSelector
          currentLevel={currentLevel}
          onLevelChange={(level) => {
            changeLevel(level);
            if (isFlipped) {
              drawCard(level);
            }
          }}
          disabled={isDrawing}
        />
      )}

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={gameId}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <IcebreakerCard
            content={currentCard?.content || null}
            contentEn={currentCard?.contentEn || null}
            level={currentLevel}
            isFlipped={isFlipped}
            isDrawing={isDrawing}
            showEnglish={showEnglish}
            onTap={handleCardTap}
          />
        </motion.div>
      </AnimatePresence>

      {/* Game Info */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {showEnglish ? (
                  <><span className="font-bold text-foreground">{cardsRemaining}</span> remaining</>
                ) : (
                  <>剩餘 <span className="font-bold text-foreground">{cardsRemaining}</span> 張</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">PASS:</span>
              {Array.from({ length: maxPasses }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs',
                    i < remainingPasses
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground/30'
                  )}
                >
                  ✓
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - only for host or standalone */}
      {(mode === 'standalone' || isHost) && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14"
            onClick={passCard}
            disabled={isDrawing || remainingPasses === 0 || !isFlipped}
          >
            <SkipForward className="w-5 h-5 mr-2" />
            PASS
            {remainingPasses > 0 && (
              <span className="ml-1 text-xs opacity-70">({remainingPasses})</span>
            )}
          </Button>

          <Button
            variant="gold"
            size="lg"
            className="flex-1 h-14"
            onClick={() => drawCard()}
            disabled={isDrawing}
          >
            {isFlipped 
              ? (showEnglish ? 'Next' : '下一題') 
              : (showEnglish ? 'Draw' : '抽牌')
            }
          </Button>
        </div>
      )}

      {/* Non-host message */}
      {mode === 'session' && !isHost && (
        <div className="text-center py-4">
          <p className="text-muted-foreground">
            {showEnglish 
              ? 'Waiting for the host to draw the next card...'
              : '等待主持人抽取下一張牌...'
            }
          </p>
        </div>
      )}

      {/* Reset Button - only for host or standalone */}
      {(mode === 'standalone' || isHost) && (
        <div className="flex justify-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDeck}
            disabled={isDrawing}
            className="text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {showEnglish ? 'Reset Deck' : '重置牌堆'}
          </Button>
          
          {/* Start Sharing Round - only for session mode host */}
          {mode === 'session' && isHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={startSharingRound}
              disabled={isStartingSharing}
              className="text-primary border-primary/30"
            >
              {isStartingSharing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4 mr-2" />
              )}
              {showEnglish ? 'Start Sharing' : '開啟分享環節'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
