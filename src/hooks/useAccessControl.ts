import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { MyAccess } from '@shared/accessControl';

export function useAccessControl() {
  const { user } = useAuth();
  return useQuery<MyAccess>({
    queryKey: ['access-control-me',user?.id], enabled: !!user, staleTime: 0, gcTime: 0,
    refetchInterval: 30_000, refetchOnWindowFocus: true, retry: false,
    queryFn: async ({signal}) => {
      const res=await fetch('/api/access-control/me',{signal,cache:'no-store'});
      if(!res.ok)throw new Error('無法確認授權');return res.json();
    },
  });
}
