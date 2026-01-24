import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface UsePotentialMembersOptions {
  status?: 'pending' | 'member' | 'declined' | 'all';
  subscribed?: boolean | 'all';
  page?: number;
  pageSize?: number;
}

export const usePotentialMembers = (options: UsePotentialMembersOptions = {}) => {
  const { status = 'all', subscribed = 'all', page = 1, pageSize = 50 } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['potential-members', { page, status, subscribed }],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('potential_members')
        .select('*', { count: 'exact' })
        .order('last_session_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (status !== 'all') {
        queryBuilder = queryBuilder.eq('status', status);
      }

      if (subscribed !== 'all') {
        queryBuilder = queryBuilder.eq('subscribed', subscribed);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      return {
        members: data as PotentialMember[],
        totalCount: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
    refetchInterval: 5000, // Poll every 5 seconds for live updates
  });

  const stats = useQuery({
    queryKey: ['potential-members-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential_members')
        .select('status, sessions_count');

      if (error) throw error;

      const total = data.length;
      const converted = data.filter(m => m.status === 'member').length;
      const pending = data.filter(m => m.status === 'pending').length;
      const avgAttendance = total > 0 
        ? Math.round(data.reduce((sum, m) => sum + m.sessions_count, 0) / total * 10) / 10
        : 0;

      return { total, converted, pending, avgAttendance };
    },
    refetchInterval: 5000,
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PotentialMember> }) => {
      const { error } = await supabase
        .from('potential_members')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['potential-members'] });
      queryClient.invalidateQueries({ queryKey: ['potential-members-stats'] });
      toast.success('會員資料已更新');
    },
    onError: (error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  const linkUserManually = useMutation({
    mutationFn: async ({ memberId, userId }: { memberId: string; userId: string }) => {
      const { error } = await supabase
        .from('potential_members')
        .update({ user_id: userId, status: 'member', updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['potential-members'] });
      queryClient.invalidateQueries({ queryKey: ['potential-members-stats'] });
      toast.success('已手動連結用戶');
    },
    onError: (error) => {
      toast.error('連結失敗: ' + error.message);
    },
  });

  const forceRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['potential-members'] });
    queryClient.invalidateQueries({ queryKey: ['potential-members-stats'] });
  };

  return {
    ...query,
    stats: stats.data,
    statsLoading: stats.isLoading,
    updateMember,
    linkUserManually,
    forceRefetch,
  };
};

// Simulation helper for dev tools
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
        .insert({
          session_id: sessionId,
          name,
          email,
          gender,
          location: 'On-site',
        });

      if (error) throw error;
      return { name, email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['potential-members'] });
      queryClient.invalidateQueries({ queryKey: ['potential-members-stats'] });
      toast.success(`模擬參與者 ${data.name} 已加入`);
    },
    onError: (error) => {
      toast.error('模擬失敗: ' + error.message);
    },
  });
};
