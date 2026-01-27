import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudyResponsePublic, ProgressStatus } from '@/types/spiritual-fitness';

const POLLING_INTERVAL = 4000; // 4 seconds

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

export function useAdminStudyResponses({ sessionId, enabled = true }: UseAdminStudyResponsesOptions) {
  return useQuery({
    queryKey: ['admin_study_responses', sessionId],
    queryFn: async (): Promise<ParticipantProgress[]> => {
      if (!sessionId) return [];

      // Get all participants for this session
      const { data: participants, error: pError } = await supabase
        .from('participants')
        .select('id, name, group_number')
        .eq('session_id', sessionId)
        .order('group_number', { ascending: true });

      if (pError) throw pError;

      // Get all study responses for this session
      const { data: responses, error: rError } = await supabase
        .from('study_responses')
        .select('*')
        .eq('session_id', sessionId);

      if (rError) throw rError;

      // Map participants to their progress
      return (participants || []).map((p) => {
        const response = responses?.find(r => {
          // Match by checking if we can find the participant
          // Note: This is a simplified match - in production you'd want a proper user_id link
          return true; // We'll handle this with the view in production
        }) || null;

        // Calculate progress status
        let progressStatus: ProgressStatus = 'not_started';
        if (response) {
          if (response.action_plan || response.cool_down_note) {
            progressStatus = 'stretching';
          } else if (response.core_insight_category || response.scholars_note) {
            progressStatus = 'heavy_lifting';
          } else if (response.title_phrase || response.heartbeat_verse || response.observation) {
            progressStatus = 'warming_up';
          }
        }

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
