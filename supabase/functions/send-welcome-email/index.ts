import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WelcomeEmailRequest {
  email: string;
  name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: WelcomeEmailRequest = await req.json();

    if (!email) {
      throw new Error("缺少 email 欄位");
    }

    const displayName = name || email.split('@')[0];

    const emailResponse = await resend.emails.send({
      from: "WeChurch <noreply@wechurch.online>",
      to: [email],
      subject: "歡迎加入 WeChurch",
      html: `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>歡迎加入 WeChurch</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                🎉 歡迎加入 WeChurch！
              </h1>
              <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                一起與主同行
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 8px 0; color: #0ea5e9; font-size: 16px; font-weight: 600;">
                Hi, ${displayName}！
              </p>
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">
                感謝您註冊成為會員
              </h2>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 16px; line-height: 1.7;">
                我們很高興您加入 WeChurch 大家庭！在這裡，您可以：
              </p>
              
              <!-- Features List -->
              <div style="background-color: #f0f9ff; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #0ea5e9; font-size: 20px; margin-right: 12px;">📖</span>
                      <span style="color: #0369a1; font-size: 15px;">參與線上查經小組</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #0ea5e9; font-size: 20px; margin-right: 12px;">🙏</span>
                      <span style="color: #0369a1; font-size: 15px;">在禱告牆與弟兄姊妹代禱</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #0ea5e9; font-size: 20px; margin-right: 12px;">📝</span>
                      <span style="color: #0369a1; font-size: 15px;">保存您的個人查經筆記</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #0ea5e9; font-size: 20px; margin-right: 12px;">🎮</span>
                      <span style="color: #0369a1; font-size: 15px;">體驗有趣的破冰遊戲</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="https://wechurch.lovable.app" 
                       style="display: inline-block; background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.4);">
                      開始探索 WeChurch
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Closing -->
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                如果您有任何問題，歡迎隨時聯繫我們。期待在 WeChurch 與您相遇！
              </p>
              <p style="margin: 16px 0 0 0; color: #1e293b; font-size: 15px; font-weight: 500;">
                WeChurch 團隊敬上 ✨
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.5;">
                此郵件由 WeChurch 系統自動發送。<br>
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error in send-welcome-email function:", error);
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
