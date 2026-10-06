import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../../db";
import { isTestDeployment } from '../../deploymentSafety';
import { GoogleIdentityError, resolveGoogleIdentity } from '../../googleIdentityRepository';
import { googleLoginConfig, googleOnlyRegistration } from '../../googleLoginPolicy';
import { authStorage } from './storage';
import { createSessionVersionGuard } from '../../authSessionVersion';
import { SESSION_TTL_SECONDS, SESSION_TTL_MS, sessionDeadline, sessionCookieOptions, persistAuthenticatedSession, destroyAuthenticatedSession } from '../../authSessionPersistence';
import { authErrorMetadata } from '../../authLogging';
import { prepareLoginReceipt,recordPersistedLogin } from '../../churchLoginRepository';

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({ pool, createTableIfMissing: false, ttl: SESSION_TTL_SECONDS, tableName: "auth_sessions" });
  return session({ secret: process.env.SESSION_SECRET!, store: sessionStore, resave: false, saveUninitialized: false, rolling: true, cookie: { ...sessionCookieOptions(), maxAge: SESSION_TTL_MS } });
}

export async function setupAuth(app: Express) {
  const google = googleLoginConfig();
  app.get('/api/auth/options', (_req, res) => res.set('Cache-Control', 'no-store').json({
    google: google.enabled, emailRegistration: !googleOnlyRegistration(), staging: isTestDeployment(),
  }));
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT_NAME);
  app.set("trust proxy", onRailway ? 1 : false);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  const versions = createSessionVersionGuard(authStorage, async memberId => {
    const result = await pool.query('SELECT session_version FROM users WHERE id = $1', [memberId]);
    return result.rows[0]?.session_version;
  });
  passport.serializeUser((user: Express.User, cb) => {
    versions.serialize(user).then(verified => verified
      ? cb(null, verified) : cb(new Error('Authentication changed; please sign in again')), cb);
  });
  passport.deserializeUser((user: Express.User, cb) => {
    versions.deserialize(user).then(verified => cb(null, verified), cb);
  });
  if (process.env.NODE_ENV === "development" && !onRailway) {
    app.get("/api/dev-login", async (req, res) => {
      const devEmail = "saisong@gmail.com";
      try {
        const userResult = await pool.query(`SELECT id, display_name FROM users WHERE email=$1`, [devEmail]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ message: `User ${devEmail} not found in database` });
        }
        const userId = userResult.rows[0].id;
        const displayName = userResult.rows[0].display_name || devEmail.split("@")[0];
        const authResult = await pool.query(`SELECT id FROM auth_users WHERE email=$1`, [devEmail]);
        const devAuthId = authResult.rows[0]?.id || `dev_${userId}`;
        if (authResult.rows.length === 0) {
          await pool.query(`INSERT INTO auth_users (id, email, first_name, last_name, created_at, updated_at) VALUES ($1,$2,$3,'',NOW(),NOW())`, [devAuthId, devEmail, displayName]);
        }
        const rc = await pool.query(`SELECT id FROM user_roles WHERE user_id=$1`, [userId]);
        if (rc.rows.length > 0) { await pool.query(`UPDATE user_roles SET role='admin',updated_at=NOW() WHERE user_id=$1`, [userId]); }
        else { await pool.query(`INSERT INTO user_roles (id,user_id,role,created_at,updated_at) VALUES (gen_random_uuid(),$1,'admin',NOW(),NOW())`, [userId]); }
        req.login({ claims: { sub: devAuthId, email: devEmail, first_name: displayName, last_name: "" }, expires_at: sessionDeadline() } as any, (err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          req.session.save(() => res.redirect("/"));
        });
      } catch (e) { console.error("[Dev Login]", authErrorMetadata(e)); return res.status(500).json({ message: "Dev login error" }); }
    });
  }
  app.get("/api/logout", destroyAuthenticatedSession);
  if (google.enabled && google.callbackURL) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: google.callbackURL,
      state: true,
      pkce: true,
    },
      async (_at, _rt, profile, done) => {
        try {
          const identity = await resolveGoogleIdentity(pool, profile);
          done(null, { claims: { sub: identity.authUserId, email: identity.email, first_name: profile.name?.givenName || "", last_name: profile.name?.familyName || "", profile_image_url: profile.photos?.[0]?.value }, expires_at: sessionDeadline() });
        } catch (err) {
          if (err instanceof GoogleIdentityError) return done(null, false, { message: err.code });
          done(err as Error);
        }
      }
    ));
    app.get("/api/login", passport.authenticate("google", { scope: ["openid", "email", "profile"], prompt: 'select_account' }));
    app.get('/api/callback', (req, res, next) => {
      passport.authenticate('google', (error: unknown, user: Express.User | false, info?: { message?: string }) => {
        if (error || !user) {
          const code = info?.message === 'GOOGLE_ACCOUNT_LINK_REQUIRED' ? 'google_link_required' : 'google_login_failed';
          return res.redirect(`/login?error=${code}`);
        }
        req.login(prepareLoginReceipt(user as any), err => {
          if (err) {console.error('[Auth] Google session failed',authErrorMetadata(err));return res.status(503).send('登入狀態暫時無法完整儲存，請重新登入。');}
          req.session.save(async saveError => {
            if(saveError){console.error('[Auth] Google session save failed',authErrorMetadata(saveError));return res.status(503).send('登入狀態暫時無法完整儲存，請重新登入。');}
            try { await recordPersistedLogin(req);res.redirect('/login'); }
            catch { res.status(503).send('登入紀錄尚未完整保存，請重新確認登入。'); }
          });
        });
      })(req, res, next);
    });
  } else {
    console.log("[Auth] Google OAuth disabled or not configured");
    app.get("/api/login", (_req, res) => res.redirect("/login?error=google_unavailable"));
  }
}

export const isAuthenticated: RequestHandler = persistAuthenticatedSession;
