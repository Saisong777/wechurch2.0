import { useEffect, useCallback, useRef, useState } from "react";
import { User, Session, StudySubmission } from "@/types/bible-study";

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  currentUserId?: string | null;
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
      const [participantsRes, sessionRes, submissionsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/participants`),
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/submissions`)
      ]);

      if (!mountedRef.current) return;

      if (participantsRes.ok) {
        const participants = await participantsRes.json();
        participants.forEach((p: any) => {
          const user: User = {
            id: p.id,
            name: p.name,
            email: '', // Don't expose email to participants
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
              email: '', // Don't expose email
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
