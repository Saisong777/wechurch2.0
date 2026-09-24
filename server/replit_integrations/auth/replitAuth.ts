import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../../db";
import { isTestDeployment } from '../../deploymentSafety';
import { GoogleIdentityError, resolveGoogleIdentity } from '../../googleIdentityRepository';
import { googleLoginConfig, googleOnlyRegistration } from '../../googleLoginPolicy';

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({ conString: process.env.DATABASE_URL, createTableIfMissing: false, ttl: sessionTtl, tableName: "auth_sessions" });
  const isDev = process.env.NODE_ENV === "development";
  const allowInsecureLocalCookies = process.env.LOCAL_INSECURE_COOKIES === "1";
  return session({ secret: process.env.SESSION_SECRET!, store: sessionStore, resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: !(isDev || allowInsecureLocalCookies), sameSite: "lax", maxAge: sessionTtl } });
}

export async function setupAuth(app: Express) {
  const google = googleLoginConfig();
  app.get('/api/auth/options', (_req, res) => res.set('Cache-Control', 'no-store').json({
    google: google.enabled, emailRegistration: !googleOnlyRegistration(), staging: isTestDeployment(),
  }));
  app.set("trust proxy", true);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  if (process.env.NODE_ENV === "development" && !process.env.RAILWAY_ENVIRONMENT_NAME) {
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
        req.login({ claims: { sub: devAuthId, email: devEmail, first_name: displayName, last_name: "" }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 } as any, (err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          req.session.save(() => res.redirect("/"));
        });
      } catch (e) { console.error("[Dev Login]", e); return res.status(500).json({ message: "Dev login error" }); }
    });
  }
  app.get("/api/logout", (req, res) => { req.logout(() => res.redirect("/")); });
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
          done(null, { claims: { sub: identity.authUserId, email: identity.email, first_name: profile.name?.givenName || "", last_name: profile.name?.familyName || "", profile_image_url: profile.photos?.[0]?.value }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 });
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
        req.login(user, err => {
          if (err) return next(err);
          req.session.save(saveError => saveError ? next(saveError) : res.redirect('/login'));
        });
      })(req, res, next);
    });
  } else {
    console.log("[Auth] Google OAuth disabled or not configured");
    app.get("/api/login", (_req, res) => res.redirect("/login?error=google_unavailable"));
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.expires_at) return res.status(401).json({ message: "Unauthorized" });
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    // Proactively refresh expires_at when less than 1 day remaining
    if (user.expires_at - now < 86400) {
      user.expires_at = now + 86400 * 7;
    }
    if (req.session) req.session.touch();
    return next();
  }
  return res.status(401).json({ message: "Session expired" });
};
