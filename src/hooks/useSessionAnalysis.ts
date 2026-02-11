import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { getPollingInterval } from '@/lib/retry-utils';

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
  isParticipant?: boolean;
}

export function useSessionAnalysis({ sessionId, groupNumber, reportType, isParticipant }: UseSessionAnalysisOptions) {
  const queryClient = useQueryClient();
  const queryKey = ['session-analysis', sessionId, reportType, groupNumber, isParticipant];

  const { data: analyses, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<SessionAnalysis[]> => {
      const response = await fetch(`/api/sessions/${sessionId}/reports`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      
      let filtered = data;
      if (reportType) {
        filtered = filtered.filter((r: any) => r.reportType === reportType);
      }
      if (groupNumber !== undefined) {
        filtered = filtered.filter((r: any) => r.groupNumber === groupNumber);
      }

      return filtered.map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        reportType: (r.reportType === 'overall' || r.groupNumber === null || r.groupNumber === 0) 
          ? 'overall' as const 
          : r.reportType as 'group' | 'overall',
        groupNumber: r.groupNumber ?? 0,
        content: r.content,
        status: (r.status || 'COMPLETED') as 'PENDING' | 'COMPLETED' | 'FAILED',
        createdAt: new Date(r.createdAt),
      }));
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.length > 0 && data[0].status === 'PENDING') {
        return getPollingInterval(5000);
      }
      return false;
    },
    staleTime: 1000,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const latestAnalysis = analyses?.[0] || null;
  const isPending = latestAnalysis?.status === 'PENDING';
  const isCompleted = latestAnalysis?.status === 'COMPLETED';
  const isFailed = latestAnalysis?.status === 'FAILED';

  const generateMutation = useMutation({
    mutationFn: async ({ reportType: rt, groupNumber: gn }: { reportType: 'group' | 'overall'; groupNumber?: number }) => {
      const response = await fetch(`/api/sessions/${sessionId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: rt, groupNumber: gn }),
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onMutate: async ({ reportType: rt, groupNumber: gn }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousAnalyses = queryClient.getQueryData<SessionAnalysis[]>(queryKey);
      const optimisticRecord: SessionAnalysis = {
        id: `temp-${Date.now()}`,
        sessionId,
        reportType: rt,
        groupNumber: gn || null,
        content: '生成中...',
        status: 'PENDING',
        createdAt: new Date(),
      };
      queryClient.setQueryData<SessionAnalysis[]>(queryKey, (old) => [optimisticRecord, ...(old || [])]);
      return { previousAnalyses };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAnalyses) {
        queryClient.setQueryData(queryKey, context.previousAnalyses);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const generateAnalysis = useCallback(
    (rt: 'group' | 'overall', gn?: number) => generateMutation.mutateAsync({ reportType: rt, groupNumber: gn }),
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
