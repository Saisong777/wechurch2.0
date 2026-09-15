import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/hooks/useUserRole';
import { filterCrmMembers, getCrmStats, mergeCrmMembers, runCrmBatch, type CrmBatchAction, type CrmSnapshot } from '@/lib/crm-members';

export interface PotentialMember {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  church: string | null;
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
  church: string | null;
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
  status?: PotentialMember['status'] | 'all';
  subscribed?: boolean | 'all';
  role?: AppRole | 'all';
  church?: string;
  enabled?: boolean;
}

const emptyMembers: UnifiedMember[] = [];

export const useUnifiedMembers = (options: UseUnifiedMembersOptions) => {
  const { tab, status = 'all', subscribed = 'all', role = 'all', church = 'all', enabled = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    // Scope includes the viewer; cached data must never carry across accounts.
    queryKey: ['unified-members', user?.id, user?.role, { church }],
    enabled: enabled && !!user,
    queryFn: async ({ signal }) => {
      const churchQuery = `?${new URLSearchParams({ church })}`;
      const [users, roles, potentialMembers] = await Promise.all(
        ['/api/users', '/api/user-roles', '/api/potential-members'].map(async path => {
          const response = await fetch(`${path}${churchQuery}`, { signal });
          if (!response.ok) throw new Error(response.status === 403 ? '沒有權限讀取這個範圍的會員' : '會員資料讀取失敗，請稍後重試');
          const rows = await response.json();
          if (!Array.isArray(rows)) throw new Error('會員資料格式異常');
          return rows;
        }),
      );
      const source: CrmSnapshot = { users, roles, potentialMembers };
      const members = mergeCrmMembers(source);
      return { source, members, stats: getCrmStats(source, members) };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const allMembers = query.data?.members ?? emptyMembers;
  const data = useMemo(() => filterCrmMembers(allMembers, { tab, status, subscribed, role }),
    [allMembers, tab, status, subscribed, role]);
  const forceRefetch = () => queryClient.invalidateQueries({ queryKey: ['unified-members'] });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const response = await fetch(`/api/user-roles/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error('請確認權限並稍後重試');
    },
    onSuccess: () => { void forceRefetch(); toast.success('角色已更新'); },
    onError: (error: Error) => toast.error('更新角色失敗：' + error.message),
  });
  const updatePotentialMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PotentialMember> }) => {
      const response = await fetch(`/api/potential-members/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('請確認權限並稍後重試');
    },
    onSuccess: () => { void forceRefetch(); toast.success('資料已更新'); },
    onError: (error: Error) => toast.error('更新失敗：' + error.message),
  });
  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/potential-members/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('請確認權限並稍後重試');
    },
    onSuccess: () => { void forceRefetch(); toast.success('資料已刪除'); },
    onError: (error: Error) => toast.error('刪除失敗：' + error.message),
  });
  const bulkAction = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: CrmBatchAction }) => runCrmBatch(ids, action),
    onSuccess: result => {
      void forceRefetch();
      if (result.failed.length) toast.error(`已完成 ${result.succeeded.length} 筆，${result.failed.length} 筆失敗，請確認後重試`);
      else toast.success(`已完成 ${result.succeeded.length} 筆更新`);
    },
  });

  return {
    ...query, data, allMembers, source: query.data?.source,
    stats: query.data?.stats, statsLoading: query.isLoading,
    updateRole, updatePotentialMember, deleteMember, bulkAction, forceRefetch,
  };
};
