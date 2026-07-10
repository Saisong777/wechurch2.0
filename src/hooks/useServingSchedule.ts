import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ServingTeamSummary {
  id: string;
  church: string | null;
  name: string;
  category: string;
  description: string | null;
  leaderUserId: string | null;
  leaderName: string | null;
  defaultLocation: string | null;
  defaultStartTime: string | null;
  isActive: boolean;
  roleCount: number;
  memberCount: number;
  upcomingEventCount: number;
}

export interface ServingRoleSummary {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  requiredCount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ServingMemberSummary {
  id: string;
  teamId: string;
  personId: string;
  userId: string | null;
  displayName: string;
  primaryEmail: string | null;
  roleLabel: string;
  status: string;
}

export interface ServingAssignmentSummary {
  id: string;
  eventId: string;
  roleId: string;
  roleName: string;
  personId: string;
  userId: string | null;
  displayName: string;
  primaryEmail: string | null;
  status: string;
  note: string | null;
  confirmedAt: string | null;
}

export interface ServingEventSummary {
  id: string;
  teamId: string;
  title: string;
  serviceDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: string;
  note: string | null;
  requiredCount: number;
  assignedCount: number;
  confirmedCount: number;
  gapCount: number;
  assignments: ServingAssignmentSummary[];
}

export interface ServingAssignablePerson {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  church: string | null;
  hasUser: boolean;
}

export interface ServingScheduleOverview {
  schemaReady: boolean;
  teams: ServingTeamSummary[];
  roles: ServingRoleSummary[];
  members: ServingMemberSummary[];
  events: ServingEventSummary[];
  people: ServingAssignablePerson[];
  message?: string;
}

const churchQuery = (church: string) => {
  const params = new URLSearchParams({ church });
  return `?${params.toString()}`;
};

export function useServingSchedule(church: string) {
  return useQuery<ServingScheduleOverview>({
    queryKey: ['serving-schedule', church],
    queryFn: async () => {
      const response = await fetch(`/api/serving/overview${churchQuery(church)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch serving schedule');
      return response.json();
    },
    retry: false,
  });
}

export function useServingScheduleMutations(church: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['serving-schedule', church] });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/serving/seed-defaults${churchQuery(church)}`);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createTeam = useMutation({
    mutationFn: async (input: { name: string; category?: string; description?: string | null; defaultLocation?: string | null; defaultStartTime?: string | null }) => {
      const response = await apiRequest('POST', `/api/serving/teams${churchQuery(church)}`, input);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createRole = useMutation({
    mutationFn: async (input: { teamId: string; name: string; requiredCount?: number; sortOrder?: number; description?: string | null }) => {
      const { teamId, ...body } = input;
      const response = await apiRequest('POST', `/api/serving/teams/${teamId}/roles${churchQuery(church)}`, body);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const addMember = useMutation({
    mutationFn: async (input: { teamId: string; personId: string; roleLabel?: string; note?: string | null }) => {
      const { teamId, ...body } = input;
      const response = await apiRequest('POST', `/api/serving/teams/${teamId}/members${churchQuery(church)}`, body);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createEvent = useMutation({
    mutationFn: async (input: { teamId: string; title: string; serviceDate: string; startTime?: string | null; endTime?: string | null; location?: string | null; note?: string | null }) => {
      const { teamId, ...body } = input;
      const response = await apiRequest('POST', `/api/serving/teams/${teamId}/events${churchQuery(church)}`, body);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createAssignment = useMutation({
    mutationFn: async (input: { eventId: string; roleId: string; personId: string; status?: string; note?: string | null }) => {
      const response = await apiRequest('POST', `/api/serving/assignments${churchQuery(church)}`, input);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const updateAssignment = useMutation({
    mutationFn: async (input: { assignmentId: string; status?: string; note?: string | null }) => {
      const { assignmentId, ...body } = input;
      const response = await apiRequest('PATCH', `/api/serving/assignments/${assignmentId}${churchQuery(church)}`, body);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const updateEventStatus = useMutation({
    mutationFn: async (input: { eventId: string; status: string }) => {
      const response = await apiRequest('PATCH', `/api/serving/events/${input.eventId}/status${churchQuery(church)}`, { status: input.status });
      return response.json();
    },
    onSuccess: invalidate,
  });

  return {
    seedDefaults,
    createTeam,
    createRole,
    addMember,
    createEvent,
    createAssignment,
    updateAssignment,
    updateEventStatus,
  };
}
