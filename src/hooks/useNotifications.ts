import { useChurchContext, useChurchScopeKey } from '@/contexts/ChurchContext';
import { churchFetch as fetch } from '@/lib/churchFetch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { NotificationFeed } from '@shared/notifications';

export const notificationsKey = '/api/notifications';
export async function notificationRequest<T>(path = '',body?: unknown): Promise<T> {
  const response = await fetch(notificationsKey+path,{method:body === undefined ? 'GET' : 'POST',credentials:'include',signal:AbortSignal.timeout(15000),
    ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  if (!response.ok) throw new Error(response.status === 404 ? '這則通知已失效，請重新載入。' : '通知暫時無法載入，請重試。');
  return response.json();
}
export function useNotifications(cursor: string | null = null) {
  const { user } = useAuth();
  const church = useChurchContext();
  const scopeKey = useChurchScopeKey();
  return useQuery<NotificationFeed>({queryKey:[notificationsKey,user?.id,cursor,scopeKey],enabled:!!user&&!church?.loading&&(!church||!!church.data?.selectedChurch),
    queryFn:() => notificationRequest(cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''),staleTime:10000,retry:false,
    refetchInterval:30000,refetchIntervalInBackground:false});
}
export function useReadNotification() {
  const client = useQueryClient();
  return useMutation({mutationFn:(input:{id:string} | {before:string}) => 'id' in input ? notificationRequest(`/${input.id}/read`,{}) : notificationRequest('/read-all',input),
    onSuccess:() => client.invalidateQueries({queryKey:[notificationsKey]})});
}
