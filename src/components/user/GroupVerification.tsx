import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from '@/contexts/SessionContext';
import { fetchGroupMembers, updateParticipantReady } from '@/lib/supabase-helpers';
import { User } from '@/types/bible-study';
import { Users, CheckCircle, Loader2, MapPin } from 'lucide-react';
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

  const groupNumber = currentUser?.groupNumber;
  const location = currentUser?.location || 'On-site';
  const isRemote = location !== 'On-site';

  // Fetch group members and poll for updates
  const fetchMembers = useCallback(async () => {
    if (!currentSession?.id || !groupNumber) return;
    
    const members = await fetchGroupMembers(currentSession.id, groupNumber);
    setGroupMembers(members);
    
    // Check if all members are ready - auto redirect
    const allReady = members.length > 0 && members.every(m => m.readyConfirmed);
    if (allReady) {
      toast.success('所有組員都已準備好！開始查經！');
      onAllReady();
    }
    
    return members;
  }, [currentSession?.id, groupNumber, onAllReady]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      await fetchMembers();
      setIsLoading(false);
    };
    load();
  }, [fetchMembers]);

  // Poll for member status updates every 2 seconds
  useEffect(() => {
    if (!currentSession?.id || !groupNumber) return;
    
    const pollInterval = setInterval(async () => {
      await fetchMembers();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentSession?.id, groupNumber, fetchMembers]);

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
    if (!currentUser?.id) return;
    
    // Validate that all members are checked
    const otherMembers = groupMembers.filter(m => m.id !== currentUser.id);
    const allChecked = otherMembers.every(m => checkedMembers.has(m.id));
    
    if (!allChecked) {
      toast.error('請確認所有組員都在場');
      return;
    }

    setIsSubmitting(true);
    
    const success = await updateParticipantReady(currentUser.id, true);
    
    if (success) {
      setHasConfirmed(true);
      setCurrentUser({ ...currentUser, readyConfirmed: true });
      toast.success('已確認準備完成！等待其他組員...');
      await fetchMembers(); // Refresh to check if all ready
    } else {
      toast.error('確認失敗，請重試');
    }
    
    setIsSubmitting(false);
  };

  const readyCount = groupMembers.filter(m => m.readyConfirmed).length;
  const totalCount = groupMembers.length;
  const otherMembers = groupMembers.filter(m => m.id !== currentUser?.id);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      {/* Large Group/Location Display */}
      <div className="text-center mb-8 animate-scale-in">
        {isRemote ? (
          <>
            <p className="text-muted-foreground text-lg mb-4 flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" />
              您的聚會地點
            </p>
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-secondary/40 rounded-3xl blur-3xl animate-pulse-soft" />
              <div className="relative px-12 py-8 rounded-3xl gradient-gold glow-gold">
                <span className="font-serif text-4xl md:text-5xl font-bold text-secondary-foreground">
                  {location}
                </span>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground">Group #{groupNumber}</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-lg mb-4">您的小組</p>
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-secondary/40 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-36 h-36 md:w-48 md:h-48 rounded-full gradient-gold flex items-center justify-center glow-gold">
                <span className="font-serif text-7xl md:text-8xl font-bold text-secondary-foreground">
                  {groupNumber}
                </span>
              </div>
            </div>
            <p className="mt-4 font-serif text-2xl font-bold text-foreground">
              第 {groupNumber} 組
            </p>
          </>
        )}
      </div>

      {/* Member Verification Card */}
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              組員確認
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {readyCount}/{totalCount} 已就位
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            請確認以下組員都已到場，然後點擊「準備完成」
          </p>
          
          {/* Member List */}
          <div className="space-y-3">
            {otherMembers.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  member.readyConfirmed 
                    ? 'bg-accent/10 border-accent' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                {hasConfirmed ? (
                  <div className={`w-5 h-5 flex items-center justify-center ${
                    member.readyConfirmed ? 'text-accent' : 'text-muted-foreground'
                  }`}>
                    {member.readyConfirmed ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                ) : (
                  <Checkbox
                    id={member.id}
                    checked={checkedMembers.has(member.id)}
                    onCheckedChange={(checked) => 
                      handleCheckMember(member.id, checked as boolean)
                    }
                  />
                )}
                
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.gender === 'male' ? '男' : '女'}
                    {member.readyConfirmed && ' • ✓ 已確認'}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Current user (always shown at bottom) */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              hasConfirmed 
                ? 'bg-accent/10 border-accent' 
                : 'bg-primary/5 border-primary/20'
            }`}>
              <div className="w-5 h-5 flex items-center justify-center text-accent">
                {hasConfirmed && <CheckCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{currentUser?.name} (您)</p>
                <p className="text-xs text-muted-foreground">
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
              className="w-full"
              onClick={handleReady}
              disabled={isSubmitting || otherMembers.length === 0 || 
                !otherMembers.every(m => checkedMembers.has(m.id))}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  確認中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  準備完成 Ready
                </>
              )}
            </Button>
          ) : (
            <div className="text-center py-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-accent">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium">等待其他組員確認...</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Waiting for all members to confirm
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
