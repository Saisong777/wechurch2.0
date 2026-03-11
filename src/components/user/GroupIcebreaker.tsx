import React from 'react';
import { TurnBasedCardGame } from '@/components/icebreaker/TurnBasedCardGame';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GroupIcebreakerProps {
  sessionId: string;
  groupNumber: number;
  currentUserId?: string;
  initialLevel?: 'L1' | 'L2' | 'L3';
  onComplete: () => void;
  onSkip?: () => void;
}

export const GroupIcebreaker: React.FC<GroupIcebreakerProps> = ({
  sessionId,
  groupNumber,
  currentUserId,
  initialLevel = 'L1',
  onComplete,
  onSkip,
}) => {
  // If no currentUserId, show error state
  if (!currentUserId) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            無法載入使用者資訊
          </p>
          <Button
            variant="gold"
            size="lg"
            className="mt-4"
            onClick={onComplete}
          >
            繼續
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Turn-Based Card Game */}
      <TurnBasedCardGame
        sessionId={sessionId}
        groupNumber={groupNumber}
        currentUserId={currentUserId}
        initialLevel={initialLevel}
        onComplete={onComplete}
      />

      {/* Skip Option */}
      {onSkip && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground"
          >
            跳過真心話，直接開始查經
          </Button>
        </div>
      )}
    </div>
  );
};
