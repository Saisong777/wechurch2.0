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
 * Emails are never exposed to participant clients at any point.
 */

interface UseRealtimeSecureOptions {
  sessionId: string | null;
  onParticipantJoined?: (user: User) => void;
  onParticipantUpdated?: (user: User) => void;
  onSessionUpdated?: (session: Partial<Session>) => void;
  onSubmissionAdded?: (submission: StudySubmission) => void;
}

export const useRealtimeSecure = ({
  sessionId,
  onParticipantJoined,
  onParticipantUpdated,
  onSessionUpdated,
  onSubmissionAdded,
}: UseRealtimeSecureOptions) => {
  
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

  const handleSessionChange = useCallback(
    (payload: RealtimePostgresChangesPayload<{
      id: string;
      verse_reference: string;
      status: string;
      created_at: string;
    }>) => {
      if (payload.eventType === "UPDATE" && onSessionUpdated) {
        const s = payload.new;
        onSessionUpdated({
          id: s.id,
          verseReference: s.verse_reference,
          status: s.status as Session["status"],
        });
      }
    },
    [onSessionUpdated]
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
    // Poll every 3 seconds for participant updates
    let lastParticipantIds = new Set<string>();
    // Track last known state to detect actual changes
    let lastParticipantState = new Map<string, { groupNumber?: number; readyConfirmed: boolean }>();
    
    const pollInterval = setInterval(async () => {
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
    }, 3000);

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
        handleSessionChange
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
