import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: PasswordResetRequest = await req.json();

    // Validate required fields
    if (!email || !redirectUrl) {
      throw new Error("缺少必要欄位");
    }

    // Create Supabase admin client to generate reset link
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate password reset link using admin API
    const { data, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (resetError || !data) {
      console.error("Reset link generation error:", resetError);
      throw new Error("無法產生重設連結，請確認電子郵件地址正確");
    }

    const resetLink = data.properties?.action_link;
    
    if (!resetLink) {
      throw new Error("無法取得重設連結");
    }

    // Send custom branded email
    const emailResponse = await resend.emails.send({
      from: "WeChurch <noreply@wechurch.online>",
      to: [email],
      subject: "重設您的 WeChurch 密碼",
      html: `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重設密碼 - WeChurch</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                WeChurch
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                一起與主同行
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 22px; font-weight: 600;">
                重設您的密碼
              </h2>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                您好！我們收到了您的密碼重設請求。請點擊下方按鈕設定新密碼：
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${resetLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                      重設密碼
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  ⚠️ 此連結將在 <strong>1 小時內</strong> 失效。如果您沒有請求重設密碼，請忽略此郵件。
                </p>
              </div>
              
              <!-- Alternative link -->
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                如果按鈕無法點擊，請複製以下連結到瀏覽器中開啟：
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all; color: #6366f1; font-size: 12px; background-color: #f1f5f9; padding: 12px; border-radius: 8px;">
                ${resetLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.5;">
                此郵件由 WeChurch 系統自動發送，請勿直接回覆。<br>
                如有任何問題，歡迎聯繫我們的服務團隊。
              </p>
              <p style="margin: 16px 0 0 0; color: #cbd5e1; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} WeChurch. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error in send-password-reset function:", error);
    const errorMessage = error instanceof Error ? error.message : "發生錯誤，請重試";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
