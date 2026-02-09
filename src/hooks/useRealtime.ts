import { useEffect, useCallback, useRef } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";

export type RealtimePhase = 'waiting' | 'grouping' | 'studying' | 'all';

interface UseRealtimeOptions {
  sessionId: string | null;
  phase?: RealtimePhase;
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
}

export const useRealtime = ({
  sessionId,
  phase = 'all',
  onParticipantJoined,
  onParticipantUpdated,
  onSessionUpdated,
  onSubmissionAdded,
}: UseRealtimeOptions) => {
  const participantsRef = useRef<Map<string, User>>(new Map());
  const submissionsRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<Partial<Session> | null>(null);

  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantUpdatedRef = useRef(onParticipantUpdated);
  const onSessionUpdatedRef = useRef(onSessionUpdated);
  const onSubmissionAddedRef = useRef(onSubmissionAdded);
  const phaseRef = useRef(phase);

  useEffect(() => { onParticipantJoinedRef.current = onParticipantJoined; }, [onParticipantJoined]);
  useEffect(() => { onParticipantUpdatedRef.current = onParticipantUpdated; }, [onParticipantUpdated]);
  useEffect(() => { onSessionUpdatedRef.current = onSessionUpdated; }, [onSessionUpdated]);
  useEffect(() => { onSubmissionAddedRef.current = onSubmissionAdded; }, [onSubmissionAdded]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const pollData = useCallback(async () => {
    if (!sessionId) return;

    const currentPhase = phaseRef.current;

    try {
      const shouldFetchParticipants = currentPhase !== 'waiting';
      const shouldFetchSubmissions = currentPhase === 'studying' || currentPhase === 'all';

      const fetches: Promise<Response>[] = [
        fetch(`/api/sessions/${sessionId}`),
      ];

      if (shouldFetchParticipants) {
        fetches.push(fetch(`/api/sessions/${sessionId}/participants`));
      }

      if (shouldFetchSubmissions) {
        fetches.push(fetch(`/api/sessions/${sessionId}/submissions`));
      }

      const results = await Promise.all(fetches);

      const sessionRes = results[0];
      const participantsRes = shouldFetchParticipants ? results[1] : null;
      const submissionsRes = shouldFetchSubmissions ? results[shouldFetchParticipants ? 2 : 1] : null;

      if (participantsRes?.ok) {
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
            onParticipantJoinedRef.current?.(user);
          } else if (
            existing.groupNumber !== user.groupNumber ||
            existing.readyConfirmed !== user.readyConfirmed ||
            existing.name !== user.name ||
            existing.location !== user.location
          ) {
            participantsRef.current.set(p.id, user);
            onParticipantUpdatedRef.current?.(user);
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

        const prev = sessionRef.current;
        if (
          !prev ||
          prev.status !== sessionData.status ||
          prev.verseReference !== sessionData.verseReference
        ) {
          sessionRef.current = sessionData;
          onSessionUpdatedRef.current?.(sessionData);
        }
      }

      if (submissionsRes?.ok) {
        const submissions = await submissionsRes.json();
        submissions.forEach((s: any) => {
          if (!submissionsRef.current.has(s.id)) {
            submissionsRef.current.add(s.id);
            const submission: StudySubmission = {
              id: s.id,
              sessionId: s.sessionId,
              userId: s.participantId || s.userId,
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
            onSubmissionAddedRef.current?.(submission);
          }
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [sessionId]);

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
