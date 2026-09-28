import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export const familyBase = '/api/life-groups';
export async function familyRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(familyBase + path, { method, credentials: 'include', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '未完成，請重試。');
  return data;
}
export function useFamilyQuery<T>(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery<T>({ queryKey: [familyBase, user?.id, path], queryFn: () => familyRequest<T>(path), enabled: !!user && enabled, staleTime: 15000, refetchInterval: 60000, retry: false });
}
export const familySelectClass = 'min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm';
