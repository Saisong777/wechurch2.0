import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IcebreakerCard } from './IcebreakerCard';
import { LevelSelector } from './LevelSelector';
import { GameLobby } from './GameLobby';
import { useIcebreakerGame } from '@/hooks/useIcebreakerGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RotateCcw, SkipForward, Sparkles, Dumbbell, Users, Copy, Check, Languages } from 'lucide-react';
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
    createGame,
    joinGame,
    findSessionGame,
    drawCard,
    passCard,
    changeLevel,
    resetDeck,
  } = useIcebreakerGame({ sessionId, groupNumber });

  const [showLobby, setShowLobby] = useState(!autoStart);
  const [copied, setCopied] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

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

  const handleCardTap = () => {
    // In group mode, only host can draw
    if (mode === 'session' && !isHost) {
      toast.info('等待主持人抽牌...');
      return;
    }
    if (!isFlipped && !isDrawing) {
      drawCard();
    }
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success('房間代碼已複製！');
      setTimeout(() => setCopied(false), 2000);
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

      {/* Language Toggle */}
      <div className="flex items-center justify-center gap-2">
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
        <div className="flex justify-center">
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
        </div>
      )}
    </div>
  );
};
