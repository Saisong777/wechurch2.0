import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session, StudySubmission } from "@/types/bible-study";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Secure realtime hook for PARTICIPANTS (non-admin users).
 * This hook strips sensitive data (like email) from realtime events
 * to prevent data exposure through browser dev tools.
 * 
 * For admin users who need access to participant emails, use useRealtimeAdmin instead.
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
  const handleParticipantChange = useCallback(
    (payload: RealtimePostgresChangesPayload<{
      id: string;
      session_id: string;
      name: string;
      email: string; // Present in payload but we strip it
      gender: string;
      group_number: number | null;
      joined_at: string;
    }>) => {
      if (payload.eventType === "INSERT" && onParticipantJoined) {
        const p = payload.new;
        // Strip email from participant data for privacy
        onParticipantJoined({
          id: p.id,
          name: p.name,
          email: "", // Email is stripped for privacy - participants shouldn't see each other's emails
          gender: p.gender as "male" | "female",
          groupNumber: p.group_number || undefined,
          joinedAt: new Date(p.joined_at),
        });
      } else if (payload.eventType === "UPDATE" && onParticipantUpdated) {
        const p = payload.new;
        // Strip email from participant data for privacy
        onParticipantUpdated({
          id: p.id,
          name: p.name,
          email: "", // Email is stripped for privacy - participants shouldn't see each other's emails
          gender: p.gender as "male" | "female",
          groupNumber: p.group_number || undefined,
          joinedAt: new Date(p.joined_at),
        });
      }
    },
    [onParticipantJoined, onParticipantUpdated]
  );

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
          email: "", // Email is not exposed through realtime for privacy
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

    const channel = supabase
      .channel(`session-secure-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        handleParticipantChange
      )
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
      supabase.removeChannel(channel);
    };
  }, [sessionId, handleParticipantChange, handleSessionChange, handleSubmissionChange]);
};
