import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentVisibility } from './useDocumentVisibility';
import { toast } from 'sonner';
import { useCallback, useEffect, useRef } from 'react';

export interface ParticipantPublic {
  id: string;
  display_name: string;
  gender: string;
  group_number: number | null;
  location: string;
  status: boolean; // ready_confirmed
  session_id: string;
  joined_at: string;
}

interface UseSessionParticipantsOptions {
  sessionId: string | null;
  /** Polling interval in ms (default: 5000) */
  refetchInterval?: number;
  /** Stale time in ms (default: 3000) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Enable visibility-based refresh */
  enableVisibilityRefresh?: boolean;
}

interface ParticipantsResult {
  participants: ParticipantPublic[];
  total_count: number;
}

/**
 * High-concurrency optimized hook for fetching session participants
 * Uses polling instead of realtime for better scalability with 60+ users
 */
export const useSessionParticipants = ({
  sessionId,
  refetchInterval = 5000,
  staleTime = 3000,
  enabled = true,
  enableVisibilityRefresh = true,
}: UseSessionParticipantsOptions) => {
  const queryClient = useQueryClient();
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const queryKey = ['participants', sessionId];

  // Fetch participants using the optimized RPC function
  const fetchParticipants = async (): Promise<ParticipantsResult> => {
    if (!sessionId) {
      return { participants: [], total_count: 0 };
    }

    const { data, error } = await supabase
      .rpc('get_session_participants', { p_session_id: sessionId });

    if (error) {
      console.error('[useSessionParticipants] RPC error:', error);
      throw error;
    }

    // Handle the JSON response from RPC
    const result = data as unknown as ParticipantsResult;
    if (!result || typeof result !== 'object') {
      return { participants: [], total_count: 0 };
    }

    // Reset retry count on success
    retryCountRef.current = 0;

    return result;
  };

  const query = useQuery({
    queryKey,
    queryFn: fetchParticipants,
    enabled: enabled && !!sessionId,
    refetchInterval,
    staleTime,
    refetchOnWindowFocus: false, // We handle this with useDocumentVisibility
    retry: (failureCount, error) => {
      // Custom retry logic with backoff
      if (failureCount >= maxRetries) {
        return false;
      }
      retryCountRef.current = failureCount;
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Show toast on error with auto-retry indication
  useEffect(() => {
    if (query.error && retryCountRef.current < maxRetries) {
      toast.error('連線繁忙中，自動重試...', {
        id: 'participants-error',
        duration: 3000,
      });
    }
  }, [query.error]);

  // Document visibility handling for mobile wake-up
  useDocumentVisibility({
    queryKeys: [queryKey],
    enabled: enableVisibilityRefresh && !!sessionId,
    minHiddenTime: 2000,
    onVisible: () => {
      console.log('[useSessionParticipants] Tab visible, refreshing participants');
    },
  });

  // Manual refetch with toast feedback
  const refetchWithFeedback = useCallback(async () => {
    try {
      await query.refetch();
      toast.success('已更新參與者列表', { duration: 1500 });
    } catch (error) {
      toast.error('更新失敗，請稍後重試');
    }
  }, [query]);

  // Force refresh function for admin broadcast
  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    participants: query.data?.participants ?? [],
    totalCount: query.data?.total_count ?? 0,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    refetchWithFeedback,
    forceRefresh,
  };
};

// Helper to listen for admin force refresh broadcasts
export const useAdminForceRefresh = (
  sessionId: string | null,
  onForceRefresh: () => void
) => {
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`system_messages_${sessionId}`)
      .on('broadcast', { event: 'force_refresh' }, () => {
        console.log('[useAdminForceRefresh] Received force_refresh broadcast');
        onForceRefresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, onForceRefresh]);
};
