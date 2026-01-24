import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { useRealtimeSecure } from '@/hooks/useRealtimeSecure';
import { Clock, Users, MapPin, RefreshCw } from 'lucide-react';

interface WaitingRoomProps {
  onGroupingStarted: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onGroupingStarted }) => {
  const { currentUser, users, currentSession, setCurrentSession, updateUser, setCurrentUser } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen for session status updates and participant group assignments
  // Using secure realtime hook with aggressive mobile sync features
  const { forceRefresh } = useRealtimeSecure({
    sessionId: currentSession?.id || null,
    currentUserId: currentUser?.id || null,
    onSessionUpdated: (sessionUpdate) => {
      if ((sessionUpdate.status === 'studying' || sessionUpdate.status === 'grouping' || sessionUpdate.status === 'verification') && currentSession) {
        setCurrentSession({ ...currentSession, ...sessionUpdate } as any);
      }
    },
    onParticipantUpdated: (user) => {
      updateUser(user);
      // If this is the current user and they got a group number, trigger the transition
      if (user.id === currentUser?.id && user.groupNumber) {
        onGroupingStarted();
      }
    },
    // Handle force-refetched user data when session status changes
    onCurrentUserRefetched: (user) => {
      console.log('[WaitingRoom] User refetched:', user.name, 'groupNumber:', user.groupNumber);
      setCurrentUser(user);
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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const isRemote = currentUser?.location && currentUser.location !== 'On-site';

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      <Card variant="highlight" className="text-center">
        <CardContent className="py-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-secondary/30 rounded-full blur-xl animate-pulse-soft" />
            <div className="relative w-20 h-20 rounded-full gradient-gold flex items-center justify-center glow-gold">
              <Clock className="w-10 h-10 text-secondary-foreground animate-pulse" />
            </div>
          </div>
          
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
            等待主持人開始...
          </h2>
          <p className="text-muted-foreground">
            Waiting for the host to start grouping
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5" />
              <span className="font-medium">已加入成員</span>
            </div>
            <span className="text-lg font-bold text-primary">{users.length} 人</span>
          </div>

          {currentSession?.verseReference && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">今日經文</p>
              <p className="font-serif text-lg font-medium text-foreground">
                {currentSession.verseReference}
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">您已登記為</p>
            <p className="font-medium text-foreground mt-1">
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
            <p className="text-xs text-muted-foreground mb-2">
              📱 手機用戶若畫面沒更新，請點擊下方按鈕
            </p>
            <Button 
              variant="outline" 
              size="default"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="w-full text-foreground border-primary/50 hover:bg-primary/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '更新中...' : '狀態沒更新？點此刷新'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};