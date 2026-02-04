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
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
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
      const devUserId = "dev-admin-001";
      const devUser = {
        id: devUserId,
        email: "dev@wechurch.test",
        firstName: "開發",
        lastName: "管理員",
        profileImageUrl: null,
      };
      
      // Upsert dev user to database
      await authStorage.upsertUser(devUser);
      
      // Also ensure dev user has admin role in user_roles table
      // We'll set the role via a direct database query
      try {
        const { pool } = await import("../../db");
        
        // Check if user exists in users table, if not create them
        const userCheck = await pool.query(
          `INSERT INTO users (id, email, password, display_name, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'dev-no-password', $2, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET display_name = $2, updated_at = NOW()
           RETURNING id`,
          [devUser.email, `${devUser.firstName}${devUser.lastName}`]
        );
        
        const legacyUserId = userCheck.rows[0].id;
        
        // Upsert admin role for this user
        const existingRole = await pool.query(
          `SELECT id FROM user_roles WHERE user_id = $1`,
          [legacyUserId]
        );
        
        if (existingRole.rows.length > 0) {
          await pool.query(
            `UPDATE user_roles SET role = 'admin', updated_at = NOW() WHERE user_id = $1`,
            [legacyUserId]
          );
        } else {
          await pool.query(
            `INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, 'admin', NOW(), NOW())`,
            [legacyUserId]
          );
        }
        
        console.log("[Dev Login] Created/updated dev admin user with legacy ID:", legacyUserId);
      } catch (error) {
        console.error("[Dev Login] Error setting up admin role:", error);
      }
      
      // Create session with dev user claims
      const user: any = {
        claims: {
          sub: devUserId,
          email: devUser.email,
          first_name: devUser.firstName,
          last_name: devUser.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
      };
      
      req.login(user, (err) => {
        if (err) {
          console.error("[Dev Login] Error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.redirect("/");
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
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
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
