import { useEffect, useCallback, useRef, useState } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";
import { HIGH_CONCURRENCY_CONFIG } from "@/lib/retry-utils";

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type RealtimePhase = 'waiting' | 'grouping' | 'studying' | 'all';

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  currentUserId?: string | null;
  phase?: RealtimePhase;
  groupNumber?: number;
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
  groupNumber,
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
  const failCountRef = useRef(0);
  const lastVersionRef = useRef<string | null>(null);

  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantUpdatedRef = useRef(onParticipantUpdated);
  const onSessionUpdatedRef = useRef(onSessionUpdated);
  const onSubmissionAddedRef = useRef(onSubmissionAdded);
  const onCurrentUserRefetchedRef = useRef(onCurrentUserRefetched);
  const onGroupingDetectedRef = useRef(onGroupingDetected);
  const currentUserIdRef = useRef(currentUserId);
  const phaseRef = useRef(phase);
  const groupNumberRef = useRef(groupNumber);

  useEffect(() => { onParticipantJoinedRef.current = onParticipantJoined; }, [onParticipantJoined]);
  useEffect(() => { onParticipantUpdatedRef.current = onParticipantUpdated; }, [onParticipantUpdated]);
  useEffect(() => { onSessionUpdatedRef.current = onSessionUpdated; }, [onSessionUpdated]);
  useEffect(() => { onSubmissionAddedRef.current = onSubmissionAdded; }, [onSubmissionAdded]);
  useEffect(() => { onCurrentUserRefetchedRef.current = onCurrentUserRefetched; }, [onCurrentUserRefetched]);
  useEffect(() => { onGroupingDetectedRef.current = onGroupingDetected; }, [onGroupingDetected]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { groupNumberRef.current = groupNumber; }, [groupNumber]);

  const pollData = useCallback(async () => {
    if (!sessionId || !mountedRef.current) return;

    const currentPhase = phaseRef.current;
    const userId = currentUserIdRef.current;
    const grpNum = groupNumberRef.current;

    try {
      const params = new URLSearchParams({ phase: currentPhase });
      if (grpNum !== undefined) {
        params.set('groupNumber', String(grpNum));
      }
      if (lastVersionRef.current) {
        params.set('v', lastVersionRef.current);
      }

      const res = await fetch(`/api/sessions/${sessionId}/poll?${params}`);

      if (!mountedRef.current) return;

      if (res.status === 304) {
        failCountRef.current = 0;
        setConnectionState('connected');
        setLastSyncTime(new Date());
        return;
      }

      if (!res.ok) {
        throw new Error(`Poll failed: ${res.status}`);
      }

      const data = await res.json();
      lastVersionRef.current = data.version;

      const { session, participants, submissions } = data;

      if (participants) {
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
            onParticipantJoinedRef.current?.(user);
          } else if (
            existing.groupNumber !== user.groupNumber ||
            existing.readyConfirmed !== user.readyConfirmed
          ) {
            participantsRef.current.set(p.id, user);
            onParticipantUpdatedRef.current?.(user);
          }

          if (userId && p.id === userId) {
            onCurrentUserRefetchedRef.current?.(user);
            if (user.groupNumber && (sessionRef.current?.status === 'grouping' || sessionRef.current?.status === 'verification')) {
              onGroupingDetectedRef.current?.();
            }
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
            onSubmissionAddedRef.current?.(submission);
          }
        });
      }

      failCountRef.current = 0;
      setConnectionState('connected');
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Polling error:', error);
      failCountRef.current += 1;
      if (failCountRef.current >= 3) {
        setConnectionState('disconnected');
      } else {
        setConnectionState('reconnecting');
      }
    }
  }, [sessionId]);

  const forceRefresh = useCallback(async () => {
    lastVersionRef.current = null;
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
    failCountRef.current = 0;
    lastVersionRef.current = null;
    setConnectionState('connecting');

    pollData();

    const baseInterval = HIGH_CONCURRENCY_CONFIG.HEARTBEAT_INTERVAL_MS;
    const jitter = Math.random() * 2000;
    const interval = setInterval(pollData, baseInterval + jitter);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastVersionRef.current = null;
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
