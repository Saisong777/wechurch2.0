import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppRole } from '@/hooks/useUserRole';

export interface PotentialMember {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  user_id: string | null;
  status: 'pending' | 'member' | 'declined';
  subscribed: boolean;
  first_joined_at: string;
  last_session_at: string;
  sessions_count: number;
  created_at: string;
  updated_at: string;
}

export interface RegisteredUser {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
  // Linked potential member data
  potential_member_id: string | null;
  sessions_count: number;
  last_session_at: string | null;
  subscribed: boolean;
}

export interface UnifiedMember {
  id: string;
  type: 'registered' | 'potential';
  email: string;
  name: string;
  gender: string | null;
  user_id: string | null;
  role: AppRole | null;
  status: 'pending' | 'member' | 'declined';
  subscribed: boolean;
  sessions_count: number;
  first_joined_at: string | null;
  last_session_at: string | null;
  created_at: string;
  potential_member_id: string | null;
}

interface UseUnifiedMembersOptions {
  tab: 'all' | 'registered' | 'potential' | 'incomplete';
  status?: 'pending' | 'member' | 'declined' | 'all';
  subscribed?: boolean | 'all';
  role?: AppRole | 'all';
}

export const useUnifiedMembers = (options: UseUnifiedMembersOptions) => {
  const { tab, status = 'all', subscribed = 'all', role = 'all' } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['unified-members', { tab, status, subscribed, role }],
    queryFn: async () => {
      const members: UnifiedMember[] = [];

      if (tab === 'all' || tab === 'registered') {
        // Fetch registered users with their roles and linked potential member data
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, user_id, email, display_name, created_at');

        if (profileError) throw profileError;

        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (roleError) throw roleError;

        const { data: potentialMembers, error: pmError } = await supabase
          .from('potential_members')
          .select('id, email, user_id, sessions_count, last_session_at, subscribed, gender, name');

        if (pmError) throw pmError;

        for (const profile of profiles || []) {
          const userRole = roles?.find((r) => r.user_id === profile.user_id);
          const linkedPm = potentialMembers?.find((pm) => pm.user_id === profile.user_id);

          const member: UnifiedMember = {
            id: profile.id,
            type: 'registered',
            email: profile.email || '',
            name: profile.display_name || profile.email?.split('@')[0] || '',
            gender: linkedPm?.gender || null,
            user_id: profile.user_id,
            role: (userRole?.role as AppRole) || 'member',
            status: 'member',
            subscribed: linkedPm?.subscribed ?? true,
            sessions_count: linkedPm?.sessions_count || 0,
            first_joined_at: profile.created_at,
            last_session_at: linkedPm?.last_session_at || null,
            created_at: profile.created_at,
            potential_member_id: linkedPm?.id || null,
          };

          // Apply filters
          if (role !== 'all' && member.role !== role) continue;

          members.push(member);
        }
      }

      if (tab === 'all' || tab === 'potential') {
        // Fetch potential members who are NOT linked to a registered user
        let pmQuery = supabase
          .from('potential_members')
          .select('*')
          .is('user_id', null);

        if (status !== 'all') {
          pmQuery = pmQuery.eq('status', status);
        }

        if (subscribed !== 'all') {
          pmQuery = pmQuery.eq('subscribed', subscribed);
        }

        const { data: unlinkedPm, error } = await pmQuery;

        if (error) throw error;

        for (const pm of unlinkedPm || []) {
          members.push({
            id: pm.id,
            type: 'potential',
            email: pm.email,
            name: pm.name,
            gender: pm.gender,
            user_id: null,
            role: null,
            status: pm.status as 'pending' | 'member' | 'declined',
            subscribed: pm.subscribed,
            sessions_count: pm.sessions_count,
            first_joined_at: pm.first_joined_at,
            last_session_at: pm.last_session_at,
            created_at: pm.created_at,
            potential_member_id: pm.id,
          });
        }
      }

      // Sort: registered users by role, then by name
      members.sort((a, b) => {
        // Type priority (registered first if showing all)
        if (a.type !== b.type) {
          return a.type === 'registered' ? -1 : 1;
        }

        // Role priority for registered users
        if (a.role && b.role) {
          const roleOrder: Record<AppRole, number> = { admin: 0, leader: 1, future_leader: 2, member: 3 };
          if (roleOrder[a.role] !== roleOrder[b.role]) {
            return roleOrder[a.role] - roleOrder[b.role];
          }
        }

        // Then by name
        return a.name.localeCompare(b.name);
      });

      return members;
    },
    refetchInterval: 5000,
  });

  const stats = useQuery({
    queryKey: ['unified-members-stats'],
    queryFn: async () => {
      // Registered users stats
      const { data: profiles } = await supabase.from('profiles').select('id');
      const { data: roles } = await supabase.from('user_roles').select('role');

      // Potential members stats
      const { data: pm } = await supabase.from('potential_members').select('status, user_id, sessions_count');

      const registeredCount = profiles?.length || 0;
      const adminCount = roles?.filter(r => r.role === 'admin').length || 0;
      const leaderCount = roles?.filter(r => r.role === 'leader').length || 0;
      
      const potentialTotal = pm?.length || 0;
      const linkedCount = pm?.filter(p => p.user_id !== null).length || 0;
      const pendingCount = pm?.filter(p => p.status === 'pending' && !p.user_id).length || 0;
      
      const avgAttendance = potentialTotal > 0 
        ? Math.round((pm?.reduce((sum, p) => sum + p.sessions_count, 0) || 0) / potentialTotal * 10) / 10
        : 0;

      return {
        registeredCount,
        adminCount,
        leaderCount,
        potentialTotal,
        linkedCount,
        pendingCount,
        avgAttendance,
      };
    },
    refetchInterval: 5000,
  });

  // Role management mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('角色已更新');
    },
    onError: (error) => {
      toast.error('更新角色失敗: ' + error.message);
    },
  });

  // Potential member mutations
  const updatePotentialMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PotentialMember> }) => {
      const { error } = await supabase
        .from('potential_members')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('資料已更新');
    },
    onError: (error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: PotentialMember['status'] }) => {
      const { error } = await supabase
        .from('potential_members')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success(`已更新 ${ids.length} 筆狀態`);
    },
    onError: (error) => {
      toast.error('批量更新失敗: ' + error.message);
    },
  });

  const bulkUpdateSubscription = useMutation({
    mutationFn: async ({ ids, subscribed }: { ids: string[]; subscribed: boolean }) => {
      const { error } = await supabase
        .from('potential_members')
        .update({ subscribed, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, subscribed }) => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success(`已${subscribed ? '啟用' : '取消'} ${ids.length} 筆訂閱`);
    },
    onError: (error) => {
      toast.error('批量更新失敗: ' + error.message);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('potential_members')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success(`已刪除 ${ids.length} 筆資料`);
    },
    onError: (error) => {
      toast.error('刪除失敗: ' + error.message);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('potential_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('資料已刪除');
    },
    onError: (error) => {
      toast.error('刪除失敗: ' + error.message);
    },
  });

  const linkUserManually = useMutation({
    mutationFn: async ({ potentialMemberId, userId }: { potentialMemberId: string; userId: string }) => {
      const { error } = await supabase
        .from('potential_members')
        .update({ user_id: userId, status: 'member', updated_at: new Date().toISOString() })
        .eq('id', potentialMemberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('已連結用戶');
    },
    onError: (error) => {
      toast.error('連結失敗: ' + error.message);
    },
  });

  const forceRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['unified-members'] });
    queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
  };

  return {
    ...query,
    stats: stats.data,
    statsLoading: stats.isLoading,
    updateRole,
    updatePotentialMember,
    bulkUpdateStatus,
    bulkUpdateSubscription,
    bulkDelete,
    deleteMember,
    linkUserManually,
    forceRefetch,
  };
};

// Simulation helper
export const useSimulateParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const firstNames = ['小明', '小華', '志偉', '美玲', '建宏', '淑芬', '家豪', '雅婷', '俊傑', '怡君'];
      const lastNames = ['王', '李', '張', '陳', '林', '黃', '吳', '劉', '蔡', '楊'];
      
      const name = lastNames[Math.floor(Math.random() * lastNames.length)] + 
                   firstNames[Math.floor(Math.random() * firstNames.length)];
      const email = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
      const gender = Math.random() > 0.5 ? 'male' : 'female';

      const { error } = await supabase
        .from('participants')
        .insert({ session_id: sessionId, name, email, gender, location: 'On-site' });

      if (error) throw error;
      return { name, email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success(`模擬參與者 ${data.name} 已加入`);
    },
    onError: (error) => {
      toast.error('模擬失敗: ' + error.message);
    },
  });
};
