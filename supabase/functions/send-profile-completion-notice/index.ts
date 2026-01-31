import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProfileCompletionRequest {
  email: string;
  name?: string;
  type: 'incomplete_profile' | 'unverified_email' | 'potential_member';
  redirectUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, type, redirectUrl }: ProfileCompletionRequest = await req.json();

    if (!email || !redirectUrl) {
      throw new Error("缺少必要欄位");
    }

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

    let actionLink = redirectUrl;
    let emailSubject = "";
    let emailTitle = "";
    let emailMessage = "";
    let buttonText = "";

    // Different email content based on type
    if (type === 'unverified_email') {
      // Generate email verification link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (!error && data?.properties?.action_link) {
        actionLink = data.properties.action_link;
      }
      
      emailSubject = "請驗證您的 WeChurch 帳號";
      emailTitle = "驗證您的電子郵件";
      emailMessage = "您好！您的 WeChurch 帳號尚未完成驗證。請點擊下方按鈕完成驗證並開始使用：";
      buttonText = "驗證我的帳號";
    } else if (type === 'incomplete_profile') {
      // Generate password reset link so user can log in and update profile
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (!error && data?.properties?.action_link) {
        actionLink = data.properties.action_link;
      }
      
      emailSubject = "請完善您的 WeChurch 個人資料";
      emailTitle = "完善您的個人資料";
      emailMessage = "您好！我們注意到您的個人資料尚未完整。完整的資料能幫助我們在小組分組時讓您認識更多弟兄姊妹。請點擊下方按鈕登入並更新您的資料：";
      buttonText = "更新我的資料";
    } else if (type === 'potential_member') {
      emailSubject = "邀請您加入 WeChurch";
      emailTitle = "歡迎加入 WeChurch";
      emailMessage = `${name ? `親愛的 ${name}` : '您好'}！感謝您參與我們的活動。我們誠摯邀請您註冊成為 WeChurch 正式會員，享受更多功能與服務：`;
      buttonText = "立即註冊";
    }

    const displayName = name || email.split('@')[0];

    // Send branded email
    const emailResponse = await resend.emails.send({
      from: "WeChurch <noreply@wechurch.online>",
      to: [email],
      subject: emailSubject,
      html: `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ✨ WeChurch
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                一起與主同行
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 8px 0; color: #0ea5e9; font-size: 14px; font-weight: 600;">
                Hi, ${displayName}！
              </p>
              <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 22px; font-weight: 600;">
                ${emailTitle}
              </h2>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                ${emailMessage}
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${actionLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.4);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Info Box -->
              <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #0369a1; font-size: 14px; line-height: 1.5;">
                  💡 完善個人資料後，您可以：
                </p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #0369a1; font-size: 14px; line-height: 1.6;">
                  <li>參與小組查經活動</li>
                  <li>加入禱告牆與弟兄姊妹代禱</li>
                  <li>保存您的學習筆記</li>
                </ul>
              </div>
              
              <!-- Alternative link -->
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                如果按鈕無法點擊，請複製以下連結到瀏覽器中開啟：
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all; color: #0ea5e9; font-size: 12px; background-color: #f1f5f9; padding: 12px; border-radius: 8px;">
                ${actionLink}
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

    console.log("Profile completion notice sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error in send-profile-completion-notice function:", error);
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
