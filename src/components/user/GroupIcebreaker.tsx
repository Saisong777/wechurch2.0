import React from 'react';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface GroupIcebreakerProps {
  sessionId: string;
  groupNumber: number;
  onComplete: () => void;
  onSkip?: () => void;
}

export const GroupIcebreaker: React.FC<GroupIcebreakerProps> = ({
  sessionId,
  groupNumber,
  onComplete,
  onSkip,
}) => {
  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Group Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">第 {groupNumber} 組 破冰時間</span>
        </div>
        <p className="text-muted-foreground text-sm">
          和組員們一起玩破冰遊戲，互相認識！
        </p>
      </div>

      {/* Game Component */}
      <IcebreakerGame
        sessionId={sessionId}
        groupNumber={groupNumber}
        autoStart
      />

      {/* Complete Button */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {onSkip && (
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                onClick={onSkip}
              >
                跳過破冰
              </Button>
            )}
            <Button
              variant="gold"
              size="lg"
              className="flex-1"
              onClick={onComplete}
            >
              完成破冰，開始健身
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
