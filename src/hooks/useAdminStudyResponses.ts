import { useQuery } from '@tanstack/react-query';
import { StudyResponsePublic, ProgressStatus } from '@/types/spiritual-fitness';

const POLLING_INTERVAL = 3000;

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

function calculateProgressStatus(response: any): ProgressStatus {
  if (!response) return 'not_started';
  
  if (response.actionPlan || response.coolDownNote) {
    return 'stretching';
  }
  if (response.coreInsightCategory || response.coreInsightNote || response.scholarsNote) {
    return 'heavy_lifting';
  }
  if (response.titlePhrase || response.heartbeatVerse || response.observation) {
    return 'warming_up';
  }
  
  return 'not_started';
}

export function useAdminStudyResponses({ sessionId, enabled = true }: UseAdminStudyResponsesOptions) {
  return useQuery({
    queryKey: ['admin_study_responses', sessionId],
    queryFn: async (): Promise<ParticipantProgress[]> => {
      if (!sessionId) return [];

      const [responsesRes, participantsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/study-responses`),
        fetch(`/api/sessions/${sessionId}/participants`),
      ]);

      if (!responsesRes.ok || !participantsRes.ok) {
        throw new Error('Failed to fetch study data');
      }

      const [responseData, participants] = await Promise.all([
        responsesRes.json(),
        participantsRes.json(),
      ]);

      const responseMap = new Map<string, any>();
      (responseData || []).forEach((r: any) => {
        if (r.userId) responseMap.set(r.userId, r);
      });

      return (participants || []).map((p: any) => {
        const response = responseMap.get(p.id);
        const progressStatus = calculateProgressStatus(response);

        return {
          participantId: p.id,
          participantName: p.name,
          groupNumber: p.groupNumber,
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
