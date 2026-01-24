import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSession } from '@/contexts/SessionContext';
import { useRealtimeSecure } from '@/hooks/useRealtimeSecure';
import { Clock, Users } from 'lucide-react';

interface WaitingRoomProps {
  onGroupingStarted: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onGroupingStarted }) => {
  const { currentUser, users, currentSession, setCurrentSession, updateUser } = useSession();

  // Listen for session status updates and participant group assignments
  // Using secure realtime hook that strips email data for privacy
  useRealtimeSecure({
    sessionId: currentSession?.id || null,
    onSessionUpdated: (sessionUpdate) => {
      if (sessionUpdate.status === 'studying' && currentSession) {
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
  });

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
