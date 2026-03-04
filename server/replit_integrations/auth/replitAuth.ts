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
      `INSERT INTO users (id, email, display_name, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET display_name=COALESCE(users.display_name, EXCLUDED.display_name), updated_at=NOW()`,
      [email, `${firstName}${lastName}`.trim() || email.split("@")[0]]
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
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, callbackURL: "/api/callback" },
    async (_at, _rt, profile, done) => {
      try {
        await upsertUser(profile);
        done(null, { claims: { sub: profile.id, email: profile.emails?.[0]?.value, first_name: profile.name?.givenName || "", last_name: profile.name?.familyName || "", profile_image_url: profile.photos?.[0]?.value }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 });
      } catch (err) { done(err as Error); }
    }
  ));
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  app.get("/api/login", passport.authenticate("google", { scope: ["openid", "email", "profile"] }));
  app.get("/api/callback", passport.authenticate("google", { failureRedirect: "/api/login" }), (_req, res) => res.redirect("/"));
  app.get("/api/logout", (req, res) => { req.logout(() => res.redirect("/")); });
  if (process.env.NODE_ENV === "development") {
    app.get("/api/dev-login", async (req, res) => {
      const devUserId = "99999999"; const devEmail = "dev@wechurch.test";
      try {
        await pool.query(`DELETE FROM auth_users WHERE id=$1 OR email=$2`, [devUserId, devEmail]);
        await pool.query(`INSERT INTO auth_users (id, email, first_name, last_name, created_at, updated_at) VALUES ($1,$2,'開發','管理員',NOW(),NOW())`, [devUserId, devEmail]);
        const r = await pool.query(`INSERT INTO users (id,email,password,display_name,created_at,updated_at) VALUES (gen_random_uuid(),$1,'dev','開發管理員',NOW(),NOW()) ON CONFLICT (email) DO UPDATE SET updated_at=NOW() RETURNING id`, [devEmail]);
        const lid = r.rows[0].id;
        const rc = await pool.query(`SELECT id FROM user_roles WHERE user_id=$1`, [lid]);
        if (rc.rows.length > 0) { await pool.query(`UPDATE user_roles SET role='admin',updated_at=NOW() WHERE user_id=$1`, [lid]); }
        else { await pool.query(`INSERT INTO user_roles (id,user_id,role,created_at,updated_at) VALUES (gen_random_uuid(),$1,'admin',NOW(),NOW())`, [lid]); }
      } catch(e) { console.error("[Dev Login]", e); }
      req.login({ claims: { sub: devUserId, email: devEmail, first_name: "開發", last_name: "管理員" }, expires_at: Math.floor(Date.now()/1000)+86400*7 } as any, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        req.session.save(() => res.redirect("/"));
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.expires_at) return res.status(401).json({ message: "Unauthorized" });
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) { if (req.session) req.session.touch(); return next(); }
  if (user.claims?.sub?.startsWith("local_")) { user.expires_at = Math.floor(Date.now()/1000)+86400*7; if (req.session) req.session.touch(); return next(); }
  res.status(401).json({ message: "Unauthorized" });
};
