import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface FacilityRoomSummary {
  id: string;
  church: string | null;
  name: string;
  category: string;
  location: string | null;
  capacity: number;
  description: string | null;
  priority: number;
  isActive: boolean;
  upcomingBookingCount: number;
}

export interface FacilityBookingSummary {
  id: string;
  roomId: string;
  roomName: string;
  church: string | null;
  title: string;
  purpose: string;
  requesterPersonId: string | null;
  requesterName: string | null;
  requesterUserId: string | null;
  startAt: string;
  endAt: string;
  status: string;
  priority: number;
  note: string | null;
  conflictCount: number;
}

export interface FacilityOverview {
  schemaReady: boolean;
  rooms: FacilityRoomSummary[];
  bookings: FacilityBookingSummary[];
  message?: string;
}

export class FacilityConflictClientError extends Error {
  conflicts: FacilityBookingSummary[];

  constructor(conflicts: FacilityBookingSummary[]) {
    super('Facility booking conflict');
    this.conflicts = conflicts;
  }
}

const churchQuery = (church: string) => `?${new URLSearchParams({ church }).toString()}`;

export function useFacilityBookings(church: string) {
  return useQuery<FacilityOverview>({
    queryKey: ['facility-bookings', church],
    queryFn: async () => {
      const response = await fetch(`/api/facilities/overview${churchQuery(church)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch facility bookings');
      return response.json();
    },
    retry: false,
  });
}

export function useFacilityBookingMutations(church: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['facility-bookings', church] });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/facilities/seed-defaults${churchQuery(church)}`);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createRoom = useMutation({
    mutationFn: async (input: { name: string; category?: string; location?: string | null; capacity?: number; description?: string | null; priority?: number }) => {
      const response = await apiRequest('POST', `/api/facilities/rooms${churchQuery(church)}`, input);
      return response.json();
    },
    onSuccess: invalidate,
  });

  const createBooking = useMutation({
    mutationFn: async (input: {
      roomId: string;
      title: string;
      purpose?: string;
      requesterPersonId?: string | null;
      startAt: string;
      endAt: string;
      priority?: number;
      note?: string | null;
      allowConflict?: boolean;
    }) => {
      const response = await fetch(`/api/facilities/bookings${churchQuery(church)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (response.status === 409) {
        const data = await response.json();
        if (Array.isArray(data.conflicts)) throw new FacilityConflictClientError(data.conflicts);
      }
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: invalidate,
  });

  const updateBookingStatus = useMutation({
    mutationFn: async (input: { bookingId: string; status: string }) => {
      const response = await apiRequest('PATCH', `/api/facilities/bookings/${input.bookingId}/status${churchQuery(church)}`, { status: input.status });
      return response.json();
    },
    onSuccess: invalidate,
  });

  return {
    seedDefaults,
    createRoom,
    createBooking,
    updateBookingStatus,
  };
}
