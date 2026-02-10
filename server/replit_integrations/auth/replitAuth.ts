import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "auth_sessions",
  });
  const isDev = process.env.NODE_ENV === "development";
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isDev, // Allow non-HTTPS in development
      sameSite: isDev ? 'lax' : 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // Development-only login bypass for testing
  if (process.env.NODE_ENV === "development") {
    app.get("/api/dev-login", async (req, res) => {
      const devUserId = "99999999";
      const devEmail = "dev@wechurch.test";
      const devFirstName = "開發";
      const devLastName = "管理員";
      
      try {
        const { pool } = await import("../../db");
        
        // Step 1: Upsert auth_users - delete first then insert to avoid conflicts
        await pool.query(`DELETE FROM auth_users WHERE id = $1 OR email = $2`, [devUserId, devEmail]);
        await pool.query(
          `INSERT INTO auth_users (id, email, first_name, last_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [devUserId, devEmail, devFirstName, devLastName]
        );
        
        // Step 2: Upsert users table for role assignment
        const userResult = await pool.query(
          `INSERT INTO users (id, email, password, display_name, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'dev', $2, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET display_name = $2, updated_at = NOW()
           RETURNING id`,
          [devEmail, `${devFirstName}${devLastName}`]
        );
        const legacyUserId = userResult.rows[0].id;
        
        // Step 3: Assign admin role
        const roleCheck = await pool.query(`SELECT id FROM user_roles WHERE user_id = $1`, [legacyUserId]);
        if (roleCheck.rows.length > 0) {
          await pool.query(`UPDATE user_roles SET role = 'admin', updated_at = NOW() WHERE user_id = $1`, [legacyUserId]);
        } else {
          await pool.query(
            `INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (gen_random_uuid(), $1, 'admin', NOW(), NOW())`,
            [legacyUserId]
          );
        }
        
        console.log("[Dev Login] Setup complete. Auth ID:", devUserId, "Legacy ID:", legacyUserId);
      } catch (error) {
        console.error("[Dev Login] Database setup error:", error);
      }
      
      // Create session
      const user: any = {
        claims: { sub: devUserId, email: devEmail, first_name: devFirstName, last_name: devLastName },
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
      };
      
      req.login(user, (err) => {
        if (err) {
          console.error("[Dev Login] Session error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        // Force session save before redirect
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[Dev Login] Session save error:", saveErr);
          }
          console.log("[Dev Login] Session saved, redirecting...");
          res.redirect("/");
        });
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    if (req.session) {
      req.session.touch();
    }
    return next();
  }

  const isLocalUser = user.claims?.sub?.startsWith("local_");

  if (isLocalUser) {
    user.expires_at = Math.floor(Date.now() / 1000) + 86400 * 7;
    if (req.session) {
      req.session.touch();
    }
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    console.warn("[Auth] Token refresh failed:", error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
