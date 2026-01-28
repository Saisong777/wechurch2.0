import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SeedResult {
  success: boolean;
  inserted: number;
  requested: number;
  error?: string;
}

interface ClearResult {
  success: boolean;
  deleted: number;
}

/**
 * Hook to seed mock participants for stress testing
 */
export function useSimulateUsers(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (count: number = 50): Promise<SeedResult> => {
      const { data, error } = await supabase.rpc('seed_mock_participants', {
        p_session_id: sessionId,
        p_count: count,
      });

      if (error) throw error;
      return data as unknown as SeedResult;
    },
    onMutate: (count) => {
      toast.loading(`模擬 ${count} 位用戶加入中...`, { id: 'stress-test' });
    },
    onSuccess: (data) => {
      // Invalidate queries to force UI refresh
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['session-participants'] });
      
      toast.success(`成功生成 ${data.inserted} / ${data.requested} 位模擬參與者`, {
        id: 'stress-test',
      });
    },
    onError: (error) => {
      toast.error(`壓力測試失敗: ${error.message}`, { id: 'stress-test' });
    },
  });
}

/**
 * Hook to clear mock participants
 */
export function useClearSimulation(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ClearResult> => {
      const { data, error } = await supabase.rpc('clear_mock_participants', {
        p_session_id: sessionId,
      });

      if (error) throw error;
      return data as unknown as ClearResult;
    },
    onMutate: () => {
      toast.loading('清理模擬資料中...', { id: 'clear-mock' });
    },
    onSuccess: (data) => {
      // Invalidate queries to force UI refresh
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['session-participants'] });
      
      toast.success(`已清除 ${data.deleted} 位模擬參與者`, { id: 'clear-mock' });
    },
    onError: (error) => {
      toast.error(`清理失敗: ${error.message}`, { id: 'clear-mock' });
    },
  });
}
