import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchScopeKey } from '@/contexts/ChurchContext';
import { churchFetch } from '@/lib/churchFetch';
import type { AccessTemplate } from '@shared/accessControl';

// Share the unchanged, director-only snapshot with both management forms.
export function useAccessControlAdmin<T extends { roles: AccessTemplate[] }>(enabled: boolean) {
  const { user } = useAuth();
  const scopeKey = useChurchScopeKey();
  return useQuery<T>({
    queryKey: ['access-control-admin', user?.id, scopeKey],
    enabled: !!user && enabled,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await churchFetch('/api/access-control', { signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '無法載入職分設定');
      return result;
    },
  });
}
