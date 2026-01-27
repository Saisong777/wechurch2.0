import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetStudyResponseRequest {
  sessionId: string;
  participantId: string;
  participantEmail: string;
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

    const { sessionId, participantId, participantEmail }: GetStudyResponseRequest = await req.json();

    if (!sessionId || !participantId || !participantEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify participant exists + email matches (case-insensitive)
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, email, session_id")
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (participantError || !participant) {
      console.error("[get-study-response] Participant not found:", participantError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (participant.email.toLowerCase() !== participantEmail.toLowerCase()) {
      console.error("[get-study-response] Email mismatch");
      return new Response(
        JSON.stringify({ error: "Email verification failed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: response, error: responseError } = await supabase
      .from("study_responses")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", participantId)
      .maybeSingle();

    if (responseError) {
      console.error("[get-study-response] Query error:", responseError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: response ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[get-study-response] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
