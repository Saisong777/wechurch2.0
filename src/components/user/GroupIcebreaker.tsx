import React, { useState, useEffect, useCallback } from 'react';
import { IcebreakerGame } from '@/components/icebreaker/IcebreakerGame';
import { SharingRound } from '@/components/icebreaker/SharingRound';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GroupIcebreakerProps {
  sessionId: string;
  groupNumber: number;
  currentUserId?: string;
  onComplete: () => void;
  onSkip?: () => void;
}

type IcebreakerPhase = 'game' | 'sharing';

export const GroupIcebreaker: React.FC<GroupIcebreakerProps> = ({
  sessionId,
  groupNumber,
  currentUserId,
  onComplete,
  onSkip,
}) => {
  const [phase, setPhase] = useState<IcebreakerPhase>('game');
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if sharing mode is enabled for this group's game
  const checkSharingMode = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('icebreaker_games')
        .select('id, sharing_mode')
        .eq('bible_study_session_id', sessionId)
        .eq('group_number', groupNumber)
        .eq('mode', 'session')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.sharing_mode) {
        setSharingEnabled(true);
        setPhase('sharing');
      }
    } catch (error) {
      console.error('[GroupIcebreaker] Failed to check sharing mode:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, groupNumber]);

  useEffect(() => {
    checkSharingMode();
  }, [checkSharingMode]);

  // Subscribe to sharing mode changes
  useEffect(() => {
    const channel = supabase
      .channel(`group-icebreaker-${sessionId}-${groupNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'icebreaker_games',
          filter: `bible_study_session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.group_number === groupNumber && newData.sharing_mode) {
            setSharingEnabled(true);
            setPhase('sharing');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, groupNumber]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Group Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          {phase === 'game' ? (
            <Sparkles className="w-4 h-4" />
          ) : (
            <MessageCircle className="w-4 h-4" />
          )}
          <span className="font-medium">
            第 {groupNumber} 組 {phase === 'game' ? '破冰時間' : '分享時間'}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {phase === 'game' 
            ? '和組員們一起玩破冰遊戲，互相認識！'
            : '輪流分享你的破冰回答，完成後打勾！'}
        </p>
      </div>

      {/* Phase Content */}
      {phase === 'game' ? (
        <>
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
        </>
      ) : (
        // Sharing Phase
        currentUserId ? (
          <SharingRound
            sessionId={sessionId}
            groupNumber={groupNumber}
            currentUserId={currentUserId}
            onComplete={onComplete}
          />
        ) : (
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
        )
      )}
    </div>
  );
};
