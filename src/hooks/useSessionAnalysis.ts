import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useCallback } from 'react';

export interface SessionAnalysis {
  id: string;
  sessionId: string;
  reportType: 'group' | 'overall';
  groupNumber: number | null;
  content: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
}

interface UseSessionAnalysisOptions {
  sessionId: string;
  groupNumber?: number;
  reportType?: 'group' | 'overall';
  /** Set to true for participant access (uses edge function to bypass RLS) */
  isParticipant?: boolean;
}

export function useSessionAnalysis({ sessionId, groupNumber, reportType, isParticipant }: UseSessionAnalysisOptions) {
  const queryClient = useQueryClient();

  const queryKey = ['session-analysis', sessionId, reportType, groupNumber, isParticipant];

  const { data: analyses, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<SessionAnalysis[]> => {
      // For participants, use edge function to bypass RLS
      if (isParticipant && reportType === 'group' && groupNumber !== undefined) {
        const participantEmail = localStorage.getItem('bible_study_guest_email');
        
        if (!participantEmail) {
          console.log('[useSessionAnalysis] No participant email found');
          return [];
        }

        const { data, error: fnError } = await supabase.functions.invoke('get-group-report', {
          body: {
            sessionId,
            groupNumber,
            participantEmail,
          },
        });

        if (fnError) {
          console.error('[useSessionAnalysis] Edge function error:', fnError);
          throw fnError;
        }

        if (data?.error) {
          console.error('[useSessionAnalysis] Edge function returned error:', data.error);
          return [];
        }

        return (data?.reports || []).map((r: any) => ({
          id: r.id,
          sessionId: r.session_id,
          reportType: r.report_type as 'group' | 'overall',
          // Normalize: null group_number means overall report (treat as 0)
          groupNumber: r.group_number ?? 0,
          content: r.content,
          status: (r.status || 'COMPLETED') as 'PENDING' | 'COMPLETED' | 'FAILED',
          createdAt: new Date(r.created_at),
        }));
      }

      // For admin/owner, use direct query
      let query = supabase
        .from('ai_reports')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      if (groupNumber !== undefined) {
        query = query.eq('group_number', groupNumber);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useSessionAnalysis] Error:', error);
        throw error;
      }

      return (data || []).map(r => ({
        id: r.id,
        sessionId: r.session_id,
        reportType: r.report_type as 'group' | 'overall',
        // Normalize: null group_number means overall report (treat as 0)
        groupNumber: r.group_number ?? 0,
        content: r.content,
        status: (r.status || 'COMPLETED') as 'PENDING' | 'COMPLETED' | 'FAILED',
        createdAt: new Date(r.created_at),
      }));
    },
    enabled: !!sessionId,
    // Polling: if latest is PENDING, poll every 3 seconds
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.length > 0 && data[0].status === 'PENDING') {
        return 3000;
      }
      return false;
    },
    staleTime: 1000,
  });

  // Wake-up handler: refetch when document becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);

  // Get latest analysis
  const latestAnalysis = analyses?.[0] || null;
  const isPending = latestAnalysis?.status === 'PENDING';
  const isCompleted = latestAnalysis?.status === 'COMPLETED';
  const isFailed = latestAnalysis?.status === 'FAILED';

  // Generate analysis mutation
  const generateMutation = useMutation({
    mutationFn: async ({ 
      reportType: rt, 
      groupNumber: gn 
    }: { 
      reportType: 'group' | 'overall'; 
      groupNumber?: number 
    }) => {
      const { data, error } = await supabase.functions.invoke('analyze-notes', {
        body: { 
          sessionId, 
          reportType: rt, 
          groupNumber: gn 
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate analysis');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onMutate: async ({ reportType: rt, groupNumber: gn }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousAnalyses = queryClient.getQueryData<SessionAnalysis[]>(queryKey);

      // Optimistically add a PENDING record
      const optimisticRecord: SessionAnalysis = {
        id: `temp-${Date.now()}`,
        sessionId,
        reportType: rt,
        groupNumber: gn || null,
        content: '生成中...',
        status: 'PENDING',
        createdAt: new Date(),
      };

      queryClient.setQueryData<SessionAnalysis[]>(queryKey, (old) => {
        return [optimisticRecord, ...(old || [])];
      });

      return { previousAnalyses };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousAnalyses) {
        queryClient.setQueryData(queryKey, context.previousAnalyses);
      }
    },
    onSettled: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const generateAnalysis = useCallback(
    (rt: 'group' | 'overall', gn?: number) => {
      return generateMutation.mutateAsync({ reportType: rt, groupNumber: gn });
    },
    [generateMutation]
  );

  return {
    analyses: analyses || [],
    latestAnalysis,
    isLoading,
    error,
    isPending,
    isCompleted,
    isFailed,
    isGenerating: generateMutation.isPending,
    generateAnalysis,
    refetch,
  };
}
