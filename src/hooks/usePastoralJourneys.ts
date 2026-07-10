import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PastoralPersonSummary {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  church: string | null;
  pastoralStage: string;
  pastoralStatus: string;
  linkCount: number;
  hasUser: boolean;
  hasPotentialMember: boolean;
  hasParticipant: boolean;
  hasCareContact: boolean;
  loveJourneyId: string | null;
  loveJourneyStatus: string | null;
  loveJourneyStartedAt: string | null;
  loveJourneyCompletedAt: string | null;
  completedDays: number;
  totalDays: number;
  needsFollowUpCount: number;
  openTaskCount: number;
}

export interface LoveJourneyProgressDay {
  id: string;
  dayNumber: number;
  title: string;
  scriptureReference: string | null;
  bodyMarkdown: string | null;
  actionPrompt: string | null;
  reflectionPrompt: string | null;
  discussionPrompt: string | null;
  milestoneKey: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  responseText: string | null;
  mentorNote: string | null;
  needsFollowUp: boolean;
  completedAt: string | null;
}

export interface LoveJourneyMilestone {
  id: string;
  milestoneKey: string;
  title: string;
  status: 'planned' | 'scheduled' | 'completed' | 'skipped';
  scheduledAt: string | null;
  completedAt: string | null;
  note: string | null;
}

export interface PastoralTimelineEvent {
  id: string;
  type: 'identity' | 'attendance' | 'study' | 'prayer' | 'care' | 'journey' | 'milestone';
  title: string;
  description: string | null;
  occurredAt: string | null;
  tone: 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';
  sourceId?: string | null;
}

