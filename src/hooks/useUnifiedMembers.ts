import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppRole } from '@/hooks/useUserRole';

export interface PotentialMember {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  userId: string | null;
  status: 'pending' | 'member' | 'declined';
  subscribed: boolean;
  firstJoinedAt: string;
  lastSessionAt: string;
  sessionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedMember {
  id: string;
  type: 'registered' | 'potential';
  email: string;
  name: string;
  gender: string | null;
  userId: string | null;
  role: AppRole | null;
  status: 'pending' | 'member' | 'declined';
  subscribed: boolean;
  sessionsCount: number;
  firstJoinedAt: string | null;
  lastSessionAt: string | null;
  createdAt: string;
  potentialMemberId: string | null;
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
      const [usersRes, rolesRes, pmRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/user-roles'),
        fetch('/api/potential-members'),
      ]);

      if (!usersRes.ok || !rolesRes.ok || !pmRes.ok) {
        throw new Error('Failed to fetch members data');
      }

      const [users, roles, potentialMembers] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        pmRes.json(),
      ]);

      const members: UnifiedMember[] = [];

      if (tab === 'all' || tab === 'registered') {
        for (const user of users || []) {
          const userRole = roles?.find((r: any) => r.userId === user.id);
          const linkedPm = potentialMembers?.find((pm: any) => pm.userId === user.id);

          const member: UnifiedMember = {
            id: user.id,
            type: 'registered',
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || '',
            gender: linkedPm?.gender || null,
            userId: user.id,
            role: (userRole?.role as AppRole) || 'member',
            status: 'member',
            subscribed: linkedPm?.subscribed ?? true,
            sessionsCount: linkedPm?.sessionsCount || 0,
            firstJoinedAt: user.createdAt,
            lastSessionAt: linkedPm?.lastSessionAt || null,
            createdAt: user.createdAt,
            potentialMemberId: linkedPm?.id || null,
          };

          if (role !== 'all' && member.role !== role) continue;
          members.push(member);
        }
      }

      if (tab === 'all' || tab === 'potential') {
        const unlinkedPm = potentialMembers?.filter((pm: any) => !pm.userId) || [];
        for (const pm of unlinkedPm) {
          if (status !== 'all' && pm.status !== status) continue;
          if (subscribed !== 'all' && pm.subscribed !== subscribed) continue;

          members.push({
            id: pm.id,
            type: 'potential',
            email: pm.email,
            name: pm.name,
            gender: pm.gender,
            userId: null,
            role: null,
            status: pm.status as 'pending' | 'member' | 'declined',
            subscribed: pm.subscribed,
            sessionsCount: pm.sessionsCount,
            firstJoinedAt: pm.firstJoinedAt,
            lastSessionAt: pm.lastSessionAt,
            createdAt: pm.createdAt,
            potentialMemberId: pm.id,
          });
        }
      }

      members.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'registered' ? -1 : 1;
        if (a.role && b.role) {
          const roleOrder: Record<AppRole, number> = { admin: 0, leader: 1, future_leader: 2, member: 3 };
          if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
        }
        return a.name.localeCompare(b.name);
      });

      return members;
    },
    refetchInterval: 5000,
  });

  const stats = useQuery({
    queryKey: ['unified-members-stats'],
    queryFn: async () => {
      const [usersRes, rolesRes, pmRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/user-roles'),
        fetch('/api/potential-members'),
      ]);

      const [users, roles, pm] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        pmRes.json(),
      ]);

      const registeredCount = users?.length || 0;
      const adminCount = roles?.filter((r: any) => r.role === 'admin').length || 0;
      const leaderCount = roles?.filter((r: any) => r.role === 'leader').length || 0;

      const potentialTotal = pm?.length || 0;
      const linkedCount = pm?.filter((p: any) => p.userId !== null).length || 0;
      const pendingCount = pm?.filter((p: any) => p.status === 'pending' && !p.userId).length || 0;

      const avgAttendance = potentialTotal > 0
        ? Math.round((pm?.reduce((sum: number, p: any) => sum + p.sessionsCount, 0) || 0) / potentialTotal * 10) / 10
        : 0;

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const newRegisteredWeek = users?.filter((p: any) => new Date(p.createdAt) >= oneWeekAgo).length || 0;
      const newRegisteredMonth = users?.filter((p: any) => new Date(p.createdAt) >= oneMonthAgo).length || 0;

      const newPotentialWeek = pm?.filter((p: any) => {
        const joinDate = new Date(p.firstJoinedAt || p.createdAt);
        return joinDate >= oneWeekAgo;
      }).length || 0;

      const newPotentialMonth = pm?.filter((p: any) => {
        const joinDate = new Date(p.firstJoinedAt || p.createdAt);
        return joinDate >= oneMonthAgo;
      }).length || 0;

      return {
        registeredCount,
        adminCount,
        leaderCount,
        potentialTotal,
        linkedCount,
        pendingCount,
        avgAttendance,
        newThisWeek: newRegisteredWeek + newPotentialWeek,
        newThisMonth: newRegisteredMonth + newPotentialMonth,
        newRegisteredWeek,
        newPotentialWeek,
      };
    },
    refetchInterval: 5000,
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const response = await fetch(`/api/user-roles/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error('Failed to update role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('角色已更新');
    },
    onError: (error: Error) => {
      toast.error('更新角色失敗: ' + error.message);
    },
  });

  const updatePotentialMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PotentialMember> }) => {
      const response = await fetch(`/api/potential-members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update member');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('資料已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/potential-members/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete member');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-members'] });
      queryClient.invalidateQueries({ queryKey: ['unified-members-stats'] });
      toast.success('資料已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗: ' + error.message);
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
    deleteMember,
    forceRefetch,
  };
};
