import { useEffect, useCallback, useRef } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";
import { HIGH_CONCURRENCY_CONFIG } from "@/lib/retry-utils";

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
  const lastVersionRef = useRef<string | null>(null);

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
      const params = new URLSearchParams({ phase: currentPhase });
      if (lastVersionRef.current) {
        params.set('v', lastVersionRef.current);
      }

      const res = await fetch(`/api/sessions/${sessionId}/poll?${params}`);

      if (res.status === 304) {
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      lastVersionRef.current = data.version;

      const { session, participants, submissions } = data;

      if (participants) {
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

      if (session) {
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

      if (submissions) {
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
    lastVersionRef.current = null;

    pollData();

    const interval = setInterval(pollData, HIGH_CONCURRENCY_CONFIG.HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, pollData]);
};
