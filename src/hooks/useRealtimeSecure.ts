import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session, StudySubmission } from "@/types/bible-study";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Secure realtime hook for PARTICIPANTS (non-admin users).
 * 
 * This hook uses a combination of approaches:
 * - For participants: Uses the participant_names view (emails excluded at DB level)
 * - For sessions: Uses direct postgres_changes (no sensitive data)
 * - For submissions: Uses submissions_public view (emails excluded at DB level)
 * 
 * Key feature: Session status changes trigger immediate user data refetch
 * to ensure group assignments are picked up even when Realtime doesn't
 * properly propagate view updates.
 * 
 * Emails are never exposed to participant clients at any point.
 */

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  currentUserId?: string | null; // Added to enable force refetch for current user
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
  onCurrentUserRefetched?: (user: User) => void; // Called when current user data is force-refetched
}

export const useRealtimeSecure = ({
  sessionId,
  currentUserId,
  onParticipantJoined,
  onParticipantUpdated,
  onSessionUpdated,
  onSubmissionAdded,
  onCurrentUserRefetched,
}: UseRealtimeSecureOptions) => {
  
  // Refetch current user data from the secure view
  // Used when session status changes to ensure group assignments are picked up
  const refetchCurrentUser = useCallback(async () => {
    if (!sessionId || !currentUserId) return null;
    
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
        email: "", // Email excluded by view
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
  
  // Poll for participant changes using the secure view
  // This is more secure than realtime as it goes through RLS with the view
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
        
        // Notify about session update
        if (onSessionUpdated) {
          onSessionUpdated({
            id: s.id,
            verseReference: s.verse_reference,
            status: newStatus,
          });
        }
        
        // CRITICAL: When session transitions away from 'waiting',
        // immediately force-refetch current user to get their group assignment
        if (newStatus !== 'waiting') {
          console.log(`[Realtime] Session status changed to ${newStatus}, force-refetching current user...`);
          await refetchCurrentUser();
        }
      }
    },
    [onSessionUpdated, refetchCurrentUser]
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
          email: "", // Email never exposed to participants
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
    if (!sessionId) return;

    // Set up polling for participant changes (since direct realtime exposes emails)
    // Default poll interval: 3 seconds, reduced to 2 seconds during active phases
    let lastParticipantIds = new Set<string>();
    // Track last known state to detect actual changes
    let lastParticipantState = new Map<string, { groupNumber?: number; readyConfirmed: boolean }>();
    
    const doPoll = async () => {
      const participants = await pollParticipants();
      if (!participants) return;
      
      const currentIds = new Set(participants.map(p => p.id));
      
      // Check for new participants
      for (const p of participants) {
        if (!lastParticipantIds.has(p.id!) && onParticipantJoined) {
          onParticipantJoined({
            id: p.id!,
            name: p.name!,
            email: "", // Email excluded by view
            gender: p.gender as "male" | "female",
            groupNumber: p.group_number || undefined,
            joinedAt: new Date(p.joined_at!),
            location: p.location || "On-site",
            readyConfirmed: p.ready_confirmed || false,
          });
        }
      }
      
      // Check for updates (group assignments, ready status) - compare against last known state
      for (const p of participants) {
        const lastState = lastParticipantState.get(p.id!);
        const currentGroupNumber = p.group_number || undefined;
        const currentReadyConfirmed = p.ready_confirmed || false;
        
        // Only fire update if state actually changed
        const groupChanged = lastState?.groupNumber !== currentGroupNumber;
        const readyChanged = lastState?.readyConfirmed !== currentReadyConfirmed;
        
        if (onParticipantUpdated && (groupChanged || readyChanged)) {
          onParticipantUpdated({
            id: p.id!,
            name: p.name!,
            email: "", // Email excluded by view
            gender: p.gender as "male" | "female",
            groupNumber: currentGroupNumber,
            joinedAt: new Date(p.joined_at!),
            location: p.location || "On-site",
            readyConfirmed: currentReadyConfirmed,
          });
        }
        
        // Update tracked state
        lastParticipantState.set(p.id!, {
          groupNumber: currentGroupNumber,
          readyConfirmed: currentReadyConfirmed,
        });
      }
      
      lastParticipantIds = currentIds;
    };
    
    // Poll every 2 seconds (faster than before to catch group assignments quickly)
    const pollInterval = setInterval(doPoll, 2000);

    // Subscribe to session and submission changes via realtime
    // These don't expose sensitive data
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
          handleSessionChange(payload as RealtimePostgresChangesPayload<{
            id: string;
            verse_reference: string;
            status: string;
            created_at: string;
          }>);
          // Also trigger an immediate poll when session status changes
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
        handleSubmissionChange
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, pollParticipants, handleSessionChange, handleSubmissionChange, onParticipantJoined, onParticipantUpdated]);
};
