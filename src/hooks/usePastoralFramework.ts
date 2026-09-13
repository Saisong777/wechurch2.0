import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PastoralFrameworkRequirement {
  id: string;
  stageId: string;
  requirementType: 'condition' | 'participation' | 'course' | 'milestone' | string;
  title: string;
  description: string | null;
  targetCount: number;
  sortOrder: number;
}

export interface PastoralFrameworkStageSummary {
  id: string;
  slug: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  sourceLabel: string | null;
  peopleCount: number;
  requirements: PastoralFrameworkRequirement[];
}

export interface PastoralFrameworkSource {
  label: string;
  detail: string;
  path?: string;
}

export interface PastoralFrameworkOverview {
  schemaReady: boolean;
  stages: PastoralFrameworkStageSummary[];
  sources: PastoralFrameworkSource[];
  message?: string;
}

const churchQuery = (church: string) => `?${new URLSearchParams({ church }).toString()}`;

export function usePastoralFramework(church: string) {
  return useQuery<PastoralFrameworkOverview>({
    queryKey: ['pastoral-framework', church],
    queryFn: async () => {
      const response = await fetch(`/api/pastoral/framework${churchQuery(church)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pastoral framework');
      return response.json();
    },
    retry: false,
  });
}

export function usePastoralFrameworkMutations(church: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pastoral-framework', church] });
    queryClient.invalidateQueries({ queryKey: ['pastoral-persons', church] });
  };

  const seedFramework = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/pastoral/framework/seed-153${churchQuery(church)}`);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const updatePersonStage = useMutation({
    mutationFn: async (input: { personId: string; stageSlug: string; note?: string | null }) => {
      const { personId, ...body } = input;
      const response = await apiRequest('PATCH', `/api/pastoral/persons/${personId}/stage${churchQuery(church)}`, body);
      return response.json();
    },
    onSuccess: invalidate,
  });

  return { seedFramework, updatePersonStage };
}
