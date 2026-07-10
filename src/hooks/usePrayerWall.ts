import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { HIGH_CONCURRENCY_CONFIG, getPollingInterval } from '@/lib/retry-utils';

export type PrayerCategory = 'thanksgiving' | 'supplication' | 'praise' | 'other';

export const CATEGORY_LABELS: Record<PrayerCategory, string> = {
  thanksgiving: '感恩',
  supplication: '代求',
  praise: '讚美',
  other: '其他',
};

const LOCAL_PRAYER_STORAGE_KEY = 'wechurch_local_prayer_wall_v1';
const LOCAL_AMEN_STORAGE_KEY = 'wechurch_local_prayer_amens_v1';

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

function getUserId(user: any) {
  return user?.legacyUserId || user?.id || 'local-user';
}

function getUserName(user: any) {
  return user?.user_metadata?.display_name || user?.email?.split('@')[0] || '我';
}

function loadLocalAmens(): Record<string, { hasAmened: boolean; delta: number }> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(LOCAL_AMEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalAmens(amens: Record<string, { hasAmened: boolean; delta: number }>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_AMEN_STORAGE_KEY, JSON.stringify(amens));
}

function applyLocalAmenState(prayer: Prayer): Prayer {
  const localAmen = loadLocalAmens()[prayer.id];
  if (!localAmen) return prayer;

  return {
    ...prayer,
    hasAmened: localAmen.hasAmened,
    amenCount: Math.max(0, (prayer.amenCount || 0) + localAmen.delta),
  };
}

function persistLocalAmen(prayerId: string, nextHasAmened: boolean, previousHasAmened: boolean) {
  const amens = loadLocalAmens();
  const current = amens[prayerId] || { hasAmened: previousHasAmened, delta: 0 };
  const nextDelta = current.delta + (nextHasAmened ? 1 : -1);
  amens[prayerId] = { hasAmened: nextHasAmened, delta: nextDelta };
  saveLocalAmens(amens);
}

function loadLocalPrayers(user: any): Prayer[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LOCAL_PRAYER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((prayer) => applyLocalAmenState({
      ...prayer,
      isOwner: prayer.userId === getUserId(user),
      hasAmened: !!prayer.hasAmened,
    })) as Prayer[];
  } catch {
    return [];
  }
}

function saveLocalPrayers(prayers: Prayer[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_PRAYER_STORAGE_KEY, JSON.stringify(prayers));
}

function upsertLocalPrayer(prayer: Prayer) {
  const current = loadLocalPrayers({ legacyUserId: prayer.userId });
  saveLocalPrayers([prayer, ...current.filter((item) => item.id !== prayer.id)]);
}

function patchLocalPrayer(prayerId: string, patch: Partial<Prayer>) {
  const current = loadLocalPrayers({});
  saveLocalPrayers(current.map((prayer) => (
    prayer.id === prayerId ? { ...prayer, ...patch } : prayer
  )));
}

function deleteLocalPrayer(prayerId: string) {
  saveLocalPrayers(loadLocalPrayers({}).filter((prayer) => prayer.id !== prayerId));
}

