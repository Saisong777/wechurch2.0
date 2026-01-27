import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudyResponsePublic, ProgressStatus } from '@/types/spiritual-fitness';

const POLLING_INTERVAL = 3000; // 3 seconds for faster updates

interface UseAdminStudyResponsesOptions {
  sessionId: string | undefined;
  enabled?: boolean;
}

export interface ParticipantProgress {
  participantId: string;
  participantName: string;
  groupNumber: number | null;
  progressStatus: ProgressStatus;
  response: StudyResponsePublic | null;
}

/**
 * Determine progress status based on filled fields
 */
function calculateProgressStatus(response: any): ProgressStatus {
  if (!response) return 'not_started';
  
  // Check Phase 3 (stretching/cooldown)
  if (response.action_plan || response.cool_down_note) {
    return 'stretching';
  }
  // Check Phase 2 (heavy lifting)
  if (response.core_insight_category || response.core_insight_note || response.scholars_note) {
    return 'heavy_lifting';
  }
  // Check Phase 1 (warming up)
  if (response.title_phrase || response.heartbeat_verse || response.observation) {
    return 'warming_up';
  }
  
  return 'not_started';
}

export function useAdminStudyResponses({ sessionId, enabled = true }: UseAdminStudyResponsesOptions) {
  return useQuery({
    queryKey: ['admin_study_responses', sessionId],
    queryFn: async (): Promise<ParticipantProgress[]> => {
      if (!sessionId) return [];

      // Use the study_responses_public view which joins with participants
      const { data: responseData, error: rError } = await supabase
        .from('study_responses_public')
        .select('*')
        .eq('session_id', sessionId);

      if (rError) throw rError;

      // Get all participants for this session (to include those who haven't started)
      const { data: participants, error: pError } = await supabase
        .from('participants')
        .select('id, name, group_number')
        .eq('session_id', sessionId)
        .order('group_number', { ascending: true });

      if (pError) throw pError;

      // Create a map of responses by user_id for quick lookup
      const responseMap = new Map<string, any>();
      (responseData || []).forEach(r => {
        if (r.user_id) responseMap.set(r.user_id, r);
      });

      // Map participants to their progress
      return (participants || []).map((p) => {
        const response = responseMap.get(p.id);
        const progressStatus = calculateProgressStatus(response);

        return {
          participantId: p.id,
          participantName: p.name,
          groupNumber: p.group_number,
          progressStatus,
          response: response as StudyResponsePublic | null,
        };
      });
    },
    enabled: enabled && !!sessionId,
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL - 500,
  });
}
