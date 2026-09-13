import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import type { PersonalPrayer, PersonalPrayerInput } from '@shared/personalPrayer';

export function usePersonalPrayers() {
  const { user } = useAuth();
  const client = useQueryClient();
  const queryKey = ['/api/personal-prayers', user?.id];
  const query = useQuery<PersonalPrayer[]>({
    queryKey,
    enabled: !!user,
    queryFn: async () => (await apiRequest('GET', '/api/personal-prayers')).json(),
  });
  const save = useMutation({
    mutationFn: async ({ id, input, create = false }: { id: string; input: PersonalPrayerInput; create?: boolean }): Promise<PersonalPrayer> => {
      if (!user) throw new Error('請先登入');
      return (await apiRequest(create ? 'PUT' : 'PATCH', `/api/personal-prayers/${encodeURIComponent(id)}`, input)).json();
    },
    onSuccess: saved => {
      client.setQueryData<PersonalPrayer[]>(queryKey, (current = []) => [saved, ...current.filter(p => p.id !== saved.id)]);
      client.invalidateQueries({ queryKey: ['/api/personal-prayers'] });
    },
  });
  return { ...query, save };
}
