import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  Mail, 
  Send, 
  UserX, 
  UserCheck,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

type IncompleteType = 'unverified' | 'incomplete_profile' | 'potential';

interface IncompleteMember {
  id: string;
  email: string;
  name: string;
  type: IncompleteType;
  issue: string;
  created_at: string;
}

export const IncompleteMembersPanel = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  // Fetch incomplete members from multiple sources
  const { data: incompleteMembers, isLoading, refetch } = useQuery({
    queryKey: ['incomplete-members'],
    queryFn: async () => {
      const members: IncompleteMember[] = [];

      // 1. Get profiles with missing display_name (incomplete profile)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, email, display_name, created_at');

      for (const profile of profiles || []) {
        if (!profile.display_name || profile.display_name.trim() === '') {
          members.push({
            id: `profile-${profile.user_id}`,
            email: profile.email || '',
            name: profile.email?.split('@')[0] || '未知',
            type: 'incomplete_profile',
            issue: '缺少真實姓名',
            created_at: profile.created_at,
          });
        }
      }

      // 2. Get potential members who haven't registered (status = 'pending' and no user_id)
      const { data: potentialMembers } = await supabase
        .from('potential_members')
        .select('id, email, name, status, user_id, created_at, sessions_count')
        .is('user_id', null)
        .eq('status', 'pending');

      for (const pm of potentialMembers || []) {
        members.push({
          id: `potential-${pm.id}`,
          email: pm.email,
          name: pm.name,
          type: 'potential',
          issue: `參加 ${pm.sessions_count} 次活動，尚未註冊`,
          created_at: pm.created_at,
        });
      }

      // Sort by created_at desc
      members.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return members;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send notification mutation
  const sendNotification = useMutation({
    mutationFn: async (member: IncompleteMember) => {
      const typeMap: Record<IncompleteType, string> = {
        unverified: 'unverified_email',
        incomplete_profile: 'incomplete_profile',
        potential: 'potential_member',
      };

      const { data, error } = await supabase.functions.invoke('send-profile-completion-notice', {
        body: {
          email: member.email,
          name: member.name,
          type: typeMap[member.type],
          redirectUrl: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, member) => {
      toast.success(`已發送通知給 ${member.email}`);
    },
    onError: (error, member) => {
      toast.error(`發送失敗: ${error.message}`);
    },
  });

  // Bulk send notifications
  const sendBulkNotifications = async () => {
    if (!incompleteMembers) return;
    
    const selectedMembers = incompleteMembers.filter(m => selectedIds.has(m.id));
    
    for (const member of selectedMembers) {
      setSendingIds(prev => new Set([...prev, member.id]));
      try {
        await sendNotification.mutateAsync(member);
      } catch {
        // Error already handled in mutation
      }
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
    
    setSelectedIds(new Set());
    toast.success(`已完成 ${selectedMembers.length} 封通知發送`);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!incompleteMembers) return;
    
    if (selectedIds.size === incompleteMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(incompleteMembers.map(m => m.id)));
    }
  };

  const getTypeBadge = (type: IncompleteType) => {
    switch (type) {
      case 'unverified':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> 未驗證</Badge>;
      case 'incomplete_profile':
        return <Badge variant="secondary" className="gap-1"><UserX className="h-3 w-3" /> 資料不全</Badge>;
      case 'potential':
        return <Badge variant="outline" className="gap-1"><UserCheck className="h-3 w-3" /> 潛在會員</Badge>;
    }
  };

  const stats = {
    total: incompleteMembers?.length || 0,
    unverified: incompleteMembers?.filter(m => m.type === 'unverified').length || 0,
    incomplete: incompleteMembers?.filter(m => m.type === 'incomplete_profile').length || 0,
    potential: incompleteMembers?.filter(m => m.type === 'potential').length || 0,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              待完善會員
            </CardTitle>
            <CardDescription>
              管理尚未完成註冊或資料不完整的使用者
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.incomplete}</div>
            <div className="text-xs text-muted-foreground">資料不完整</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.potential}</div>
            <div className="text-xs text-muted-foreground">潛在會員</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">總計</div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
            <span className="text-sm font-medium">
              已選擇 {selectedIds.size} 位
            </span>
            <Button 
              size="sm" 
              onClick={sendBulkNotifications}
              disabled={sendNotification.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              批量發送通知
            </Button>
          </div>
        )}

        {/* Member List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !incompleteMembers || incompleteMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">太棒了！</p>
            <p className="text-sm">目前沒有待完善的會員資料</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selectedIds.size === incompleteMembers.length && incompleteMembers.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">全選</span>
            </div>

            {/* Members */}
            {incompleteMembers.map((member) => (
              <div 
                key={member.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedIds.has(member.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedIds.has(member.id)}
                  onCheckedChange={() => handleToggleSelect(member.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{member.name}</span>
                    {getTypeBadge(member.type)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{member.issue}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => sendNotification.mutate(member)}
                  disabled={sendingIds.has(member.id)}
                >
                  {sendingIds.has(member.id) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
