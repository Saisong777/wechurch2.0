import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useRealtimeSecure, ConnectionState } from '@/hooks/useRealtimeSecure';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { Clock, Users, MapPin, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { withRetry } from '@/lib/retry-utils';
interface WaitingRoomProps {
  onGroupingStarted: () => void;
  onSessionEnded?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onGroupingStarted, onSessionEnded }) => {
  const { currentUser, users, currentSession, setCurrentSession, updateUser, setCurrentUser } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevConnectionStateRef = useRef<ConnectionState | null>(null);

  // NOTE: participant_names view intentionally returns email as empty/null for privacy.
  // We must NEVER overwrite currentUser.email with an empty value, because email is
  // still required for later submission verification.
  const mergeIntoCurrentUser = (incoming: any) => {
    if (!currentUser) {
      setCurrentUser(incoming);
      return;
    }

    setCurrentUser({
      ...currentUser,
      ...incoming,
      email: currentUser.email, // preserve
    });
  };

  // Listen for session status updates and participant group assignments
  // Using secure realtime hook with aggressive mobile sync features
  const { forceRefresh, connectionState, lastSyncTime } = useRealtimeSecure({
    sessionId: currentSession?.id || null,
    currentUserId: currentUser?.id || null,
    onSessionUpdated: (sessionUpdate) => {
      if (sessionUpdate.status && currentSession) {
        setCurrentSession({ ...currentSession, ...sessionUpdate } as any);
      }
      if (sessionUpdate.status === 'completed' && onSessionEnded) {
        onSessionEnded();
      }
    },
    onParticipantUpdated: (user) => {
      updateUser(user);
      // Critical: also update currentUser so downstream pages (GroupReveal/Verification)
      // can see the assigned groupNumber.
      if (user.id === currentUser?.id) {
        mergeIntoCurrentUser(user);
      }
      // If this is the current user and they got a group number, trigger the transition
      if (user.id === currentUser?.id && user.groupNumber) {
        onGroupingStarted();
      }
    },
    // Handle force-refetched user data when session status changes
    onCurrentUserRefetched: (user) => {
      console.log('[WaitingRoom] User refetched:', user.name, 'groupNumber:', user.groupNumber);
      mergeIntoCurrentUser(user);
      updateUser(user);
      // If the user now has a group number, trigger the transition immediately
      if (user.groupNumber) {
        onGroupingStarted();
      }
    },
    // Direct callback when grouping is detected (backup for missed events)
    onGroupingDetected: () => {
      console.log('[WaitingRoom] Grouping detected via heartbeat!');
      onGroupingStarted();
    },
  });

  // Toast notifications for connection state changes
  useEffect(() => {
    const prevState = prevConnectionStateRef.current;
    
    // Skip initial render
    if (prevState === null) {
      prevConnectionStateRef.current = connectionState;
      return;
    }
    
    // Only show toast when state actually changes
    if (prevState !== connectionState) {
      if (connectionState === 'disconnected') {
        toast({
          title: '⚠️ 連線已中斷',
          description: '請檢查網路連線，或點擊「手動刷新」按鈕更新狀態',
          variant: 'destructive',
        });
      } else if (connectionState === 'connected' && (prevState === 'disconnected' || prevState === 'reconnecting')) {
        toast({
          title: '✅ 已重新連線',
          description: '即時同步已恢復正常',
        });
      } else if (connectionState === 'reconnecting') {
        toast({
          title: '🔄 重新連線中...',
          description: '正在嘗試恢復連線',
        });
      }
      
      prevConnectionStateRef.current = connectionState;
    }
  }, [connectionState]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Use retry with backoff for manual refresh to handle transient failures
      await withRetry(
        () => forceRefresh(),
        { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000 }
      );
    } catch (error) {
      console.error('[WaitingRoom] Manual refresh failed after retries:', error);
      toast({
        title: '⚠️ 刷新失敗',
        description: '請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const isRemote = currentUser?.location && currentUser.location !== 'On-site';

  return (
    <div className="w-full max-w-md mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Connection Status Indicator */}
      <div className="flex justify-center">
        <ConnectionStatus 
          state={connectionState} 
          lastSyncTime={lastSyncTime || undefined} 
        />
      </div>

      <Card variant="highlight" className="text-center">
        <CardContent className="py-10 sm:py-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-secondary/30 rounded-full blur-xl animate-pulse-soft" />
            <div className="relative w-24 h-24 sm:w-20 sm:h-20 rounded-full gradient-gold flex items-center justify-center glow-gold">
              <Clock className="w-12 h-12 sm:w-10 sm:h-10 text-secondary-foreground animate-pulse" />
            </div>
          </div>
          
          <h2 className="font-serif text-2xl sm:text-2xl font-bold text-foreground mb-2">
            等待主持人開始...
          </h2>
          <p className="text-base sm:text-base text-muted-foreground">
            Waiting for the host to start grouping
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 sm:py-6 px-4 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5 sm:w-5 sm:h-5" />
              <span className="font-medium text-base sm:text-sm">已加入成員</span>
            </div>
            <span className="text-xl sm:text-lg font-bold text-primary">{users.length} 人</span>
          </div>

          {currentSession?.verseReference && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">今日經文</p>
              <p className="font-serif text-lg sm:text-lg font-medium text-foreground">
                {currentSession.verseReference}
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">您已登記為</p>
            <p className="font-medium text-lg sm:text-base text-foreground mt-1">
              {currentUser?.name} ({currentUser?.gender === 'male' ? '男' : '女'})
            </p>
            {isRemote && (
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{currentUser?.location}</span>
              </div>
            )}
          </div>

          {/* Manual Refresh Button for Mobile Users */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground mb-3">
              📱 手機用戶若畫面沒更新，請點擊下方按鈕
            </p>
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="w-full h-14 sm:h-11 text-base sm:text-sm text-foreground border-primary/50 hover:bg-primary/10 touch-manipulation active:scale-[0.98]"
            >
              <RefreshCw className={`w-5 h-5 sm:w-4 sm:h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '更新中...' : '狀態沒更新？點此刷新'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};