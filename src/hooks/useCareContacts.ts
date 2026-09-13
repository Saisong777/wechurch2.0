import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';

const contactSchema = z.object({
  id: z.string(), userId: z.string(), name: z.string(),
  relationship: z.string().nullable().optional(), need: z.string(),
  nextAction: z.string(), prayer: z.string(), lastCaredAt: z.string().nullable(),
  prayerCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(), updatedAt: z.string().optional(),
});
export interface CareContact {
  id: string; userId: string; name: string; relationship?: string | null;
  need: string; nextAction: string; prayer: string; lastCaredAt: string | null;
  prayerCount: number; createdAt: string; updatedAt?: string;
}
export interface CareContactInput {
  name: string;
  relationship?: string | null;
  need?: string;
  nextAction?: string;
  prayer?: string;
}
const keyFor = (userId?: string) => ['care-contacts', userId];

export function useCareContacts() {
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: keyFor(user?.id), enabled: !loading && !!user, retry: false, staleTime: 60000,
    queryFn: async () => z.array(contactSchema).parse(await (await apiRequest('GET', '/api/care/contacts')).json()) as CareContact[],
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
      client.setQueryData<CareContact[]>(keyFor(owner), (rows = []) => [contact, ...rows.filter(row => row.id !== contact.id)]);
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
    mutationFn: async ({ contactId, actionType }: { contactId: string; actionType: 'care' | 'prayer' }) => {
      const owner = requireUser();
      await apiRequest('POST', `/api/care/contacts/${encodeURIComponent(contactId)}/actions`, { actionType });
      return owner;
    },
    onSuccess: owner => client.invalidateQueries({ queryKey: keyFor(owner) }),
  });
  const archive = useMutation({
    mutationFn: async (id: string) => {
      const owner = requireUser();
      await apiRequest('DELETE', `/api/care/contacts/${encodeURIComponent(id)}`);
      return { owner, id };
    },
    onSuccess: ({ owner, id }) => {
      client.setQueryData<CareContact[]>(keyFor(owner), (rows = []) => rows.filter(row => row.id !== id));
      void client.invalidateQueries({ queryKey: keyFor(owner) });
    },
  });
  return {
    contacts: user ? query.data || [] : [], isLoading: loading || query.isLoading,
    isError: !!user && query.isError, refetch: query.refetch,
    createContact: create.mutate, updateContact: update.mutate,
    recordAction: record.mutate, archiveContact: archive.mutate,
    isCreating: create.isPending, isUpdating: update.isPending,
    isRecording: record.isPending, isArchiving: archive.isPending,
  };
}
