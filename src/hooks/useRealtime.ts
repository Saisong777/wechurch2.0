import { useEffect, useCallback, useRef } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";

interface UseRealtimeOptions {
  sessionId: string | null;
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
}

export const useRealtime = ({
  sessionId,
  onParticipantJoined,
  onParticipantUpdated,
  onSessionUpdated,
  onSubmissionAdded,
}: UseRealtimeOptions) => {
  const participantsRef = useRef<Map<string, User>>(new Map());
  const submissionsRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<Partial<Session> | null>(null);

  const pollData = useCallback(async () => {
    if (!sessionId) return;

    try {
      const [participantsRes, sessionRes, submissionsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/participants`),
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/submissions`)
      ]);

      if (participantsRes.ok) {
        const participants = await participantsRes.json();
        participants.forEach((p: any) => {
          const user: User = {
            id: p.id,
            name: p.name,
            email: p.email,
            gender: p.gender as "male" | "female",
            groupNumber: p.groupNumber || undefined,
            joinedAt: new Date(p.joinedAt),
            location: p.location,
            readyConfirmed: p.readyConfirmed,
          };

          const existing = participantsRef.current.get(p.id);
          if (!existing) {
            participantsRef.current.set(p.id, user);
            onParticipantJoined?.(user);
          } else if (JSON.stringify(existing) !== JSON.stringify(user)) {
            participantsRef.current.set(p.id, user);
            onParticipantUpdated?.(user);
          }
        });
      }

      if (sessionRes.ok) {
        const session = await sessionRes.json();
        const sessionData: Partial<Session> = {
          id: session.id,
          verseReference: session.verseReference,
          status: session.status as Session["status"],
        };

        if (sessionRef.current?.status !== sessionData.status) {
          sessionRef.current = sessionData;
          onSessionUpdated?.(sessionData);
        }
      }

      if (submissionsRes.ok) {
        const submissions = await submissionsRes.json();
        submissions.forEach((s: any) => {
          if (!submissionsRef.current.has(s.id)) {
            submissionsRef.current.add(s.id);
            const submission: StudySubmission = {
              id: s.id,
              participantId: s.participantId,
              groupNumber: s.groupNumber,
              name: s.name,
              email: s.email,
              bibleVerse: s.bibleVerse,
              theme: s.theme,
              movingVerse: s.movingVerse,
              factsDiscovered: s.factsDiscovered,
              traditionalExegesis: s.traditionalExegesis,
              inspirationFromGod: s.inspirationFromGod,
              applicationInLife: s.applicationInLife,
              others: s.others,
              submittedAt: new Date(s.submittedAt),
            };
            onSubmissionAdded?.(submission);
          }
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [sessionId, onParticipantJoined, onParticipantUpdated, onSessionUpdated, onSubmissionAdded]);

  useEffect(() => {
    if (!sessionId) return;

    participantsRef.current.clear();
    submissionsRef.current.clear();
    sessionRef.current = null;

    pollData();

    const interval = setInterval(pollData, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, pollData]);
};
