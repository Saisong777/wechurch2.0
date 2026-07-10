import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export interface CareContact {
  id: string;
  userId?: string;
  name: string;
  relationship?: string | null;
  need: string;
  nextAction: string;
  prayer: string;
  source?: string;
  isArchived?: boolean;
  lastCaredAt: string | null;
  prayerCount: number;
  lastActionAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CareContactInput {
  name: string;
  relationship?: string | null;
  need?: string;
  nextAction?: string;
  prayer?: string;
}

const STORAGE_KEY = 'wechurch_care_contacts_v1';

const starterContacts: CareContact[] = [
  {
    id: 'starter-1',
    name: '小組新朋友',
    need: '最近剛加入小組，需要有人陪他熟悉群體。',
    nextAction: '這週傳訊息問候，邀請他下次聚會一起坐。',
    prayer: '求主讓他在群體中感到被接納，也找到可以同行的人。',
    lastCaredAt: null,
    prayerCount: 0,
    createdAt: new Date().toISOString(),
  },
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `care-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeContact(contact: Partial<CareContact>): CareContact {
  return {
    id: contact.id || createId(),
    userId: contact.userId,
    name: contact.name || '關懷對象',
    relationship: contact.relationship ?? null,
    need: contact.need || '需要更多了解與陪伴。',
    nextAction: contact.nextAction || '這週主動問候一次。',
    prayer: contact.prayer || '求主讓我用合宜的方式關心他。',
    source: contact.source || 'personal',
    isArchived: contact.isArchived ?? false,
    lastCaredAt: contact.lastCaredAt || null,
    prayerCount: contact.prayerCount || 0,
    lastActionAt: contact.lastActionAt || null,
    createdAt: contact.createdAt || new Date().toISOString(),
    updatedAt: contact.updatedAt,
  };
}

function isCareContactLike(contact: unknown): contact is Partial<CareContact> {
  return !!contact && typeof contact === 'object' && typeof (contact as CareContact).name === 'string';
}

function sortContacts(contacts: CareContact[]) {
  return [...contacts].sort((a, b) => {
    if (!!a.lastCaredAt !== !!b.lastCaredAt) return a.lastCaredAt ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function loadLocalContacts() {
  if (typeof window === 'undefined') return starterContacts;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterContacts));
    return starterContacts;
  }

  try {
    const parsed = JSON.parse(raw);
    return sortContacts(Array.isArray(parsed) ? parsed.map(normalizeContact) : starterContacts);
  } catch {
    return starterContacts;
  }
}

function saveLocalContacts(contacts: CareContact[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortContacts(contacts)));
}

function createLocalContact(input: CareContactInput) {
  return normalizeContact({
    id: createId(),
    name: input.name.trim(),
    relationship: input.relationship || null,
    need: input.need?.trim(),
    nextAction: input.nextAction?.trim(),
    prayer: input.prayer?.trim(),
    lastCaredAt: null,
    prayerCount: 0,
    createdAt: new Date().toISOString(),
  });
}

export function useCareContacts() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['care-contacts', user?.id || 'guest'];

  const contactsQuery = useQuery<CareContact[]>({
    queryKey,
    enabled: !loading,
    retry: false,
    staleTime: 60000,
    queryFn: async () => {
      if (!user) return loadLocalContacts();

      try {
        const response = await fetch('/api/care/contacts', { credentials: 'include' });
        if (!response.ok) return loadLocalContacts();
        const contacts = await response.json();
        if (!Array.isArray(contacts) || !contacts.every(isCareContactLike)) {
          return loadLocalContacts();
        }
        return sortContacts(contacts.map(normalizeContact));
      } catch {
        return loadLocalContacts();
      }
    },
  });

  const setContacts = (updater: (current: CareContact[]) => CareContact[]) => {
    queryClient.setQueryData<CareContact[]>(queryKey, (current = []) => {
      const next = sortContacts(updater(current));
      saveLocalContacts(next);
      return next;
    });
  };

  const createContactMutation = useMutation({
    mutationFn: async (input: CareContactInput) => {
      if (user) {
        try {
          const response = await apiRequest('POST', '/api/care/contacts', input);
          const contact = await response.json();
          if (isCareContactLike(contact)) {
            return normalizeContact(contact);
          }
          return createLocalContact(input);
        } catch {
          return createLocalContact(input);
        }
      }
      return createLocalContact(input);
    },
    onSuccess: (contact) => {
      setContacts((current) => [contact, ...current]);
    },
  });

  const recordActionMutation = useMutation({
    mutationFn: async ({ contactId, actionType, note }: { contactId: string; actionType: string; note?: string }) => {
      if (user) {
        try {
          await apiRequest('POST', `/api/care/contacts/${contactId}/actions`, { actionType, note });
        } catch {
          // Keep the mobile flow responsive in local previews or intermittent offline use.
        }
      }
      return { contactId, actionType };
    },
    onSuccess: ({ contactId, actionType }) => {
      const now = new Date().toISOString();
      setContacts((current) =>
        current.map((contact) => {
          if (contact.id !== contactId) return contact;
          return {
            ...contact,
            lastCaredAt: actionType === 'prayer' ? contact.lastCaredAt : now,
            prayerCount: actionType === 'prayer' ? contact.prayerCount + 1 : contact.prayerCount,
            lastActionAt: now,
          };
        })
      );
    },
  });

  const archiveContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (user) {
        await apiRequest('DELETE', `/api/care/contacts/${contactId}`);
      }
      return contactId;
    },
    onSuccess: (contactId) => {
      setContacts((current) => current.filter((contact) => contact.id !== contactId));
    },
  });

  const resetLocalContacts = () => {
    const contacts = starterContacts.map(normalizeContact);
    saveLocalContacts(contacts);
    queryClient.setQueryData(queryKey, contacts);
  };

  return {
    contacts: contactsQuery.data || [],
    isLoading: contactsQuery.isLoading,
    isLocalMode: !user || (contactsQuery.data || []).some((contact) => !contact.userId),
    createContact: createContactMutation.mutate,
    recordAction: recordActionMutation.mutate,
    archiveContact: archiveContactMutation.mutate,
    resetLocalContacts,
    isCreating: createContactMutation.isPending,
    isRecording: recordActionMutation.isPending,
    isArchiving: archiveContactMutation.isPending,
  };
}
