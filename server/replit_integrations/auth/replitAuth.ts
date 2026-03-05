import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../../db";

async function upsertUser(profile: any) {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value;
  const firstName = profile.name?.givenName || profile.displayName?.split(" ")[0] || "";
  const lastName = profile.name?.familyName || "";
  const profileImageUrl = profile.photos?.[0]?.value;
  await pool.query(
    `INSERT INTO auth_users (id, email, first_name, last_name, profile_image_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET id=EXCLUDED.id, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, profile_image_url=EXCLUDED.profile_image_url, updated_at=NOW()`,
    [googleId, email, firstName, lastName, profileImageUrl]
  );
  if (email) {
    await pool.query(
      `INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET display_name=COALESCE(users.display_name, EXCLUDED.display_name), avatar_url=COALESCE(EXCLUDED.avatar_url, users.avatar_url), updated_at=NOW()`,
      [email, `${firstName}${lastName}`.trim() || email.split("@")[0], profileImageUrl || null]
    );
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({ conString: process.env.DATABASE_URL, createTableIfMissing: false, ttl: sessionTtl, tableName: "auth_sessions" });
  const isDev = process.env.NODE_ENV === "development";
  return session({ secret: process.env.SESSION_SECRET!, store: sessionStore, resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: !isDev, sameSite: "lax", maxAge: sessionTtl } });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", true);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  if (process.env.NODE_ENV === "development") {
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
        const devAuthId = `dev_${userId}`;
        if (authResult.rows.length === 0) {
          await pool.query(`INSERT INTO auth_users (id, email, first_name, last_name, created_at, updated_at) VALUES ($1,$2,$3,'',NOW(),NOW())`, [devAuthId, devEmail, displayName]);
        } else {
          await pool.query(`UPDATE auth_users SET id=$1, updated_at=NOW() WHERE email=$2`, [devAuthId, devEmail]);
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
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === 'production' ? 'https://www.wechurch.online/api/callback' : '/api/callback'
    },
      async (_at, _rt, profile, done) => {
        try {
          await upsertUser(profile);
          done(null, { claims: { sub: profile.id, email: profile.emails?.[0]?.value, first_name: profile.name?.givenName || "", last_name: profile.name?.familyName || "", profile_image_url: profile.photos?.[0]?.value }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 });
        } catch (err) { done(err as Error); }
      }
    ));
    app.get("/api/login", passport.authenticate("google", { scope: ["openid", "email", "profile"] }));
    app.get("/api/callback", passport.authenticate("google", { failureRedirect: "/api/login" }), (_req, res) => res.redirect("/"));
  } else {
    console.log("[Auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID), skipping Google strategy");
    app.get("/api/login", (_req, res) => res.redirect("/login"));
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
  // Session is still valid in DB (touch keeps it alive), so refresh expires_at for all user types
  user.expires_at = Math.floor(Date.now() / 1000) + 86400 * 7;
  if (req.session) req.session.touch();
  return next();
};