export interface PastoralTask {
  id: string;
  personId: string;
  title: string;
  description: string | null;
  status: 'open' | 'done' | 'deferred' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueAt: string | null;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  visibility: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonMergeSuggestion {
  id: string;
  primaryPersonId: string;
  duplicatePersonId: string;
  primaryName: string;
  duplicateName: string;
  primaryEmail: string | null;
  duplicateEmail: string | null;
  reason: string;
  confidence: number;
  status: string;
}

export interface PastoralPersonDetail {
  schemaReady: boolean;
  access?: {
    canViewPersonal: boolean;
    canManageCare: boolean;
  };
  person: {
    id: string;
    displayName: string;
    primaryEmail: string | null;
    church: string | null;
    pastoralStage: string;
    pastoralStatus: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  links: Array<{
    id: string;
    sourceType: string;
    sourceLabel: string | null;
    userId: string | null;
    participantId: string | null;
    potentialMemberId: string | null;
    careContactId: string | null;
    matchMethod: string;
    confidence: number;
    isPrimary: boolean;
    createdAt: string;
  }>;
  loveJourney: null | {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    nextFollowUpAt: string | null;
    privateNote: string | null;
    slug: string;
    name: string;
    durationDays: number;
    progress: LoveJourneyProgressDay[];
    milestones: LoveJourneyMilestone[];
  };
  timeline: PastoralTimelineEvent[];
  tasks: PastoralTask[];
  seed: {
    template: { slug: string; name: string; durationDays: number };
    days: Array<{ dayNumber: number; title: string; milestoneKey?: string }>;
    milestones: Array<{ milestoneKey: string; title: string; dayNumber: number }>;
  };
}

export interface PastoralPersonsResponse {
  schemaReady: boolean;
  persons: PastoralPersonSummary[];
  page?: { limit: number; offset: number; hasMore: boolean };
  message?: string;
}

const churchQuery = (church: string, extras?: Record<string, string | number | undefined | null>) => {
  const params = new URLSearchParams({ church });
  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return `?${params.toString()}`;
};

export function usePastoralPersons(church: string, options: { search?: string; filter?: string; limit?: number; offset?: number } = {}) {
  return useQuery<PastoralPersonsResponse>({
    queryKey: ['pastoral-persons', church, options.search || '', options.filter || 'all', options.limit || 120, options.offset || 0],
    queryFn: async () => {
      const response = await fetch(`/api/pastoral/persons${churchQuery(church, {
        search: options.search,
        filter: options.filter,
        limit: options.limit ?? 120,
        offset: options.offset ?? 0,
      })}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pastoral persons');
      return response.json();
    },
  });
}

export function usePastoralPersonDetail(personId: string | null, church: string) {
  return useQuery<PastoralPersonDetail>({
    queryKey: ['pastoral-person-detail', personId, church],
    queryFn: async () => {
      const response = await fetch(`/api/pastoral/persons/${personId}${churchQuery(church)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pastoral person detail');
      return response.json();
    },
    enabled: !!personId,
  });
}

export function usePersonMergeSuggestions(church: string) {
  return useQuery<{ schemaReady: boolean; suggestions: PersonMergeSuggestion[] }>({
    queryKey: ['pastoral-merge-suggestions', church],
    queryFn: async () => {
      const response = await fetch(`/api/pastoral/merge-suggestions${churchQuery(church)}`, { credentials: 'include' });
      if (!response.ok) return { schemaReady: true, suggestions: [] };
      return response.json();
    },
    retry: false,
  });
}

export function usePastoralJourneyMutations(church: string) {
  const queryClient = useQueryClient();

  const invalidate = async (personId?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ['pastoral-persons', church] });
    if (personId) {
      await queryClient.invalidateQueries({ queryKey: ['pastoral-person-detail', personId, church] });
    }
  };

  const reconcilePersons = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/pastoral/reconcile${churchQuery(church)}`);
      return response.json();
    },
    onSuccess: () => invalidate(),
  });

  const seedLoveJourney = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/pastoral/journey-templates/love-journey-28/seed');
      return response.json();
    },
    onSuccess: () => invalidate(),
  });

  const startLoveJourney = useMutation({
    mutationFn: async (personId: string) => {
      const response = await apiRequest('POST', `/api/pastoral/persons/${personId}/love-journey/start${churchQuery(church)}`);
      return response.json();
    },
    onSuccess: (_data, personId) => invalidate(personId),
  });

  const createNextStepTask = useMutation({
    mutationFn: async (personId: string) => {
      const response = await apiRequest('POST', `/api/pastoral/persons/${personId}/tasks/next-step${churchQuery(church)}`);
      return { data: await response.json(), personId };
    },
    onSuccess: ({ personId }) => invalidate(personId),
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, personId, updates }: { taskId: string; personId: string; updates: Partial<Pick<PastoralTask, 'status' | 'priority' | 'title' | 'description' | 'dueAt' | 'assignedToUserId'>> }) => {
      const response = await apiRequest('PATCH', `/api/pastoral/tasks/${taskId}${churchQuery(church)}`, updates);
      return { data: await response.json(), personId };
    },
    onSuccess: ({ personId }) => invalidate(personId),
  });

  const dismissMergeSuggestion = useMutation({
    mutationFn: async (input: { primaryPersonId: string; duplicatePersonId: string }) => {
      const response = await apiRequest('POST', '/api/pastoral/merge-suggestions/dismiss', input);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pastoral-merge-suggestions', church] });
    },
  });

  const mergePersons = useMutation({
    mutationFn: async (input: { primaryPersonId: string; duplicatePersonId: string }) => {
      const response = await apiRequest('POST', `/api/pastoral/merge-suggestions/merge${churchQuery(church)}`, input);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pastoral-merge-suggestions', church] });
      queryClient.invalidateQueries({ queryKey: ['pastoral-persons', church] });
    },
  });

  const updateProgress = useMutation({
    mutationFn: async ({
      progressId,
      personId,
      updates,
    }: {
      progressId: string;
      personId: string;
      updates: Partial<Pick<LoveJourneyProgressDay, 'status' | 'responseText' | 'mentorNote' | 'needsFollowUp'>>;
    }) => {
      const response = await apiRequest('PATCH', `/api/pastoral/journey-progress/${progressId}${churchQuery(church)}`, updates);
      return { data: await response.json(), personId };
    },
    onSuccess: ({ personId }) => invalidate(personId),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({
      milestoneId,
      personId,
      updates,
    }: {
      milestoneId: string;
      personId: string;
      updates: Partial<Pick<LoveJourneyMilestone, 'status' | 'note' | 'scheduledAt'>>;
    }) => {
      const response = await apiRequest('PATCH', `/api/pastoral/journey-milestones/${milestoneId}${churchQuery(church)}`, updates);
      return { data: await response.json(), personId };
    },
    onSuccess: ({ personId }) => invalidate(personId),
  });

  return {
    reconcilePersons,
    seedLoveJourney,
    startLoveJourney,
    createNextStepTask,
    updateTask,
    dismissMergeSuggestion,
    mergePersons,
    updateProgress,
    updateMilestone,
  };
}
