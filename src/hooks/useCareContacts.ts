import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { careToday, type careActionInput } from '@shared/care';

const contactSchema = z.object({
  id: z.string(), userId: z.string(), name: z.string(),
  relationship: z.string().nullable().optional(), need: z.string(),
  nextAction: z.string(), prayer: z.string(), lastCaredAt: z.string().nullable(),
  prayerCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(), updatedAt: z.string().optional(),
  nextCareDate: z.string().nullable().optional(), isArchived: z.boolean().optional(),
});
export interface CareContact {
  id: string; userId: string; name: string; relationship?: string | null;
  need: string; nextAction: string; prayer: string; lastCaredAt: string | null;
  prayerCount: number; createdAt: string; updatedAt?: string;
  nextCareDate?: string | null; isArchived?: boolean;
}
export interface CareContactInput {
  name: string;
  relationship?: string | null;
  need?: string;
  nextAction?: string;
  prayer?: string;
  nextCareDate?: string | null;
  isArchived?: boolean;
}
const keyFor = (userId?: string) => ['care-contacts', userId];

export function useCareContacts(includeArchived = false) {
  const { user, loading } = useAuth();
  const [today, setToday] = useState(careToday);
  useEffect(() => {
    if (!user) return;
    const refresh = () => setToday(careToday());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user]);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...keyFor(user?.id), includeArchived], enabled: !loading && !!user, retry: false, staleTime: 60000,
    queryFn: async () => z.array(contactSchema).parse(await (await apiRequest('GET', `/api/care/contacts${includeArchived ? '?includeArchived=1' : ''}`)).json()) as CareContact[],
  });
  const requireUser = () => {
    if (!user) throw new Error('請先登入');
    return user.id;
  };
  const create = useMutation({
    mutationFn: async (input: CareContactInput) => {
      const owner = requireUser();
      const contact = contactSchema.parse(await (await apiRequest('POST', '/api/care/contacts', input)).json()) as CareContact;
      return { owner, contact };
    },
    onSuccess: ({ owner, contact }) => {
      client.setQueryData<CareContact[]>([...keyFor(owner), includeArchived], (rows = []) => [contact, ...rows.filter(row => row.id !== contact.id)]);
      void client.invalidateQueries({ queryKey: keyFor(owner) });
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CareContactInput }) => {
      const owner = requireUser();
      await apiRequest('PATCH', `/api/care/contacts/${encodeURIComponent(id)}`, input);
      return owner;
    },
    onSuccess: owner => client.invalidateQueries({ queryKey: keyFor(owner) }),
  });
  const record = useMutation({
    mutationFn: async ({ contactId, ...input }: { contactId: string } & z.infer<typeof careActionInput>) => {
      const owner = requireUser();
      await apiRequest('POST', `/api/care/contacts/${encodeURIComponent(contactId)}/actions`, input);
      return { owner, contactId };
    },
    onSuccess: async ({ owner, contactId }) => {
      await client.invalidateQueries({ queryKey: keyFor(owner) });
      await client.invalidateQueries({ queryKey: ['care-history', owner, contactId] });
    },
  });
  const archive = useMutation({
    mutationFn: async (id: string) => {
      const owner = requireUser();
      await apiRequest('DELETE', `/api/care/contacts/${encodeURIComponent(id)}`);
      return { owner, id };
    },
    onSuccess: ({ owner, id }) => {
      client.setQueryData<CareContact[]>([...keyFor(owner), includeArchived], (rows = []) => includeArchived ? rows.map(row => row.id === id ? { ...row, isArchived: true } : row) : rows.filter(row => row.id !== id));
      void client.invalidateQueries({ queryKey: keyFor(owner) });
    },
  });
  return {
    today,
    contacts: user ? query.data || [] : [], isLoading: loading || query.isLoading,
    isError: !!user && query.isError, refetch: query.refetch,
    createContact: create.mutate, updateContact: update.mutate,
    recordAction: record.mutate, archiveContact: archive.mutate,
    isCreating: create.isPending, isUpdating: update.isPending,
    isRecording: record.isPending, isArchiving: archive.isPending,
  };
}

export function useCareHistory(contactId: string, enabled: boolean) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['care-history', user?.id, contactId], enabled: !!user && enabled, initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const data = await (await apiRequest('GET', `/api/care/contacts/${encodeURIComponent(contactId)}/actions?offset=${pageParam}`)).json();
      return z.object({ actions: z.array(z.object({ id: z.string(), actionType: z.string(), note: z.string().nullable(), createdAt: z.string() })), hasMore: z.boolean() }).parse(data);
    },
    getNextPageParam: (last, pages) => last.hasMore ? pages.length * 30 : undefined,
  });
}
