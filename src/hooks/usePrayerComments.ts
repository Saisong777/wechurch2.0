import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PrayerComment, PrayerSticker, COMMENT_LABELS } from '@shared/prayerInteraction';
export type { PrayerComment } from '@shared/prayerInteraction';

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/prayers/${path}`, { method, credentials: 'include', ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '回應尚未完成，請稍後重試。');
  return data;
}
export const usePrayerComments = (prayerId: string, expanded = true) => {
  const { user } = useAuth();
  return useQuery<PrayerComment[]>({
    queryKey: ['prayer-comments', prayerId, user?.id],
    queryFn: () => request(`${prayerId}/comments`),
    enabled: !!user && expanded, refetchInterval: expanded ? 15000 : false, retry: false,
  });
};
function useRefreshComments() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({queryKey:['prayer-comments']});
    await client.invalidateQueries({queryKey:['prayer-wall']});
  };
}
export const useCreateComment = () => {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ prayerId, ...input }: {prayerId:string;content:string;kind?:keyof typeof COMMENT_LABELS;sticker?:PrayerSticker;requestId:string}) => request<PrayerComment>(`${prayerId}/comments`,'POST',input),
    onSuccess: async () => { await refresh(); toast.success('回應已送出'); },
    onError: (e:Error) => toast.error(e.message),
  });
};
export const useDeleteComment = () => {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({commentId,prayerId}:{commentId:string;prayerId:string}) => request(`${prayerId}/comments/${commentId}`,'DELETE'),
    onSuccess: async () => { await refresh(); toast.success('回應已撤回'); },
    onError: (e:Error) => toast.error(e.message),
  });
};
