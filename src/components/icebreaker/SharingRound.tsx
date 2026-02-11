import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getPollingInterval } from '@/lib/retry-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle, Circle, Users, Loader2, MessageCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchGroupMembers } from '@/lib/api-helpers';
import type { User } from '@/types/bible-study';

interface SharingRoundProps {
  sessionId: string;
  groupNumber: number;
  currentUserId: string;
  onComplete: () => void;
}

interface SharingState {
  gameId: string | null;
  sharingMode: boolean;
  sharedMemberIds: string[];
}

export const SharingRound: React.FC<SharingRoundProps> = ({
  sessionId,
  groupNumber,
  currentUserId,
  onComplete,
}) => {
  const [members, setMembers] = useState<User[]>([]);
  const [sharingState, setSharingState] = useState<SharingState>({
    gameId: null,
    sharingMode: false,
    sharedMemberIds: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);

  // Fetch group members
  const loadMembers = useCallback(async () => {
    try {
      const groupMembers = await fetchGroupMembers(sessionId, groupNumber);
      setMembers(groupMembers);
    } catch (error) {
      console.error('[SharingRound] Failed to load members:', error);
    }
  }, [sessionId, groupNumber]);

  // Fetch or create icebreaker game for sharing state
  const loadSharingState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/groups/${groupNumber}/sharing-state`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSharingState({
            gameId: data.id,
            sharingMode: data.sharing_mode || false,
            sharedMemberIds: data.shared_member_ids || [],
          });
        }
      }
    } catch (error) {
      console.error('[SharingRound] Failed to load sharing state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, groupNumber]);

  useEffect(() => {
    loadMembers();
    loadSharingState();
  }, [loadMembers, loadSharingState]);

  // Poll for updates instead of realtime
  useEffect(() => {
    if (!sharingState.gameId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/groups/${groupNumber}/sharing-state`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            const newSharedIds = data.shared_member_ids || [];
            setSharingState(prev => ({
              ...prev,
              sharingMode: data.sharing_mode || false,
              sharedMemberIds: newSharedIds,
            }));

            if (newSharedIds.length >= members.length && members.length > 0) {
              toast.success('全員分享完成！準備進入查經筆記', { duration: 2000 });
              setTimeout(onComplete, 1500);
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error('[SharingRound] Poll error:', error);
      }
    }, getPollingInterval(5000));

    return () => clearInterval(pollInterval);
  }, [sharingState.gameId, sessionId, groupNumber, members.length, onComplete]);

  // Mark self as shared
  const markAsShared = async () => {
    if (!sharingState.gameId || isMarking) return;
    
    setIsMarking(true);
    try {
      const newSharedIds = [...sharingState.sharedMemberIds];
      if (!newSharedIds.includes(currentUserId)) {
        newSharedIds.push(currentUserId);
      }

      const res = await fetch(`/api/icebreaker-games/${sharingState.gameId}/shared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_member_ids: newSharedIds }),
      });

      if (!res.ok) throw new Error('Update failed');

      setSharingState(prev => ({
        ...prev,
        sharedMemberIds: newSharedIds,
      }));

      toast.success('已標記為分享完成！');
    } catch (error) {
      console.error('[SharingRound] Failed to mark as shared:', error);
      toast.error('操作失敗，請重試');
    } finally {
      setIsMarking(false);
    }
  };

  // Undo marking
  const undoShared = async () => {
    if (!sharingState.gameId || isMarking) return;
    
    setIsMarking(true);
    try {
      const newSharedIds = sharingState.sharedMemberIds.filter(id => id !== currentUserId);

      const res = await fetch(`/api/icebreaker-games/${sharingState.gameId}/shared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_member_ids: newSharedIds }),
      });

      if (!res.ok) throw new Error('Update failed');

      setSharingState(prev => ({
        ...prev,
        sharedMemberIds: newSharedIds,
      }));

      toast.success('已取消標記');
    } catch (error) {
      console.error('[SharingRound] Failed to undo:', error);
      toast.error('操作失敗');
    } finally {
      setIsMarking(false);
    }
  };

  const sharedCount = sharingState.sharedMemberIds.length;
  const totalCount = members.length;
  const progress = totalCount > 0 ? (sharedCount / totalCount) * 100 : 0;
  const hasShared = sharingState.sharedMemberIds.includes(currentUserId);
  const allComplete = sharedCount >= totalCount && totalCount > 0;

  // Sort members: not shared first, then shared
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aShared = sharingState.sharedMemberIds.includes(a.id);
      const bShared = sharingState.sharedMemberIds.includes(b.id);
      if (aShared === bShared) return 0;
      return aShared ? 1 : -1;
    });
  }, [members, sharingState.sharedMemberIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sharingState.gameId || !sharingState.sharingMode) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-8 text-center">
          <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            等待主持人開啟分享環節...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="font-medium">輪流分享</span>
            </div>
            <Badge variant="outline" className="text-sm">
              {sharedCount} / {totalCount} 完成
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Member List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            組員分享進度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedMembers.map((member) => {
            const memberHasShared = sharingState.sharedMemberIds.includes(member.id);
            const isCurrentUser = member.id === currentUserId;
            
            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                  memberHasShared
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-muted/30 border-border',
                  isCurrentUser && 'ring-2 ring-primary ring-offset-1'
                )}
              >
                {memberHasShared ? (
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {member.name}
                    {isCurrentUser && (
                      <span className="text-primary ml-1">(您)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {memberHasShared ? '已分享' : '等待分享'}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Button */}
      {!allComplete && (
        <div className="space-y-3">
          {!hasShared ? (
            <Button
              variant="gold"
              size="lg"
              className="w-full h-14 text-lg"
              onClick={markAsShared}
              disabled={isMarking}
            >
              {isMarking ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              我分享完了
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={undoShared}
                disabled={isMarking}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                取消打勾
              </Button>
              <div className="flex-1 flex items-center justify-center text-accent">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span>已完成分享</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Complete */}
      {allComplete && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="py-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-accent mb-3" />
            <p className="font-medium text-lg">全員分享完成！</p>
            <p className="text-sm text-muted-foreground mt-1">
              即將進入查經筆記...
            </p>
            <Button
              variant="gold"
              size="lg"
              className="mt-4"
              onClick={onComplete}
            >
              開始查經
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