function createLocalPrayer(
  input: { content: string; isAnonymous: boolean; category: PrayerCategory; scriptureReference?: string },
  user: any
): Prayer {
  return {
    id: `local-prayer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: input.content.trim(),
    isAnonymous: input.isAnonymous,
    createdAt: new Date().toISOString(),
    userId: getUserId(user),
    category: input.category,
    isPinned: false,
    isAnswered: false,
    answeredAt: null,
    scriptureReference: input.scriptureReference || null,
    authorName: input.isAnonymous ? '匿名' : getUserName(user),
    authorAvatar: null,
    amenCount: 0,
    isOwner: true,
    hasAmened: false,
  };
}

function normalizePrayer(p: any, user: any): Prayer {
  return applyLocalAmenState({
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
    isOwner: p.userId === user?.legacyUserId || p.userId === user?.id,
    hasAmened: false,
  });
}

export const usePrayerWall = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prayer-wall'],
    queryFn: async () => {
      const localPrayers = loadLocalPrayers(user);
      let remotePrayers: Prayer[] = [];
      try {
        const response = await fetch('/api/prayers');
        if (!response.ok) return localPrayers;
        const data = await response.json();
        remotePrayers = Array.isArray(data)
          ? data.map((p: any) => normalizePrayer(p, user)) as Prayer[]
          : [];
      } catch {
        return localPrayers;
      }

      return [
        ...remotePrayers,
        ...localPrayers.filter((localPrayer) => (
          localPrayer.id.startsWith('local-prayer-')
          || !remotePrayers.some((prayer) => prayer.id === localPrayer.id)
        )),
      ];
    },
    enabled: true,
    refetchInterval: getPollingInterval(HIGH_CONCURRENCY_CONFIG.PRAYER_WALL_POLL_MS),
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

      const prayer = await response.json();
      if (prayer && !Array.isArray(prayer) && typeof prayer === 'object' && prayer.id && prayer.content) {
        return normalizePrayer(prayer, user);
      }

      const localPrayer = createLocalPrayer({ content, isAnonymous, category, scriptureReference }, user);
      upsertLocalPrayer(localPrayer);
      return localPrayer;
    },
    onSuccess: (newPrayer) => {
      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (current = []) => [
        newPrayer,
        ...current.filter((prayer) => prayer.id !== newPrayer.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prayers'] });
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
      if (prayerId.startsWith('local-prayer-')) return prayerId;
      const response = await fetch(`/api/prayers/${prayerId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete prayer');
      return prayerId;
    },
    onSuccess: (prayerId) => {
      if (prayerId.startsWith('local-prayer-')) {
        deleteLocalPrayer(prayerId);
        queryClient.setQueryData<Prayer[]>(['prayer-wall'], (current = []) =>
          current.filter((prayer) => prayer.id !== prayerId)
        );
      }
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
      const nextHasAmened = !hasAmened;
      persistLocalAmen(prayerId, nextHasAmened, hasAmened);

      if (nextHasAmened && !prayerId.startsWith('local-prayer-')) {
        const response = await fetch(`/api/prayers/${prayerId}/amen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: (user as any)?.legacyUserId || user?.id }),
        });
        if (!response.ok) {
          console.warn('Amen saved locally because the server did not accept it.');
        }
      }

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, isPinned }: { prayerId: string; isPinned: boolean }) => {
      const nextIsPinned = !isPinned;

      if (prayerId.startsWith('local-prayer-')) {
        patchLocalPrayer(prayerId, { isPinned: nextIsPinned });
        return { prayerId, isPinned: nextIsPinned, source: 'local' as const };
      }

      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: (user as any)?.legacyUserId || user?.id,
          isPinned: nextIsPinned,
        }),
      });
      if (!response.ok) {
        const currentPrayer = queryClient.getQueryData<Prayer[]>(['prayer-wall'])?.find((prayer) => prayer.id === prayerId);
        if (currentPrayer) upsertLocalPrayer({ ...currentPrayer, isPinned: nextIsPinned });
        return { prayerId, isPinned: nextIsPinned, source: 'local' as const };
      }
      const updated = await response.json();
      deleteLocalPrayer(prayerId);
      return { prayerId, isPinned: updated.isPinned ?? nextIsPinned, source: 'server' as const };
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
    onSuccess: (result) => {
      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === result.prayerId ? { ...prayer, isPinned: result.isPinned } : prayer
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
    },
  });
};

export const useMarkPrayerAnswered = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, isAnswered }: { prayerId: string; isAnswered: boolean }) => {
      const nextIsAnswered = !isAnswered;
      const nextAnsweredAt = nextIsAnswered ? new Date().toISOString() : null;

      if (prayerId.startsWith('local-prayer-')) {
        patchLocalPrayer(prayerId, { isAnswered: nextIsAnswered, answeredAt: nextAnsweredAt });
        return { prayerId, isAnswered: nextIsAnswered, answeredAt: nextAnsweredAt, source: 'local' as const };
      }

      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          userId: (user as any)?.legacyUserId || user?.id,
          isAnswered: nextIsAnswered,
          answeredAt: nextAnsweredAt
        }),
      });
      if (!response.ok) {
        const currentPrayer = queryClient.getQueryData<Prayer[]>(['prayer-wall'])?.find((prayer) => prayer.id === prayerId);
        if (currentPrayer) upsertLocalPrayer({ ...currentPrayer, isAnswered: nextIsAnswered, answeredAt: nextAnsweredAt });
        return { prayerId, isAnswered: nextIsAnswered, answeredAt: nextAnsweredAt, source: 'local' as const };
      }
      const updated = await response.json();
      deleteLocalPrayer(prayerId);
      return {
        prayerId,
        isAnswered: updated.isAnswered ?? nextIsAnswered,
        answeredAt: updated.answeredAt ?? nextAnsweredAt,
        source: 'server' as const,
      };
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
      queryClient.setQueryData<Prayer[]>(['prayer-wall'], (old) =>
        old?.map((prayer) =>
          prayer.id === _.prayerId
            ? { ...prayer, isAnswered: _.isAnswered, answeredAt: _.answeredAt }
            : prayer
        )
      );
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
