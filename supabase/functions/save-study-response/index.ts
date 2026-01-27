import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaveStudyResponseRequest {
  sessionId: string;
  participantId: string;
  participantEmail: string;
  formData: {
    title_phrase?: string;
    heartbeat_verse?: string;
    observation?: string;
    core_insight_category?: string | null;
    core_insight_note?: string;
    scholars_note?: string;
    action_plan?: string;
    cool_down_note?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, participantId, participantEmail, formData }: SaveStudyResponseRequest = await req.json();

    // Validate required fields
    if (!sessionId || !participantId || !participantEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the participant exists and email matches
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, email, session_id")
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (participantError || !participant) {
      console.error("[save-study-response] Participant not found:", participantError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify email matches (case-insensitive)
    if (participant.email.toLowerCase() !== participantEmail.toLowerCase()) {
      console.error("[save-study-response] Email mismatch");
      return new Response(
        JSON.stringify({ error: "Email verification failed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify session exists and is not ended
    // Allow latecomers to save notes during any active phase
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, status, created_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only block if session is explicitly ended
    const blockedStatuses = ["ended", "cancelled"];
    if (blockedStatuses.includes(session.status)) {
      return new Response(
        JSON.stringify({ error: "Session has ended" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the study response
    const payload = {
      session_id: sessionId,
      user_id: participantId,
      ...formData,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error: upsertError } = await supabase
      .from("study_responses")
      .upsert(payload, { onConflict: "session_id,user_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[save-study-response] Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[save-study-response] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});