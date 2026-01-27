import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSession } from '@/contexts/SessionContext';
import { fetchGroupMembers } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/bible-study';
import { Users, CheckCircle, Loader2, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GroupVerificationProps {
  onAllReady: () => void;
}

export const GroupVerification: React.FC<GroupVerificationProps> = ({ onAllReady }) => {
  const { currentUser, currentSession, setCurrentUser } = useSession();
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [checkedMembers, setCheckedMembers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<'none' | 'no-group' | 'no-members' | 'fetch-error'>('none');

  const globalGroupNumber = currentUser?.groupNumber;
  const location = currentUser?.location || 'On-site';
  const isRemote = location !== 'On-site';

  // Calculate local group number within the user's location
  const localGroupNumber = useMemo(() => {
    if (!currentSession?.groups || !globalGroupNumber) {
      return globalGroupNumber || 1;
    }

    // Get all groups in the user's location
    const locationGroups = currentSession.groups
      .filter(g => {
        const groupLocation = g.members[0]?.location || 'On-site';
        return groupLocation === location;
      })
      .sort((a, b) => a.number - b.number);

    // Find the local index of the user's group within their location
    const localIndex = locationGroups.findIndex(g => g.number === globalGroupNumber);
    return localIndex >= 0 ? localIndex + 1 : 1;
  }, [currentSession?.groups, globalGroupNumber, location]);

  // Force re-sync current user data from DB
  const resyncCurrentUser = useCallback(async () => {
    if (!currentSession?.id || !currentUser?.id) return null;

    setIsSyncing(true);
    setErrorState('none');

    try {
      const { data, error } = await supabase
        .from('participant_names')
        .select('*')
        .eq('session_id', currentSession.id)
        .eq('id', currentUser.id)
        .single();

      if (error || !data) {
        console.error('[GroupVerification] Failed to resync user:', error);
        setErrorState('fetch-error');
        return null;
      }

      const refreshedUser: User = {
        ...currentUser,
        groupNumber: data.group_number || undefined,
        readyConfirmed: data.ready_confirmed || false,
        location: data.location || 'On-site',
      };

      setCurrentUser(refreshedUser);
      return refreshedUser;
    } catch (err) {
      console.error('[GroupVerification] Resync error:', err);
      setErrorState('fetch-error');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [currentSession?.id, currentUser, setCurrentUser]);

  // Fetch group members and poll for updates
  const fetchMembers = useCallback(async () => {
    if (!currentSession?.id) {
      setErrorState('fetch-error');
      return;
    }

    // Check if we have a group number
    if (!globalGroupNumber) {
      setErrorState('no-group');
      return;
    }

    try {
      const members = await fetchGroupMembers(currentSession.id, globalGroupNumber);

      if (members.length === 0) {
        setErrorState('no-members');
      } else {
        setErrorState('none');
        setGroupMembers(members);

        // Check if all members are ready - auto redirect (silent, no toast)
        const allReady = members.every(m => m.readyConfirmed);
        if (allReady) {
          onAllReady();
        }
      }
    } catch (err) {
      console.error('[GroupVerification] Fetch members error:', err);
      setErrorState('fetch-error');
    }
  }, [currentSession?.id, globalGroupNumber, onAllReady]);

  // Handle manual resync button
  const handleResync = async () => {
    const refreshedUser = await resyncCurrentUser();
    if (refreshedUser?.groupNumber) {
      await fetchMembers();
      toast.success('同步成功！');
    } else if (!refreshedUser?.groupNumber) {
      toast.error('尚未分配到小組，請稍候或聯繫主持人');
    }
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      await fetchMembers();
      setIsLoading(false);
    };
    load();
  }, [fetchMembers]);

  // Real-time subscription for instant sync + fallback polling
  useEffect(() => {
    if (!currentSession?.id || !globalGroupNumber) return;

    // Subscribe to participant_names view for real-time updates
    const channel = supabase
      .channel(`group-verification-${currentSession.id}-${globalGroupNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${currentSession.id}`,
        },
        async (payload) => {
          console.log('[GroupVerification] Realtime update received:', payload);
          // Immediately refetch members when any participant changes
          await fetchMembers();
        }
      )
      .subscribe((status) => {
        console.log('[GroupVerification] Realtime subscription status:', status);
        // Silent subscription - no toast to avoid notification spam during transitions
      });

    // Fallback polling every 5 seconds (reduced from 2s since we have realtime now)
    const pollInterval = setInterval(async () => {
      await fetchMembers();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [currentSession?.id, globalGroupNumber, fetchMembers]);

  const handleCheckMember = (memberId: string, checked: boolean) => {
    const newChecked = new Set(checkedMembers);
    if (checked) {
      newChecked.add(memberId);
    } else {
      newChecked.delete(memberId);
    }
    setCheckedMembers(newChecked);
  };

  const handleReady = async () => {
    if (!currentUser?.id || !currentSession?.id) {
      toast.error('缺少必要資訊，請重新整理頁面');
      return;
    }

    // Get email from localStorage (since participant_names view returns NULL for privacy)
    const userEmail = localStorage.getItem('user_email');
    if (!userEmail) {
      toast.error('Session 已過期，請重新加入', {
        description: 'Session expired, please rejoin the study.',
      });
      return;
    }

    // Validate that all members are checked
    const otherMembers = groupMembers.filter(m => m.id !== currentUser.id);
    const allChecked = otherMembers.every(m => checkedMembers.has(m.id));

    if (!allChecked) {
      toast.error('請確認所有組員都在場');
      return;
    }

    setIsSubmitting(true);

    // Use secure RPC with email verification from localStorage
    const { data, error } = await supabase.rpc('set_participant_ready', {
      p_session_id: currentSession.id,
      p_participant_id: currentUser.id,
      p_email: userEmail,
      p_ready: true,
    });

    if (error) {
      console.error('[GroupVerification] RPC error:', error);
      toast.error('確認失敗，請重試', {
        description: error.message,
      });
    } else if (data === true) {
      setHasConfirmed(true);
      setCurrentUser({ ...currentUser, readyConfirmed: true });
      toast.success('已確認準備完成！等待其他組員...');
      await fetchMembers(); // Refresh to check if all ready
    } else {
      toast.error('驗證失敗：可能聚會狀態已變更或身份不符', {
        description: 'Verification failed. Session may have ended or identity mismatch.',
      });
    }

    setIsSubmitting(false);
  };

  const readyCount = groupMembers.filter(m => m.readyConfirmed).length;
  const totalCount = groupMembers.length;
  const otherMembers = groupMembers.filter(m => m.id !== currentUser?.id);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // Error states with recovery UI
  if (errorState !== 'none') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 space-y-6">
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="ml-2">
                {errorState === 'no-group' && '尚未分配小組'}
                {errorState === 'no-members' && '找不到組員資料'}
                {errorState === 'fetch-error' && '資料載入失敗'}
              </AlertTitle>
              <AlertDescription className="ml-7 mt-2">
                {errorState === 'no-group' && (
                  <>
                    您的帳號尚未被分配到任何小組。
                    <br />
                    <span className="text-muted-foreground text-sm">
                      可能原因：主持人尚未開始分組，或同步延遲。
                    </span>
                  </>
                )}
                {errorState === 'no-members' && (
                  <>
                    無法載入您的小組成員名單。
                    <br />
                    <span className="text-muted-foreground text-sm">
                      可能原因：網路問題或資料庫同步延遲。
                    </span>
                  </>
                )}
                {errorState === 'fetch-error' && (
                  <>
                    無法連接到伺服器取得資料。
                    <br />
                    <span className="text-muted-foreground text-sm">
                      請檢查網路連線後重試。
                    </span>
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                目前狀態：
                {currentUser?.groupNumber
                  ? `已分配至第 ${currentUser.groupNumber} 組`
                  : '尚未分配小組'}
              </p>

              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={handleResync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    同步中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新同步 Resync
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                若問題持續，請聯繫主持人協助
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      {/* Large Group/Location Display */}
      <div className="text-center mb-6 sm:mb-8 animate-scale-in">
        {isRemote ? (
          <>
            <p className="text-muted-foreground text-lg sm:text-lg mb-4 flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" />
              您的聚會地點
            </p>
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-secondary/40 rounded-3xl blur-3xl animate-pulse-soft" />
              <div className="relative px-10 sm:px-12 py-6 sm:py-8 rounded-3xl gradient-gold glow-gold">
                <span className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-secondary-foreground">
                  {location}
                </span>
              </div>
            </div>
            <p className="mt-4 text-lg sm:text-base text-muted-foreground">第 {localGroupNumber} 組</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-lg sm:text-lg mb-4 flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              您的小組
            </p>
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-secondary/40 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-full gradient-gold flex items-center justify-center glow-gold shadow-2xl">
                <span className="font-serif text-7xl sm:text-8xl md:text-9xl font-bold text-secondary-foreground drop-shadow-lg">
                  {localGroupNumber}
                </span>
              </div>
            </div>
            <p className="mt-5 sm:mt-6 font-serif text-2xl sm:text-3xl font-bold text-foreground">
              第 {localGroupNumber} 組
            </p>
            <p className="mt-2 text-sm text-muted-foreground">現場 On-site</p>
          </>
        )}
      </div>

      {/* Member Verification Card */}
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg sm:text-base">
              <Users className="w-5 h-5 text-secondary" />
              組員確認
            </span>
            <span className="text-base sm:text-sm font-normal text-muted-foreground">
              {readyCount}/{totalCount} 已就位
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 space-y-4">
          <p className="text-base sm:text-sm text-muted-foreground">
            請確認以下組員都已到場，然後點擊「準備完成」
          </p>
          
          {/* Member List */}
          <div className="space-y-3">
            {otherMembers.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-4 sm:p-3 rounded-lg border transition-all touch-manipulation ${
                  member.readyConfirmed 
                    ? 'bg-accent/10 border-accent' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                {hasConfirmed ? (
                  <div className={`w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center ${
                    member.readyConfirmed ? 'text-accent' : 'text-muted-foreground'
                  }`}>
                    {member.readyConfirmed ? (
                      <CheckCircle className="w-6 h-6 sm:w-5 sm:h-5" />
                    ) : (
                      <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
                    )}
                  </div>
                ) : (
                  <Checkbox
                    id={member.id}
                    checked={checkedMembers.has(member.id)}
                    onCheckedChange={(checked) => 
                      handleCheckMember(member.id, checked as boolean)
                    }
                    className="w-6 h-6 sm:w-5 sm:h-5"
                  />
                )}
                
                <div className="flex-1">
                  <p className="font-medium text-base sm:text-sm">{member.name}</p>
                  <p className="text-sm sm:text-xs text-muted-foreground">
                    {member.gender === 'male' ? '男' : '女'}
                    {member.readyConfirmed && ' • ✓ 已確認'}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Current user (always shown at bottom) */}
            <div className={`flex items-center gap-3 p-4 sm:p-3 rounded-lg border ${
              hasConfirmed 
                ? 'bg-accent/10 border-accent' 
                : 'bg-primary/5 border-primary/20'
            }`}>
              <div className="w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center text-accent">
                {hasConfirmed && <CheckCircle className="w-6 h-6 sm:w-5 sm:h-5" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-base sm:text-sm">{currentUser?.name} (您)</p>
                <p className="text-sm sm:text-xs text-muted-foreground">
                  {currentUser?.gender === 'male' ? '男' : '女'}
                  {hasConfirmed && ' • ✓ 已確認'}
                </p>
              </div>
            </div>
          </div>

          {/* Ready Button or Waiting Message */}
          {!hasConfirmed ? (
            <Button
              variant="gold"
              size="lg"
              className="w-full h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98]"
              onClick={handleReady}
              disabled={isSubmitting || otherMembers.length === 0 || 
                !otherMembers.every(m => checkedMembers.has(m.id))}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin mr-2" />
                  確認中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                  準備完成 Ready
                </>
              )}
            </Button>
          ) : (
            <div className="text-center py-4 sm:py-3 bg-muted/30 rounded-lg">
              <p className="text-base sm:text-sm text-muted-foreground">
                ✓ 您已準備完成，等待其他組員...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
