import { useEffect, useCallback, useRef, useState } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type RealtimePhase = 'waiting' | 'grouping' | 'studying' | 'all';

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  currentUserId?: string | null;
  phase?: RealtimePhase;
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
  onCurrentUserRefetched?: (user: User) => void;
  onGroupingDetected?: () => void;
}

interface UseRealtimeSecureReturn {
  forceRefresh: () => Promise<void>;
  connectionState: ConnectionState;
  lastSyncTime: Date | null;
}

export const useRealtimeSecure = ({
  sessionId,
  currentUserId,
  phase = 'all',
  onParticipantJoined,
  onParticipantUpdated,
  onSessionUpdated,
  onSubmissionAdded,
  onCurrentUserRefetched,
  onGroupingDetected,
}: UseRealtimeSecureOptions): UseRealtimeSecureReturn => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const participantsRef = useRef<Map<string, User>>(new Map());
  const submissionsRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<Partial<Session> | null>(null);
  const mountedRef = useRef(true);

  const pollData = useCallback(async () => {
    if (!sessionId || !mountedRef.current) return;

    try {
      const shouldFetchParticipants = phase !== 'waiting';
      const shouldFetchSubmissions = phase === 'studying' || phase === 'all';

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

      if (!mountedRef.current) return;

      const sessionRes = results[0];
      const participantsRes = shouldFetchParticipants ? results[1] : null;
      const submissionsRes = shouldFetchSubmissions ? results[shouldFetchParticipants ? 2 : 1] : null;

      if (participantsRes?.ok) {
        const participants = await participantsRes.json();
        participants.forEach((p: any) => {
          const user: User = {
            id: p.id,
            name: p.name,
            email: '',
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
          } else if (
            existing.groupNumber !== user.groupNumber ||
            existing.readyConfirmed !== user.readyConfirmed
          ) {
            participantsRef.current.set(p.id, user);
            onParticipantUpdated?.(user);
          }

          if (currentUserId && p.id === currentUserId) {
            onCurrentUserRefetched?.(user);
            if (user.groupNumber && sessionRef.current?.status === 'verification') {
              onGroupingDetected?.();
            }
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
          onSessionUpdated?.(sessionData);
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
              email: '',
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

      setConnectionState('connected');
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Polling error:', error);
      setConnectionState('disconnected');
    }
  }, [
    sessionId,
    currentUserId,
    phase,
    onParticipantJoined,
    onParticipantUpdated,
    onSessionUpdated,
    onSubmissionAdded,
    onCurrentUserRefetched,
    onGroupingDetected
  ]);

  const forceRefresh = useCallback(async () => {
    await pollData();
  }, [pollData]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!sessionId) {
      setConnectionState('disconnected');
      return;
    }

    participantsRef.current.clear();
    submissionsRef.current.clear();
    sessionRef.current = null;
    setConnectionState('connecting');

    pollData();

    const interval = setInterval(pollData, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, pollData]);

  return {
    forceRefresh,
    connectionState,
    lastSyncTime,
  };
};
