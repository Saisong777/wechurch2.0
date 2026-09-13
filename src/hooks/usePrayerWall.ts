import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PrayerReaction } from '@shared/prayerInteraction';

export type PrayerCategory = 'thanksgiving' | 'supplication' | 'praise' | 'other';
export const CATEGORY_LABELS: Record<PrayerCategory,string> = { thanksgiving: '感恩', supplication: '代求', praise: '讚美', other: '其他' };
export interface Prayer {
  id: string; content: string; isAnonymous: boolean; createdAt: string; userId: string | null;
  category: PrayerCategory; isPinned: boolean; isAnswered: boolean; answeredAt: string | null;
  scriptureReference: string | null; authorName: string; authorAvatar: string | null;
  amenCount: number; isOwner: boolean; hasAmened: boolean;
  isUrgent?: boolean; commentCount?: number; reactions?: {kind:PrayerReaction;count:number;selected:boolean}[];
  closedAt?: string | null;
}
async function request<T>(path: string, method='GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/prayers${path}`, { method, credentials: 'include', ...(body === undefined ? {} : { headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error('禱告操作尚未完成，請稍後重試');
  return response.json();
}
export const usePrayerWall = (mine = false) => {
  const { user } = useAuth();
  return useQuery<Prayer[]>({ queryKey:['prayer-wall',user?.id,mine?'mine':'active'], enabled:!!user, queryFn:() => request(mine?'?view=my':''), refetchInterval:15000, retry:false });
};
function useRefreshWall() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey:['prayer-wall'] });
    await client.invalidateQueries({ queryKey:['/api/prayer-sharing'] });
    await client.invalidateQueries({ queryKey:['/api/prayers'] });
  };
}
export const useCreatePrayer = () => {
  const refresh = useRefreshWall();
  return useMutation({
    mutationFn:(input: { content:string; isAnonymous:boolean; isUrgent?:boolean; category:PrayerCategory; scriptureReference?:string }) => request<Prayer>('', 'POST', input),
    onSuccess:async () => { await refresh(); toast.success('已分享到公共禱告牆'); },
    onError:() => toast.error('發布失敗，請保留文字後重試'),
  });
};
export const useDeletePrayer = () => {
  const refresh = useRefreshWall();
  return useMutation({ mutationFn:(id:string) => request(`/${id}`,'DELETE'), onSuccess:refresh, onError:() => toast.error('尚未刪除，請重試') });
};
export const useToggleAmen = () => {
  const refresh = useRefreshWall();
  return useMutation({
    mutationFn:({ prayerId,hasAmened }: { prayerId:string; hasAmened:boolean }) => hasAmened ? Promise.resolve() : request(`/${prayerId}/amen`,'POST',{}),
    onSuccess:refresh, onError:() => toast.error('代禱回應尚未送出，請重試'),
  });
};
export const useTogglePinPrayer = () => {
  const refresh = useRefreshWall();
  return useMutation({ mutationFn:({ prayerId,isPinned }: { prayerId:string; isPinned:boolean }) => request(`/${prayerId}`,'PATCH',{isPinned:!isPinned}), onSuccess:refresh, onError:() => toast.error('尚未更新，請重試') });
};
export const useMarkPrayerAnswered = () => {
  const refresh = useRefreshWall();
  return useMutation({ mutationFn:({ prayerId,isAnswered }: { prayerId:string; isAnswered:boolean }) => request(`/${prayerId}`,'PATCH',{isAnswered:!isAnswered}), onSuccess:refresh, onError:() => toast.error('尚未更新，請重試') });
};
export const usePrayerReaction = () => {
  const refresh = useRefreshWall();
  return useMutation({ mutationFn:({prayerId,kind,selected}:{prayerId:string;kind:PrayerReaction;selected:boolean})=>request(`/${prayerId}/reactions/${kind}`,'PUT',{selected}),onSuccess:refresh,onError:()=>toast.error('回應尚未更新，請重試') });
};
export const useUrgentPrayer = () => {
  const refresh = useRefreshWall();
  return useMutation({ mutationFn:({prayerId,isUrgent}:{prayerId:string;isUrgent:boolean})=>request(`/${prayerId}`,'PATCH',{isUrgent}),onSuccess:refresh,onError:()=>toast.error('緊急標記尚未更新，請重試') });
};
export const useClosePrayer = () => {
  const refresh = useRefreshWall();
  return useMutation({mutationFn:({prayerId,isClosed}:{prayerId:string;isClosed:boolean})=>request(`/${prayerId}`,'PATCH',{isClosed}),onSuccess:refresh,onError:()=>toast.error('代禱狀態尚未更新，請重試')});
};
