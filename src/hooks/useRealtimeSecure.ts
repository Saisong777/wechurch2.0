import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session, StudySubmission } from "@/types/bible-study";
import { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * Secure realtime hook for PARTICIPANTS (non-admin users).
 * 
 * This hook uses a combination of approaches:
 * - For participants: Uses the participant_names view (emails excluded at DB level)
 * - For sessions: Uses direct postgres_changes (no sensitive data)
 * - For submissions: Uses submissions_public view (emails excluded at DB level)
 * 
 * Mobile-optimized features:
 * - Fail-safe polling every 3 seconds (queries DB directly)
 * - Visibility change detection for instant refetch when user returns
 * - Manual refresh capability exposed via callback
 * - Connection state tracking for UI feedback
 * 
 * Emails are never exposed to participant clients at any point.
 */

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  currentUserId?: string | null;
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
  onCurrentUserRefetched?: (user: User) => void;
  onGroupingDetected?: () => void; // Called when grouping is detected (session in verification + user has group)
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
  
  // Connection state tracking
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Track last known state to detect actual changes
  const lastParticipantStateRef = useRef(new Map<string, { groupNumber?: number; readyConfirmed: boolean }>());
  const lastParticipantIdsRef = useRef(new Set<string>());
  
  // Refetch current user data from the secure view
  const refetchCurrentUser = useCallback(async () => {
    if (!sessionId || !currentUserId) return null;
    
    console.log('[Realtime] Force-refetching current user data...');
    
    const { data } = await supabase
      .from("participant_names")
      .select("*")
      .eq("session_id", sessionId)
      .eq("id", currentUserId)
      .single();
    
    if (data && onCurrentUserRefetched) {
      const user: User = {
        id: data.id!,
        name: data.name!,
        email: "",
        gender: data.gender as "male" | "female",
        groupNumber: data.group_number || undefined,
        joinedAt: new Date(data.joined_at!),
        location: data.location || "On-site",
        readyConfirmed: data.ready_confirmed || false,
      };
      onCurrentUserRefetched(user);
      return user;
    }
    return null;
  }, [sessionId, currentUserId, onCurrentUserRefetched]);
  
  // Full status check - queries session AND current user from DB directly
  // This is the "heartbeat" that catches missed events
  const fullStatusCheck = useCallback(async () => {
    if (!sessionId || !currentUserId) return;
    
    console.log('[Realtime] Full status check (heartbeat)...');
    
    // Query both session and current user in parallel
    const [sessionResult, userResult] = await Promise.all([
      supabase
        .from("sessions_public")
        .select("*")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("participant_names")
        .select("*")
        .eq("session_id", sessionId)
        .eq("id", currentUserId)
        .single(),
    ]);
    
    const session = sessionResult.data;
    const userData = userResult.data;
    
    if (session && onSessionUpdated) {
      onSessionUpdated({
        id: session.id!,
        verseReference: session.verse_reference!,
        status: session.status as Session["status"],
        icebreakerEnabled: session.icebreaker_enabled || false,
        allowLatecomers: session.allow_latecomers || false,
      });
    }
    
    // Check if grouping is complete: session in verification/studying AND user has group
    if (session && userData) {
      const isGrouped = (session.status === 'verification' || session.status === 'studying') 
        && userData.group_number != null;
      
      if (isGrouped) {
        console.log('[Realtime] Grouping detected! Session:', session.status, 'Group:', userData.group_number);
        
        // Update user state
        if (onCurrentUserRefetched) {
          const user: User = {
            id: userData.id!,
            name: userData.name!,
            email: "",
            gender: userData.gender as "male" | "female",
            groupNumber: userData.group_number || undefined,
            joinedAt: new Date(userData.joined_at!),
            location: userData.location || "On-site",
            readyConfirmed: userData.ready_confirmed || false,
          };
          onCurrentUserRefetched(user);
        }
        
        // Trigger grouping detection callback
        if (onGroupingDetected) {
          onGroupingDetected();
        }
      }
    }
  }, [sessionId, currentUserId, onSessionUpdated, onCurrentUserRefetched, onGroupingDetected]);
  
  // Poll for participant changes using the secure view
  const pollParticipants = useCallback(async () => {
    if (!sessionId) return;
    
    const { data } = await supabase
      .from("participant_names")
      .select("*")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true });
    
    return data;
  }, [sessionId]);

  // Track last known session status to detect transitions
  const handleSessionChange = useCallback(
    async (payload: RealtimePostgresChangesPayload<{
      id: string;
      verse_reference: string;
      status: string;
      created_at: string;
    }>) => {
      if (payload.eventType === "UPDATE") {
        const s = payload.new;
        const newStatus = s.status as Session["status"];
        
        if (onSessionUpdated) {
          onSessionUpdated({
            id: s.id,
            verseReference: s.verse_reference,
            status: newStatus,
          });
        }
        
        // When session transitions away from 'waiting', do full status check
        if (newStatus !== 'waiting') {
          console.log(`[Realtime] Session status changed to ${newStatus}, running full status check...`);
          await fullStatusCheck();
        }
      }
    },
    [onSessionUpdated, fullStatusCheck]
  );

  const handleSubmissionChange = useCallback(
    (payload: RealtimePostgresChangesPayload<{
      id: string;
      session_id: string;
      participant_id: string;
      group_number: number;
      name: string;
      bible_verse: string;
      theme: string | null;
      moving_verse: string | null;
      facts_discovered: string | null;
      traditional_exegesis: string | null;
      inspiration_from_god: string | null;
      application_in_life: string | null;
      others: string | null;
      submitted_at: string;
    }>) => {
      if (payload.eventType === "INSERT" && onSubmissionAdded) {
        const s = payload.new;
        onSubmissionAdded({
          id: s.id,
          sessionId: s.session_id,
          userId: s.participant_id,
          groupNumber: s.group_number,
          name: s.name,
          email: "",
          bibleVerse: s.bible_verse,
          theme: s.theme || "",
          movingVerse: s.moving_verse || "",
          factsDiscovered: s.facts_discovered || "",
          traditionalExegesis: s.traditional_exegesis || "",
          inspirationFromGod: s.inspiration_from_god || "",
          applicationInLife: s.application_in_life || "",
          others: s.others || "",
          submittedAt: new Date(s.submitted_at),
        });
      }
    },
    [onSubmissionAdded]
  );

  useEffect(() => {
    if (!sessionId) {
      setConnectionState('disconnected');
      return;
    }

    setConnectionState('connecting');
    const lastParticipantState = lastParticipantStateRef.current;
    
    const doPoll = async () => {
      const participants = await pollParticipants();
      if (!participants) return;
      
      // Update last sync time on successful poll
      setLastSyncTime(new Date());
      
      const currentIds = new Set(participants.map(p => p.id));
      
      // Check for new participants
      for (const p of participants) {
        if (!lastParticipantIdsRef.current.has(p.id!) && onParticipantJoined) {
          onParticipantJoined({
            id: p.id!,
            name: p.name!,
            email: "",
            gender: p.gender as "male" | "female",
            groupNumber: p.group_number || undefined,
            joinedAt: new Date(p.joined_at!),
            location: p.location || "On-site",
            readyConfirmed: p.ready_confirmed || false,
          });
        }
      }
      
      // Check for updates - compare against last known state
      for (const p of participants) {
        const lastState = lastParticipantState.get(p.id!);
        const currentGroupNumber = p.group_number || undefined;
        const currentReadyConfirmed = p.ready_confirmed || false;
        
        const groupChanged = lastState?.groupNumber !== currentGroupNumber;
        const readyChanged = lastState?.readyConfirmed !== currentReadyConfirmed;
        
        if (onParticipantUpdated && (groupChanged || readyChanged)) {
          onParticipantUpdated({
            id: p.id!,
            name: p.name!,
            email: "",
            gender: p.gender as "male" | "female",
            groupNumber: currentGroupNumber,
            joinedAt: new Date(p.joined_at!),
            location: p.location || "On-site",
            readyConfirmed: currentReadyConfirmed,
          });
        }
        
        lastParticipantState.set(p.id!, {
          groupNumber: currentGroupNumber,
          readyConfirmed: currentReadyConfirmed,
        });
      }
      
      lastParticipantIdsRef.current = currentIds;
    };
    
    // FAIL-SAFE POLLING: Every 10-12 seconds with jitter to prevent thundering herd
    // This catches missed WebSocket events on mobile while reducing DB load for 100+ users
    const baseInterval = 10000;
    const jitter = Math.random() * 2000; // 0-2 seconds random jitter
    const heartbeatInterval = setInterval(() => {
      fullStatusCheck();
      doPoll();
    }, baseInterval + jitter);
    
    // Initial check
    fullStatusCheck();
    doPoll();

    // VISIBILITY CHANGE: When user returns to tab/unlocks phone, immediately refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Realtime] Tab/app became visible, running immediate status check...');
        setConnectionState('reconnecting');
        fullStatusCheck().then(() => {
          setConnectionState('connected');
        });
        doPoll();
      }
    };
    
    const handleFocus = () => {
      console.log('[Realtime] Window focused, running immediate status check...');
      fullStatusCheck();
      doPoll();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Subscribe to session and submission changes via realtime
    const channel = supabase
      .channel(`session-secure-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setLastSyncTime(new Date());
          handleSessionChange(payload as RealtimePostgresChangesPayload<{
            id: string;
            verse_reference: string;
            status: string;
            created_at: string;
          }>);
          doPoll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "submissions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setLastSyncTime(new Date());
          handleSubmissionChange(payload as RealtimePostgresChangesPayload<{
            id: string;
            session_id: string;
            participant_id: string;
            group_number: number;
            name: string;
            bible_verse: string;
            theme: string | null;
            moving_verse: string | null;
            facts_discovered: string | null;
            traditional_exegesis: string | null;
            inspiration_from_god: string | null;
            application_in_life: string | null;
            others: string | null;
            submitted_at: string;
          }>);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          setLastSyncTime(new Date());
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionState('disconnected');
        } else if (status === 'TIMED_OUT') {
          setConnectionState('reconnecting');
        }
      });
    
    channelRef.current = channel;

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      setConnectionState('disconnected');
    };
  }, [sessionId, pollParticipants, handleSessionChange, handleSubmissionChange, onParticipantJoined, onParticipantUpdated, fullStatusCheck]);
  
  // Expose force refresh for manual refresh button and connection state
  return {
    forceRefresh: fullStatusCheck,
    connectionState,
    lastSyncTime,
  };
};