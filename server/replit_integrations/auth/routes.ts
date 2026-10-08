import { loginWithGroupingSession } from '../../groupingSession';
import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../../db";
import { sendEmail } from "../../resend";
import { googleOnlyRegistration } from '../../googleLoginPolicy';
import { authAttemptLimits, authLoginLimits, trustedAuthJson } from '../../authRequestPolicy';
import { consumePasswordResetToken, issuePasswordResetToken } from '../../authPasswordReset';
import { createPasswordWorkLimiter, PasswordWorkBusyError } from '../../authPasswordWork';
import { authErrorMetadata } from '../../authLogging';
import { sessionDeadline } from '../../authSessionPersistence';
import { prepareLoginReceipt, recordPersistedLogin } from '../../churchLoginRepository';

export function registerAuthRoutes(app: Express): void {
  const passwordWork = createPasswordWorkLimiter();
  app.get("/api/auth/user", (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("[Auth] User lookup failed", authErrorMetadata(error));
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/register", trustedAuthJson(), ...authAttemptLimits(5), async (req: any, res) => {
    if (googleOnlyRegistration()) return res.status(403).json({ message: '請使用 Google 帳號註冊。', code: 'GOOGLE_REGISTRATION_REQUIRED' });
    try {
      const { email, password, displayName } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "請提供電子郵件" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "密碼至少需要 8 個字元" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existing = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "此電子郵件已被註冊" });
      }

      const hashedPassword = await passwordWork(() => bcrypt.hash(password, 10));

      const userResult = await pool.query(
        `INSERT INTO users (id, email, password, display_name, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         RETURNING id, email, display_name, session_version`,
        [normalizedEmail, hashedPassword, displayName || null]
      );
      const newUser = userResult.rows[0];

      let authUserId = `local_${newUser.id}`;
      const existingAuth = await pool.query(
        "SELECT id FROM auth_users WHERE email = $1",
        [normalizedEmail]
      );
      if (existingAuth.rows.length > 0) {
        authUserId = existingAuth.rows[0].id;
      } else {
        await pool.query(
          `INSERT INTO auth_users (id, email, first_name, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [authUserId, normalizedEmail, displayName || normalizedEmail.split("@")[0]]
        );
      }

      const sessionUser: any = {
        sessionVersion: newUser.session_version,
        sessionUserId: newUser.id,
        claims: {
          sub: authUserId,
          email: normalizedEmail,
          first_name: displayName || normalizedEmail.split("@")[0],
        },
        expires_at: sessionDeadline(),
      };

      loginWithGroupingSession(req, prepareLoginReceipt(sessionUser), (err: any) => {
        if (err) {
          console.error("[Auth] Register session error", authErrorMetadata(err));
          return res.status(err?.code ? 503 : 500).json({ message: "註冊成功但登入狀態尚未完整保存，請手動登入" });
        }
        req.session.save(async (saveErr: any) => {
          if (saveErr) {
            console.error("[Auth] Register session save error", authErrorMetadata(saveErr));
            return res.status(503).json({ message: '登入狀態暫時無法儲存，請稍後再試' });
          }
          try { await recordPersistedLogin(req); } catch { return res.status(503).json({message:'登入紀錄尚未完整保存，請重新確認登入。'}); }
          console.log("[Auth] Registration successful");
          res.json({ message: "註冊成功", user: { id: authUserId, email: normalizedEmail, displayName: displayName || null } });
        });
      });
    } catch (error) {
      if (error instanceof PasswordWorkBusyError) return res.set('Retry-After', '1').status(503).json({ message: '登入服務忙碌，請稍後重試' });
      console.error("[Auth] Register error", authErrorMetadata(error));
      res.status(500).json({ message: "註冊失敗，請稍後重試" });
    }
  });

  app.post("/api/auth/email-login", trustedAuthJson(), ...authLoginLimits(), async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "請提供電子郵件" });
      }
      if (!password || typeof password !== "string") {
        return res.status(400).json({ message: "請提供密碼" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const userResult = await pool.query(
        "SELECT id, email, password, display_name, session_version FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: "電子郵件或密碼錯誤" });
      }

      const dbUser = userResult.rows[0];

      if (!dbUser.password || dbUser.password.length === 0) {
        return res.status(401).json({ message: "電子郵件或密碼錯誤" });
      }

      let passwordMatch = false;
      const isBcryptHash = dbUser.password.length === 60 && dbUser.password.startsWith("$2");
      if (isBcryptHash) {
        passwordMatch = await passwordWork(() => bcrypt.compare(password, dbUser.password));
      } else if (dbUser.password.length >= 6 && dbUser.password.length <= 30) {
        console.warn("[Auth] Legacy plaintext password login blocked");
        return res.status(401).json({ message: "請使用忘記密碼重新設定密碼" });
      }

      if (!passwordMatch) {
        return res.status(401).json({ message: "電子郵件或密碼錯誤" });
      }

      let authUserId = `local_${dbUser.id}`;
      const existingAuth = await pool.query(
        "SELECT id FROM auth_users WHERE email = $1",
        [normalizedEmail]
      );
      if (existingAuth.rows.length > 0) {
        authUserId = existingAuth.rows[0].id;
      } else {
        await pool.query(
          `INSERT INTO auth_users (id, email, first_name, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [authUserId, normalizedEmail, dbUser.display_name || normalizedEmail.split("@")[0]]
        );
      }

      const sessionUser: any = {
        sessionVersion: dbUser.session_version,
        sessionUserId: dbUser.id,
        claims: {
          sub: authUserId,
          email: normalizedEmail,
          first_name: dbUser.display_name || normalizedEmail.split("@")[0],
        },
        expires_at: sessionDeadline(),
      };

      loginWithGroupingSession(req, prepareLoginReceipt(sessionUser), (err: any) => {
        if (err) {
          console.error("[Auth] Login session error", authErrorMetadata(err));
          return res.status(err?.code ? 503 : 500).json({ message: "登入失敗，請稍後重試" });
        }
        req.session.save(async (saveErr: any) => {
          if (saveErr) {
            console.error("[Auth] Login session save error", authErrorMetadata(saveErr));
            return res.status(503).json({ message: '登入狀態暫時無法儲存，請稍後再試' });
          }
          try { await recordPersistedLogin(req); } catch { return res.status(503).json({message:'登入紀錄尚未完整保存，請重新確認登入。'}); }
          console.log("[Auth] Email login successful");
          res.json({ message: "登入成功", user: { id: authUserId, email: normalizedEmail, displayName: dbUser.display_name } });
        });
      });
    } catch (error) {
      if (error instanceof PasswordWorkBusyError) return res.set('Retry-After', '1').status(503).json({ message: '登入服務忙碌，請稍後重試' });
      console.error("[Auth] Email login error", authErrorMetadata(error));
      res.status(500).json({ message: "登入失敗，請稍後重試" });
    }
  });

  app.post("/api/auth/forgot-password", ...authAttemptLimits(5), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "請提供電子郵件" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const userResult = await pool.query(
        "SELECT id, email FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      );

      if (userResult.rows.length === 0) {
        return res.json({ message: "ok" });
      }

      const token = randomBytes(32).toString("hex");
      if (!await issuePasswordResetToken(pool, normalizedEmail, token)) return res.json({ message: 'ok' });

      const baseUrl = process.env.PUBLIC_BASE_URL
        || (process.env.NODE_ENV === "production" ? "https://www.wechurch.online" : `${req.protocol}://${req.headers.host || "localhost:5001"}`);
      const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

      await sendEmail({
        to: normalizedEmail,
        subject: "WeChurch 密碼重設 | Password Reset",
        html: `
          <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">WeChurch</h1>
              <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">密碼重設請求</p>
            </div>
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                您好，<br><br>
                我們收到了您的密碼重設請求。請點擊下方按鈕設定新密碼：
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  重設密碼
                </a>
              </div>
              <p style="color: #666; font-size: 13px; line-height: 1.5; margin: 0;">
                此連結將於 1 小時後失效。<br>
                如果您並未要求重設密碼，請忽略此郵件。
              </p>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              此郵件由 WeChurch 系統自動發送，請勿直接回覆。
            </p>
          </div>
        `,
      });

      console.log("[Auth] Password reset email sent");
      res.json({ message: "ok" });
    } catch (error) {
      console.error("[Auth] Forgot password error", authErrorMetadata(error));
      res.status(500).json({ message: "發送失敗，請稍後重試" });
    }
  });

  app.post("/api/auth/reset-password", ...authAttemptLimits(10, 'token'), async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "無效的重設連結" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "密碼至少需要 8 個字元" });
      }

      const tokenResult = await pool.query(
        `SELECT id, email, used, (expires_at > clock_timestamp()
         AND created_at > clock_timestamp() - INTERVAL '1 hour') AS unexpired
         FROM password_reset_tokens WHERE token = $1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ message: "無效的重設連結，請重新申請" });
      }

      const resetToken = tokenResult.rows[0];

      if (resetToken.used) {
        return res.status(400).json({ message: "此重設連結已使用過，請重新申請" });
      }

      if (!resetToken.unexpired) {
        return res.status(400).json({ message: "重設連結已過期，請重新申請" });
      }

      const hashedPassword = await passwordWork(() => bcrypt.hash(password, 10));

      if (!await consumePasswordResetToken(pool, token, hashedPassword)) {
        return res.status(400).json({ message: '無效或已失效的重設連結，請重新申請' });
      }

      console.log("[Auth] Password reset successful");
      res.json({ message: "密碼重設成功！請使用新密碼登入。" });
    } catch (error) {
      if (error instanceof PasswordWorkBusyError) return res.set('Retry-After', '1').status(503).json({ message: '登入服務忙碌，請稍後重試' });
      console.error("[Auth] Reset password error", authErrorMetadata(error));
      res.status(500).json({ message: "重設失敗，請稍後重試" });
    }
  });

  app.get("/api/auth/verify-reset-token", ...authAttemptLimits(10, 'token'), async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ valid: false, message: "無效的連結" });
      }

      const tokenResult = await pool.query(
        `SELECT id, email, used, (expires_at > clock_timestamp()
         AND created_at > clock_timestamp() - INTERVAL '1 hour') AS unexpired
         FROM password_reset_tokens WHERE token = $1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ valid: false, message: "無效的重設連結" });
      }

      const resetToken = tokenResult.rows[0];

      if (resetToken.used) {
        return res.status(400).json({ valid: false, message: "此連結已使用過" });
      }

      if (!resetToken.unexpired) {
        return res.status(400).json({ valid: false, message: "連結已過期" });
      }

      res.json({ valid: true, email: resetToken.email });
    } catch (error) {
      console.error("[Auth] Verify reset token error", authErrorMetadata(error));
      res.status(500).json({ valid: false, message: "驗證失敗" });
    }
  });
}
