import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { HIGH_CONCURRENCY_CONFIG } from '@/lib/retry-utils';

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
  isAnonymous: boolean;
  createdAt: string;
  userId: string;
  category: PrayerCategory;
  isPinned: boolean;
  isAnswered: boolean;
  answeredAt: string | null;
  scriptureReference: string | null;
  authorName: string;
  authorAvatar: string | null;
  amenCount: number;
  isOwner: boolean;
  hasAmened: boolean;
}

export const usePrayerWall = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prayer-wall'],
    queryFn: async () => {
      const response = await fetch('/api/prayers');
      if (!response.ok) throw new Error('Failed to fetch prayers');
      const data = await response.json();
      
      return data.map((p: any) => ({
        id: p.id,
        content: p.content,
        isAnonymous: p.isAnonymous,
        createdAt: p.createdAt,
        userId: p.userId,
        category: p.category as PrayerCategory,
        isPinned: p.isPinned || false,
        isAnswered: p.isAnswered || false,
        answeredAt: p.answeredAt || null,
        scriptureReference: p.scriptureReference || null,
        authorName: p.isAnonymous ? '匿名' : (p.authorName || '未知'),
        authorAvatar: p.authorAvatar,
        amenCount: p.amenCount || 0,
        isOwner: p.userId === (user as any)?.legacyUserId || p.userId === user?.id,
        hasAmened: false,
      })) as Prayer[];
    },
    enabled: !!user,
    refetchInterval: HIGH_CONCURRENCY_CONFIG.PRAYER_WALL_POLL_MS + Math.random() * 2000,
    refetchOnWindowFocus: true,
  });
};

export const useCreatePrayer = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ content, isAnonymous, category, scriptureReference }: { content: string; isAnonymous: boolean; category: PrayerCategory; scriptureReference?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const response = await fetch('/api/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (user as any).legacyUserId || user.id,
          content: content.trim(),
          isAnonymous,
          category,
          scriptureReference: scriptureReference || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create prayer');
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
      const response = await fetch(`/api/prayers/${prayerId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete prayer');
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

  return useMutation({
    mutationFn: async ({ prayerId, hasAmened }: { prayerId: string; hasAmened: boolean }) => {
      // For now, just invalidate to refetch
      return { prayerId, hasAmened };
    },
    onMutate: async ({ prayerId, hasAmened }) => {
      await queryClient.cancelQueries({ queryKey: ['prayer-wall'] });
      const previousPrayers = queryClient.getQueryData<Prayer[]>(['prayer-wall']);

      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === prayerId
            ? {
                ...prayer,
                hasAmened: !hasAmened,
                amenCount: hasAmened ? prayer.amenCount - 1 : prayer.amenCount + 1,
              }
            : prayer
        )
      );

      return { previousPrayers };
    },
    onError: (err, variables, context) => {
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
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned }),
      });
      if (!response.ok) throw new Error('Failed to update prayer');
    },
    onMutate: async ({ prayerId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: ['prayer-wall'] });
      const previousPrayers = queryClient.getQueryData<Prayer[]>(['prayer-wall']);

      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === prayerId ? { ...prayer, isPinned: !isPinned } : prayer
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

export const useMarkPrayerAnswered = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prayerId, isAnswered }: { prayerId: string; isAnswered: boolean }) => {
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isAnswered: !isAnswered, 
          answeredAt: !isAnswered ? new Date().toISOString() : null 
        }),
      });
      if (!response.ok) throw new Error('Failed to update prayer');
    },
    onMutate: async ({ prayerId, isAnswered }) => {
      await queryClient.cancelQueries({ queryKey: ['prayer-wall'] });
      const previousPrayers = queryClient.getQueryData<Prayer[]>(['prayer-wall']);

      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === prayerId 
            ? { ...prayer, isAnswered: !isAnswered, answeredAt: !isAnswered ? new Date().toISOString() : null } 
            : prayer
        )
      );

      return { previousPrayers };
    },
    onSuccess: (_, variables) => {
      if (!variables.isAnswered) {
        toast.success('感謝神！禱告已蒙應允！');
      }
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
