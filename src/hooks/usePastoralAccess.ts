import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

// Appointment-based leaders must have an entry even if their account role is still member.
export function usePastoralAccess() {
  const { user } = useAuth();
  return useQuery<{ available: boolean }>({
    queryKey: ['/api/life-groups/dashboard/access', user?.id], enabled: !!user,
    queryFn: async ({ signal }) => {
      const r = await fetch('/api/life-groups/dashboard/access', { credentials: 'include', cache: 'no-store', signal });
      if (!r.ok) throw new Error('無法讀取牧養範圍');
      return r.json();
    }, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: true,
  });
}
