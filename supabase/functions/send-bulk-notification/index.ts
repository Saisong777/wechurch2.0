import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Recipient {
  name: string;
  email: string;
}

interface BulkNotificationRequest {
  recipients: Recipient[];
  subject: string;
  body: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check if user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "leader"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin or Leader access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { recipients, subject, body }: BulkNotificationRequest = await req.json();

    // Validate input
    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subject || !body) {
      return new Response(
        JSON.stringify({ error: "Subject and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send emails (batch if multiple recipients)
    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #B8860B; font-size: 24px; margin: 0;">🏋️ Soul Gym 靈魂健身房</h1>
            </div>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
              親愛的 ${recipient.name}，
            </p>
            
            <div style="font-size: 16px; color: #333; line-height: 1.6; white-space: pre-wrap;">
              ${body.replace(/\n/g, '<br>')}
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              此郵件由 Soul Gym 靈魂健身房發送
            </p>
          </div>
        `;

        const emailResponse = await resend.emails.send({
          from: "Soul Gym <noreply@wechurch.app>",
          to: [recipient.email],
          subject: subject,
          html: emailHtml,
        });

        results.push({ email: recipient.email, success: true, id: (emailResponse as any).id || 'sent' });
      } catch (err: any) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        errors.push({ email: recipient.email, error: err.message });
      }
    }

    console.log(`Bulk notification: ${results.length} sent, ${errors.length} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
