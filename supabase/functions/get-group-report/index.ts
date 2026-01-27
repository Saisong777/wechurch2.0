import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, groupNumber, participantEmail } = await req.json();

    // Validate required fields
    if (!sessionId || groupNumber === undefined || !participantEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: sessionId, groupNumber, participantEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Verify participant exists in this session with matching email and group
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, email, group_number, session_id")
      .eq("session_id", sessionId)
      .eq("group_number", groupNumber)
      .ilike("email", participantEmail)
      .maybeSingle();

    if (participantError) {
      console.error("[get-group-report] Participant lookup error:", participantError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!participant) {
      console.log("[get-group-report] Participant not found or not in this group:", {
        sessionId,
        groupNumber,
        email: participantEmail,
      });
      return new Response(
        JSON.stringify({ error: "Participant not found in this group" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Verify email matches (case-insensitive)
    if (participant.email.toLowerCase() !== participantEmail.toLowerCase()) {
      console.error("[get-group-report] Email mismatch");
      return new Response(
        JSON.stringify({ error: "Email verification failed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Check session status allows viewing reports
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedStatuses = ["studying", "grouping", "verification", "completed"];
    if (!allowedStatuses.includes(session.status)) {
      return new Response(
        JSON.stringify({ error: "Session is not in a valid status for viewing reports" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch the group report
    const { data: reports, error: reportError } = await supabaseAdmin
      .from("ai_reports")
      .select("*")
      .eq("session_id", sessionId)
      .eq("report_type", "group")
      .eq("group_number", groupNumber)
      .order("created_at", { ascending: false });

    if (reportError) {
      console.error("[get-group-report] Report fetch error:", reportError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the reports (can be empty array if not generated yet)
    return new Response(
      JSON.stringify({ reports: reports || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-group-report] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
