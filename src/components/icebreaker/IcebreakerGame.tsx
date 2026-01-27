import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IcebreakerCard } from './IcebreakerCard';
import { LevelSelector } from './LevelSelector';
import { useIcebreakerGame } from '@/hooks/useIcebreakerGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, SkipForward, Sparkles, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IcebreakerGame: React.FC = () => {
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
    createGame,
    drawCard,
    passCard,
    changeLevel,
    resetDeck,
  } = useIcebreakerGame();

  // Auto-create game on mount
  useEffect(() => {
    if (!gameId) {
      createGame();
    }
  }, [gameId, createGame]);

  const handleCardTap = () => {
    if (!isFlipped && !isDrawing) {
      drawCard();
    }
  };

  if (isLoading) {
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

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          破冰遊戲
        </h1>
        {roomCode && (
          <p className="text-sm text-muted-foreground">
            房間代碼: <span className="font-mono font-bold">{roomCode}</span>
          </p>
        )}
      </div>

      {/* Level Selector */}
      <LevelSelector
        currentLevel={currentLevel}
        onLevelChange={(level) => {
          changeLevel(level);
          if (isFlipped) {
            // Draw new card at new level
            drawCard(level);
          }
        }}
        disabled={isDrawing}
      />

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
            level={currentLevel}
            isFlipped={isFlipped}
            isDrawing={isDrawing}
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
                剩餘 <span className="font-bold text-foreground">{cardsRemaining}</span> 張
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

      {/* Action Buttons */}
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
          {isFlipped ? '下一題' : '抽牌'}
        </Button>
      </div>

      {/* Reset Button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetDeck}
          disabled={isDrawing}
          className="text-muted-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置牌堆
        </Button>
      </div>
    </div>
  );
};
