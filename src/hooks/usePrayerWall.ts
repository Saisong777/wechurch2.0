import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type PrayerCategory = 'thanksgiving' | 'supplication' | 'praise' | 'other';

export const CATEGORY_LABELS: Record<PrayerCategory, string> = {
  thanksgiving: '感恩',
  supplication: '代求',
  praise: '讚美',
  other: '其他',
};

export interface Prayer {
  id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  user_id: string;
  category: PrayerCategory;
  is_pinned: boolean;
  author_name: string;
  author_avatar: string | null;
  amen_count: number;
  is_owner: boolean;
  has_amened: boolean;
}

export const usePrayerWall = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prayer-wall'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_prayer_wall')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Prayer[];
    },
    enabled: !!user,
    refetchInterval: 20000, // 20 seconds - prayer wall is not time-critical
    refetchOnWindowFocus: true,
  });
};

export const useCreatePrayer = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ content, isAnonymous, category }: { content: string; isAnonymous: boolean; category: PrayerCategory }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('prayers')
        .insert({
          user_id: user.id,
          content: content.trim(),
          is_anonymous: isAnonymous,
          category,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      toast.success('禱告已發布 Prayer posted');
    },
    onError: (error) => {
      console.error('Error creating prayer:', error);
      toast.error('發布失敗 Failed to post');
    },
  });
};

export const useDeletePrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prayerId: string) => {
      const { error } = await supabase
        .from('prayers')
        .delete()
        .eq('id', prayerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      toast.success('禱告已刪除 Prayer deleted');
    },
    onError: (error) => {
      console.error('Error deleting prayer:', error);
      toast.error('刪除失敗 Failed to delete');
    },
  });
};

export const useToggleAmen = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, hasAmened }: { prayerId: string; hasAmened: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (hasAmened) {
        // Remove amen
        const { error } = await supabase
          .from('prayer_amens')
          .delete()
          .eq('prayer_id', prayerId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Add amen
        const { error } = await supabase
          .from('prayer_amens')
          .insert({
            prayer_id: prayerId,
            user_id: user.id,
          });
        if (error) throw error;
      }
    },
    onMutate: async ({ prayerId, hasAmened }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['prayer-wall'] });

      // Snapshot the previous value
      const previousPrayers = queryClient.getQueryData<Prayer[]>(['prayer-wall']);

      // Optimistically update
      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === prayerId
            ? {
                ...prayer,
                has_amened: !hasAmened,
                amen_count: hasAmened ? prayer.amen_count - 1 : prayer.amen_count + 1,
              }
            : prayer
        )
      );

      return { previousPrayers };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousPrayers) {
        queryClient.setQueryData(['prayer-wall'], context.previousPrayers);
      }
      toast.error('操作失敗 Action failed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
    },
  });
};

export const useTogglePinPrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prayerId, isPinned }: { prayerId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('prayers')
        .update({ is_pinned: !isPinned })
        .eq('id', prayerId);

      if (error) throw error;
    },
    onMutate: async ({ prayerId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: ['prayer-wall'] });
      const previousPrayers = queryClient.getQueryData<Prayer[]>(['prayer-wall']);

      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === prayerId ? { ...prayer, is_pinned: !isPinned } : prayer
        )
      );

      return { previousPrayers };
    },
    onError: (err, variables, context) => {
      if (context?.previousPrayers) {
        queryClient.setQueryData(['prayer-wall'], context.previousPrayers);
      }
      toast.error('操作失敗');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
    },
  });
};
