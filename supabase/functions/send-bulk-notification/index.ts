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

interface EmailAttachment {
  filename: string;
  url: string;
}

interface BulkNotificationRequest {
  recipients: Recipient[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: EmailAttachment[];
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

    const { recipients, subject, body, isHtml, attachments }: BulkNotificationRequest = await req.json();

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

    // Prepare attachments for Resend (download from URLs)
    const resendAttachments: Array<{ filename: string; path: string }> = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        resendAttachments.push({
          filename: att.filename,
          path: att.url,
        });
      }
    }

    // Send emails (batch if multiple recipients)
    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        // If body is HTML (from rich text editor), use it directly in the content area
        const bodyContent = isHtml 
          ? body 
          : body.replace(/\n/g, '<br>');

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #f0f0f0;">
              <h1 style="color: #1a1a1a; font-size: 28px; margin: 0 0 8px 0; font-weight: 700;">⛪ WeChurch 微教會</h1>
              <p style="color: #B8860B; font-size: 14px; margin: 0; font-weight: 500;">📸 信息摘要圖卡</p>
            </div>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              親愛的 ${recipient.name}，
            </p>
            
            <div style="font-size: 16px; color: #333; line-height: 1.8; background-color: #fafafa; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              ${bodyContent}
            </div>
            
            ${resendAttachments.length > 0 ? `
            <div style="background-color: #f5f5f5; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px;">
              <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">📎 附件 (${resendAttachments.length})</p>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">
                ${resendAttachments.map(a => `<li>${a.filename}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            
            <div style="text-align: center;">
              <p style="font-size: 12px; color: #999; margin: 0 0 4px 0;">
                此郵件由 WeChurch 微教會 發送
              </p>
              <p style="font-size: 11px; color: #bbb; margin: 0;">
                wechurch.online
              </p>
            </div>
          </div>
        `;

        const emailPayload: any = {
          from: "WeChurch 微教會 <noreply@wechurch.online>",
          to: [recipient.email],
          subject: subject,
          html: emailHtml,
        };

        // Add attachments if any
        if (resendAttachments.length > 0) {
          emailPayload.attachments = resendAttachments;
        }

        const emailResponse = await resend.emails.send(emailPayload);

        // Resend v2 typically returns { data, error }. Some runtimes may return { id }.
        const respAny = emailResponse as any;
        const respError = respAny?.error;
        const respData = respAny?.data ?? respAny;
        const respId = respData?.id;

        if (respError) {
          throw new Error(respError?.message || String(respError));
        }
        if (!respId) {
          throw new Error("Resend returned no id");
        }

        results.push({ email: recipient.email, success: true, id: respId });
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
