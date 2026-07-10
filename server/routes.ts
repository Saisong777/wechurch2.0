import type { Express, RequestHandler } from "express";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { careActions, careContacts, insertSessionSchema, insertParticipantSchema, insertSubmissionSchema, insertStudyResponseSchema, insertSavedVerseSchema, insertGroupingActivitySchema, insertGroupingParticipantSchema, insertDevotionalNoteSchema, prayerMeetings, prayerMeetingParticipants, userEmailPreferences } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { pool, getPoolStats } from "./db";
import { bibleCache, timelineCache, apiCache, sessionCache, prayerCache, cacheKeys } from "./cache";
import { getKnownChurchOptions, normalizeChurch, UNASSIGNED_CHURCH_ID } from "./churches";
import {
  canAssignCrmScopes,
  filterPotentialMembersForCrmAccess,
  filterUsersForCrmAccess,
  getCrmAccessContext,
} from "./crmPermissions";
import { buildLoveJourneyTemplateSeed } from "./loveJourneyTemplate";
import {
  createNextStepTaskForPerson,
  createPastoralTask,
  dismissPersonMergeSuggestion,
  ensureLoveJourneyTemplate,
  getPastoralPersonDetail,
  getPastoralPersons,
  getSelfLoveJourney,
  isPastoralSchemaMissingError,
  listPersonMergeSuggestions,
  listPastoralTasks,
  mergePastoralPersons,
  reconcilePastoralPersons,
  startLoveJourneyForPerson,
  startSelfLoveJourney,
  updatePastoralTask,
  updateSelfJourneyProgress,
  updateJourneyMilestone,
  updateJourneyProgress,
} from "./pastoralJourneyRepository";
import {
  createServingAssignment,
  createServingEvent,
  createServingRole,
  createServingTeam,
  createServingTeamMember,
  getServingScheduleOverview,
  isServingSchemaMissingError,
  seedDefaultServingTeams,
  updateServingAssignment,
  updateServingEventStatus,
} from "./servingScheduleRepository";
import {
  createFacilityBooking,
  createFacilityRoom,
  FacilityBookingConflictError,
  getFacilityBookingOverview,
  isFacilitySchemaMissingError,
  seedDefaultFacilityRooms,
  updateFacilityBookingStatus,
} from "./facilityBookingRepository";
import {
  getPastoralFrameworkOverview,
  isPastoralFrameworkSchemaMissingError,
  seedPastoralFramework153,
  updatePersonPastoralStage,
} from "./pastoralFrameworkRepository";
import {
  ensureLineLinkedUser,
  isLineSchemaMissingError,
  type LineVerifiedProfile,
} from "./lineIntegrationRepository";
import {
  parseAuthenticatedPrayerBody,
  parseDevotionalNotePatch,
  prayerCommentBodySchema,
  prayerPatchSchema,
} from "./securityPolicies";
import compression from "compression";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SINGLE_NOTE_SYSTEM_PROMPT,
  MULTI_NOTE_SYSTEM_PROMPT,
  GROUP_SMALL_SYSTEM_PROMPT,
  GROUP_LARGE_SYSTEM_PROMPT,
  GROUP_OVERALL_SYSTEM_PROMPT,
  formatSingleNoteInput,
  formatMultiNoteInput,
  formatGroupNotesInput,
  formatReportDataDashboard,
} from "./prompts/devotional-analysis";
import type { ReportDashboardNote } from "./prompts/devotional-analysis";
import {
  getPlatformSummary,
  getProductGrowthBrief,
  recordAiUsage,
  recordAppEvent,
  recordErrorEvent,
  requestContext,
  scoreAiReportQuality,
} from "./observability";
import { buildFallbackDailyDevotionBrief, fetchDailyDevotionBrief } from "./dailyDevotion";
import { releaseFlags } from "@shared/releaseFlags";

// Legacy proxy client (keep for unchanged endpoints until fully migrated)
let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openaiClient;
}

// Native Google Gemini client (bypasses proxy, uses direct billing)
let _geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  if (!_geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");
    _geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return _geminiClient;
}

const gameCreationLocks = new Map<string, Promise<any>>();
const careContactBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional().nullable(),
  need: z.string().trim().max(500).optional(),
  nextAction: z.string().trim().max(300).optional(),
  prayer: z.string().trim().max(500).optional(),
  source: z.string().trim().max(60).optional(),
  visibility: z.enum(["private", "pastoral", "team"]).optional(),
});
const careContactPatchSchema = careContactBodySchema.partial().extend({
  isArchived: z.boolean().optional(),
});
const careActionBodySchema = z.object({
  actionType: z.string().trim().min(1).max(40).default("note"),
  note: z.string().trim().max(500).optional(),
});
const careActionTypesThatUpdateLastCared = new Set(["care", "message", "visit", "call", "invite"]);
const crmScopeAssignmentBodySchema = z.object({
  assigneeUserId: z.string().uuid(),
  scopeType: z.enum(["church", "group", "member"]),
  church: z.string().trim().max(120).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  memberUserId: z.string().uuid().optional().nullable(),
  potentialMemberId: z.string().uuid().optional().nullable(),
  canViewPersonal: z.boolean().optional(),
  canManageCare: z.boolean().optional(),
  canManageMembers: z.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scopeType === "church" && !data.church) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["church"], message: "Church is required for church scope" });
  }
  if (data.scopeType === "group" && !data.groupId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groupId"], message: "Group is required for group scope" });
  }
  if (data.scopeType === "member" && !data.memberUserId && !data.potentialMemberId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["memberUserId"], message: "Member is required for member scope" });
  }
});
const crmGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  church: z.string().trim().min(1).max(120),
  leaderUserId: z.string().uuid().optional().nullable(),
  pastorUserId: z.string().uuid().optional().nullable(),
});
const crmGroupMemberBodySchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  potentialMemberId: z.string().uuid().optional().nullable(),
  memberEmail: z.string().email().optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.userId && !data.potentialMemberId && !data.memberEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["userId"], message: "Member identifier is required" });
  }
});
const journeyProgressPatchSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "skipped"]).optional(),
  responseText: z.string().max(4000).optional().nullable(),
  mentorNote: z.string().max(4000).optional().nullable(),
  needsFollowUp: z.boolean().optional(),
});
const journeyMilestonePatchSchema = z.object({
  status: z.enum(["planned", "scheduled", "completed", "skipped"]).optional(),
  note: z.string().max(4000).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});
const pastoralTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueAt: z.string().optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  sourceType: z.string().trim().max(80).optional().nullable(),
  sourceId: z.string().trim().max(120).optional().nullable(),
  visibility: z.enum(["private", "pastoral", "team"]).optional(),
});
const pastoralTaskPatchSchema = pastoralTaskBodySchema.partial().extend({
  status: z.enum(["open", "done", "deferred", "cancelled"]).optional(),
});
const mergeSuggestionBodySchema = z.object({
  primaryPersonId: z.string().uuid(),
  duplicatePersonId: z.string().uuid(),
});
const servingTeamBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(800).optional().nullable(),
  leaderUserId: z.string().uuid().optional().nullable(),
  defaultLocation: z.string().trim().max(160).optional().nullable(),
  defaultStartTime: z.string().trim().max(20).optional().nullable(),
});
const servingRoleBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  requiredCount: z.number().int().min(1).max(20).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
const servingMemberBodySchema = z.object({
  personId: z.string().uuid(),
  roleLabel: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});
const servingEventBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  serviceDate: z.string().trim().min(8).max(20),
  startTime: z.string().trim().max(20).optional().nullable(),
  endTime: z.string().trim().max(20).optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(800).optional().nullable(),
});
const servingAssignmentBodySchema = z.object({
  eventId: z.string().uuid(),
  roleId: z.string().uuid(),
  personId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "declined", "substitute", "done", "cancelled"]).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});
const servingAssignmentPatchSchema = z.object({
  status: z.enum(["pending", "confirmed", "declined", "substitute", "done", "cancelled"]).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});
const servingEventStatusSchema = z.object({
  status: z.enum(["draft", "published", "completed", "cancelled"]),
});
const facilityRoomBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["classroom", "small_group", "service", "meeting", "event", "kids", "youth", "maintenance"]).optional(),
  location: z.string().trim().max(160).optional().nullable(),
  capacity: z.number().int().min(1).max(500).optional(),
  description: z.string().trim().max(800).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
});
const facilityBookingBodySchema = z.object({
  roomId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  purpose: z.enum([
    "small_group",
    "classroom",
    "service",
    "event",
    "meeting",
    "pastoral",
    "outside_rental",
    "children",
    "youth",
    "prayer",
    "visit",
    "worship_night",
    "maintenance",
  ]).optional(),
  requesterPersonId: z.string().uuid().optional().nullable(),
  startAt: z.string().trim().min(10).max(40),
  endAt: z.string().trim().min(10).max(40),
  priority: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().max(800).optional().nullable(),
  allowConflict: z.boolean().optional(),
});
const facilityBookingStatusSchema = z.object({
  status: z.enum(["pending", "approved", "declined", "cancelled", "completed"]),
});
const personStagePatchSchema = z.object({
  stageSlug: z.enum(["friend", "family", "follow", "firemaker", "frame", "follower", "leader", "newcomer", "member", "care"]),
  note: z.string().trim().max(800).optional().nullable(),
});

function getPublicBaseUrl(req: any) {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.host || "localhost:5001";
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

function getLineLoginConfig(req: any) {
  const callbackPath = process.env.LINE_CALLBACK_PATH || "/api/line-login/callback";
  const baseUrl = getPublicBaseUrl(req);
  const callbackUrl = process.env.LINE_CALLBACK_URL || `${baseUrl}${callbackPath}`;
  const channelId = process.env.LINE_CHANNEL_ID || process.env.LINE_LOGIN_CHANNEL_ID || "";
  const channelSecret = process.env.LINE_CHANNEL_SECRET || process.env.LINE_LOGIN_CHANNEL_SECRET || "";
  return {
    configured: Boolean(channelId && channelSecret),
    channelId,
    channelSecret,
    liffId: process.env.LINE_LIFF_ID || "",
    officialAccountId: process.env.LINE_OFFICIAL_ACCOUNT_ID || "",
    callbackPath,
    callbackUrl,
  };
}

function getSafeRedirectPath(value: unknown) {
  const redirectPath = typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
  return redirectPath.slice(0, 240);
}

async function exchangeLineCodeForProfile(input: {
  code: string;
  redirectUri: string;
  channelId: string;
  channelSecret: string;
  expectedNonce?: string | null;
}): Promise<LineVerifiedProfile> {
  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.channelId,
      client_secret: input.channelSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`LINE token exchange failed: ${tokenResponse.status} ${text}`);
  }

  const tokenJson = await tokenResponse.json() as { id_token?: string };
  if (!tokenJson.id_token) {
    throw new Error("LINE token response did not include id_token");
  }

  const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: tokenJson.id_token,
      client_id: input.channelId,
    }),
  });

  if (!verifyResponse.ok) {
    const text = await verifyResponse.text();
    throw new Error(`LINE id_token verify failed: ${verifyResponse.status} ${text}`);
  }

  const profile = await verifyResponse.json() as {
    sub?: string;
    name?: string;
    picture?: string;
    email?: string;
    aud?: string;
    nonce?: string;
  };

  if (!profile.sub) throw new Error("LINE verified profile did not include sub");
  if (profile.aud && profile.aud !== input.channelId) throw new Error("LINE id_token audience mismatch");
  if (input.expectedNonce && profile.nonce && profile.nonce !== input.expectedNonce) {
    throw new Error("LINE nonce mismatch");
  }

  return {
    lineUserId: profile.sub,
    displayName: profile.name ?? null,
    pictureUrl: profile.picture ?? null,
    email: profile.email ?? null,
    channelId: input.channelId,
  };
}

function getSoulGymAiModel(fastMode?: boolean): string {
  if (process.env.SOULGYM_AI_MODEL) return process.env.SOULGYM_AI_MODEL;
  if (fastMode) return process.env.SOULGYM_AI_FAST_MODEL || "gemini-2.5-flash-lite";
  return "gemini-2.5-flash";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithAiRetry<T>(operation: () => Promise<T>, options: { maxRetries?: number } = {}) {
  const maxRetries = options.maxRetries ?? 2;
  let retryCount = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return { result: await operation(), retryCount };
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || error);
      const retryable = error?.status === 429 || error?.status === 500 || error?.status === 503 || /429|rate|timeout|temporar/i.test(message);
      if (!retryable || attempt === maxRetries) break;
      retryCount += 1;
      await sleep(700 * retryCount);
    }
  }

  throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), { retryCount });
}

function prependReportDashboard(
  notesInput: string,
  dashboardNotes: ReportDashboardNote[],
  options: { reportType: "group" | "overall"; groupNumber?: number | null; model: string; fastMode?: boolean }
): string {
  return `${formatReportDataDashboard(dashboardNotes, options)}\n\n${notesInput}`;
}

// Configure multer for file uploads
const messageCardStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'message-cards');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const uploadMessageCard = multer({
  storage: messageCardStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

type AppRole = "member" | "leader" | "future_leader" | "admin" | "senior_pastor" | "pastor" | "minister" | "group_leader";

const knownChurches = getKnownChurchOptions();

function sanitizeUserRecord<T extends Record<string, any>>(user: T) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export async function registerRoutes(app: Express) {
  app.use('/assets', express.static(path.join(process.cwd(), 'dist/public/assets'), {
    maxAge: '30d',
    immutable: true,
  }));

  app.use(compression());

  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60000;
  const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.API_RATE_LIMIT_MAX || "200", 10);
  const RATE_LIMIT_WRITE_MAX_REQUESTS = Number.parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "120", 10);
  const RATE_LIMIT_LIVE_READ_MAX_REQUESTS = Number.parseInt(process.env.API_LIVE_READ_RATE_LIMIT_MAX || "2000", 10);

  const rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 30000);
  rateLimitCleanup.unref?.();

  const getApiPath = (req: any) => req.originalUrl.split("?")[0];

  const isLiveReadEndpoint = (req: any) => {
    if (req.method !== "GET") return false;
    const apiPath = getApiPath(req);
    return (
      /^\/api\/sessions\/[^/]+\/poll$/.test(apiPath) ||
      /^\/api\/sessions\/[^/]+$/.test(apiPath) ||
      /^\/api\/sessions\/by-code\/[^/]+$/.test(apiPath) ||
      /^\/api\/sessions\/[^/]+\/participants(\/.*)?$/.test(apiPath) ||
      /^\/api\/study-responses\/[^/]+\/[^/]+$/.test(apiPath) ||
      apiPath === "/api/feature-toggles"
    );
  };

  const decodePathValue = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const getRateLimitIdentity = (req: any) => {
    const apiPath = getApiPath(req);
    const authUserId = req.user?.id || req.user?.claims?.sub;
    const emailInPath = apiPath.match(/\/participants\/by-email\/([^/]+)$/)?.[1];
    const participantInPath = apiPath.match(/\/participants\/([^/]+)$/)?.[1];
    const headerParticipant = req.get?.("x-participant-id");
    const ip = req.ip || "unknown";

    const identity =
      authUserId ||
      headerParticipant ||
      (emailInPath ? decodePathValue(emailInPath) : null) ||
      (participantInPath && participantInPath !== "by-email" ? participantInPath : null) ||
      ip ||
      "unknown";

    return `${ip}:${String(identity).trim().toLowerCase()}`;
  };

  app.use('/api/', (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const isLiveRead = isLiveReadEndpoint(req);
    const isWrite = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    const limit = isLiveRead
      ? RATE_LIMIT_LIVE_READ_MAX_REQUESTS
      : isWrite
        ? RATE_LIMIT_WRITE_MAX_REQUESTS
        : RATE_LIMIT_MAX_REQUESTS;
    const scope = isLiveRead ? "live" : isWrite ? "write" : "read";
    const clientId = `${scope}:${getRateLimitIdentity(req)}`;
    const now = Date.now();

    let entry = rateLimitMap.get(clientId);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitMap.set(clientId, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - entry.count).toString());

    if (entry.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    next();
  });

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  async function resolveUserId(req: any): Promise<string | null> {
    const user = req.user;
    if (!user) return null;

    const claims = user.claims || {};
    const authUserId = claims.sub;
    if (!authUserId) return null;

    if (typeof authUserId === 'string' && authUserId.startsWith('local_')) {
      const localId = authUserId.replace('local_', '');
      const localUser = await storage.getUser(localId);
      if (localUser) return localId;
    }

    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);
      if (fullUser?.legacyUserId) return fullUser.legacyUserId;
      if (fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) return legacyUser.id;
      }
    } catch (error) {
      console.error('[resolveUserId] Error resolving user:', error);
    }

    if (claims.email) {
      const legacyUser = await storage.getUserByEmail(claims.email);
      if (legacyUser) return legacyUser.id;
    }

    return null;
  }

  const requireRole = (...roles: AppRole[]): RequestHandler => async (req, res, next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const role = await storage.getUserRole(userId);
      if (!role || !roles.includes(role as AppRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      (req as any).legacyUserId = userId;
      (req as any).userRole = role;
      next();
    } catch (error) {
      console.error("[auth] Failed to check role:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };

  const requireSelfOrRole = (paramName: string, ...roles: AppRole[]): RequestHandler => async (req, res, next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (req.params[paramName] === userId) {
        (req as any).legacyUserId = userId;
        return next();
      }
      const role = await storage.getUserRole(userId);
      if (role && roles.includes(role as AppRole)) {
        (req as any).legacyUserId = userId;
        (req as any).userRole = role;
        return next();
      }
      return res.status(403).json({ error: "Forbidden" });
    } catch (error) {
      console.error("[auth] Failed to check ownership:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };

  const crmLeaderRoles: AppRole[] = ["admin", "senior_pastor", "pastor", "minister", "group_leader", "leader", "future_leader"];
  const requireSessionManager = requireRole(...crmLeaderRoles);
  const requireLeader = requireRole(...crmLeaderRoles);
  const requireCrmDirector = requireRole("admin", "senior_pastor");
  const requireAdmin = requireRole("admin");

  const requireReleaseFeature = (featureKey: string): RequestHandler => async (_req, res, next) => {
    try {
      const feature = await storage.getFeatureToggle(featureKey);
      if (!feature) {
        return res.status(503).json({
          error: "Feature flag is not ready",
          featureKey,
          featureReady: false,
        });
      }
      if (!feature.isEnabled) {
        return res.status(404).json({
          error: "Feature is not available",
          featureKey,
          featureEnabled: false,
        });
      }
      return next();
    } catch (error) {
      console.error(`[release] Failed to read feature flag ${featureKey}:`, error);
      return res.status(503).json({ error: "Feature flag unavailable", featureKey });
    }
  };

  app.use("/api/pastoral", requireReleaseFeature(releaseFlags.pastoral));
  app.use("/api/me/love-journey", requireReleaseFeature(releaseFlags.pastoral));
  app.use("/api/care", requireReleaseFeature(releaseFlags.pastoral));
  app.use("/api/serving", requireReleaseFeature(releaseFlags.serving));
  app.use("/api/facilities", requireReleaseFeature(releaseFlags.facilities));
  app.use("/api/line-login", requireReleaseFeature(releaseFlags.lineLogin));

  const sessionManagerRoles: AppRole[] = crmLeaderRoles;

  const getChurchScope = async (req: any): Promise<string | null> => {
    const userId = req.legacyUserId || await resolveUserId(req);
    if (!userId) return null;

    const [role, currentUser] = await Promise.all([
      storage.getUserRole(userId),
      storage.getUser(userId),
    ]);
    const requestedChurch = normalizeChurch(typeof req.query?.church === "string" ? req.query.church : null);

    if (role === "admin") {
      if (requestedChurch && requestedChurch !== "all") return requestedChurch;
      if (requestedChurch === "all") return null;
      return normalizeChurch(currentUser?.church);
    }

    if (role === "senior_pastor") {
      const ownChurch = normalizeChurch(currentUser?.church);
      if (requestedChurch && requestedChurch !== "all" && requestedChurch === ownChurch) return requestedChurch;
      return ownChurch || UNASSIGNED_CHURCH_ID;
    }

    return normalizeChurch(currentUser?.church) || UNASSIGNED_CHURCH_ID;
  };

  const getRequestRole = async (req: any): Promise<AppRole | null> => {
    const userId = await resolveUserId(req);
    if (!userId) return null;
    const role = await storage.getUserRole(userId);
    return role ? role as AppRole : null;
  };

  const canManageSession = async (req: any): Promise<boolean> => {
    const role = await getRequestRole(req);
    return !!role && sessionManagerRoles.includes(role);
  };

  const getCrmAccessForRequest = async (req: any) => {
    const userId = req.legacyUserId || await resolveUserId(req);
    if (!userId) return null;
    const role = await storage.getUserRole(userId);
    return getCrmAccessContext(userId, role);
  };

  const sanitizeParticipant = (participant: any) => ({
    id: participant.id,
    sessionId: participant.sessionId,
    name: participant.name,
    gender: participant.gender,
    groupNumber: participant.groupNumber,
    group_number: participant.groupNumber,
    location: participant.location,
    readyConfirmed: participant.readyConfirmed,
    ready_confirmed: participant.readyConfirmed,
    joinedAt: participant.joinedAt,
    updatedAt: participant.updatedAt,
  });

  const filterReportsForParticipant = (reports: any[], participant: any) => reports.filter((report) => {
    if (report.reportType === "overall" || report.groupNumber === null || report.groupNumber === 0) return true;
    return participant.groupNumber !== null && report.groupNumber === participant.groupNumber;
  });

  // Register health check FIRST - before any auth setup that might fail
  app.get("/api/health", async (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/events", async (req, res) => {
    const eventSchema = z.object({
      eventName: z.string().min(1).max(120),
      path: z.string().max(500).optional(),
      sessionId: z.string().uuid().optional(),
      participantId: z.string().uuid().optional(),
      userEmail: z.string().email().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid event data" });
    }

    const context = requestContext(req);
    await recordAppEvent({
      ...parsed.data,
      source: "client",
      path: parsed.data.path || context.path,
      userAgent: context.userAgent,
      ipHash: context.ipHash,
    });
    res.status(202).json({ success: true });
  });

  app.post("/api/client-errors", async (req, res) => {
    const errorSchema = z.object({
      message: z.string().min(1).max(2000),
      stack: z.string().max(6000).optional(),
      path: z.string().max(500).optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const parsed = errorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid error data" });
    }

    const context = requestContext(req);
    await recordErrorEvent({
      source: "client",
      message: parsed.data.message,
      stack: parsed.data.stack,
      path: parsed.data.path || context.path,
      method: context.method,
      metadata: parsed.data.metadata,
      userAgent: context.userAgent,
      ipHash: context.ipHash,
    });
    res.status(202).json({ success: true });
  });

  // Setup auth with error handling
  try {
    await setupAuth(app);
    registerAuthRoutes(app);
    console.log("[Routes] Auth setup completed successfully");
  } catch (error) {
    console.error("[Routes] Auth setup failed:", error);
    // Continue without auth - routes will still work but auth will fail
  }

  // Health check endpoint - detailed with database
  app.get("/api/health/detailed", requireAdmin, async (req, res) => {
    const startTime = Date.now();
    let dbStatus = "ok";
    let dbLatency = 0;

    try {
      const dbStart = Date.now();
      await pool.query("SELECT 1");
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbStatus = "error";
    }

    const poolStats = getPoolStats();

    res.json({
      status: dbStatus === "ok" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      database: {
        status: dbStatus,
        latency: dbLatency,
        pool: poolStats
      },
      cache: {
        bible: bibleCache.getStats(),
        timeline: timelineCache.getStats(),
        api: apiCache.getStats()
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: "MB"
      }
    });
  });

  app.get("/api/admin/platform-summary", requireAdmin, async (req, res) => {
    try {
      const summary = await getPlatformSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to get platform summary" });
    }
  });

  app.get("/api/admin/product-growth-brief", requireAdmin, async (req, res) => {
    try {
      const brief = await getProductGrowthBrief();
      res.json(brief);
    } catch (error) {
      console.error("Error fetching product growth brief:", error);
      res.status(500).json({ error: "Failed to get product growth brief" });
    }
  });

  app.get("/api/churches", requireLeader, async (req, res) => {
    try {
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const role = userId ? await storage.getUserRole(userId) : null;
      const currentUser = userId ? await storage.getUser(userId) : null;

      if (role !== "admin") {
        const church = normalizeChurch(currentUser?.church);
        return res.json(church ? [{ id: church, name: church }] : knownChurches);
      }

      const usersResult = await pool.query(
        "SELECT DISTINCT church FROM users WHERE church IS NOT NULL AND trim(church) <> '' ORDER BY church"
      );
      const potentialResult = await pool.query(
        "SELECT DISTINCT church FROM potential_members WHERE church IS NOT NULL AND trim(church) <> '' ORDER BY church"
      );
      const unassignedResult = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE church IS NULL OR trim(church) = '')::int
          +
          (SELECT COUNT(*) FROM potential_members WHERE church IS NULL OR trim(church) = '')::int
          AS count
      `);

      const seen = new Set<string>();
      const churches = [...knownChurches];
      for (const church of churches) seen.add(church.id);
      for (const row of [...usersResult.rows, ...potentialResult.rows]) {
        const value = normalizeChurch(row.church);
        if (value && !seen.has(value)) {
          seen.add(value);
          churches.push({ id: value, name: value });
        }
      }
      if ((unassignedResult.rows[0]?.count || 0) > 0) {
        churches.push({ id: UNASSIGNED_CHURCH_ID, name: "未分配教會" });
      }

      res.json(churches);
    } catch (error) {
      console.error("Error fetching churches:", error);
      res.status(500).json({ error: "Failed to get churches" });
    }
  });

  app.get("/api/crm/access", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const role = await storage.getUserRole(userId);
      const access = await getCrmAccessContext(userId, role);
      res.json({
        role: access.role,
        canEnterCrm: access.canEnterCrm,
        accessLevel: access.accessLevel,
        canAssignScopes: access.canAssignScopes,
        canManageMembers: access.canManageMembers,
        canManageCare: access.canManageCare,
        canViewPersonal: access.canViewPersonal,
        scope: {
          churches: access.churchScopes,
          groups: access.groupIds,
          members: access.userIds.filter((id) => id !== userId).length + access.potentialMemberIds.length,
        },
      });
    } catch (error) {
      console.error("Error fetching CRM access:", error);
      res.status(500).json({ error: "Failed to get CRM access" });
    }
  });

  app.get("/api/crm/scope-assignments", requireCrmDirector, async (req, res) => {
    try {
      const directorUserId = (req as any).legacyUserId || await resolveUserId(req);
      const directorRole = directorUserId ? await storage.getUserRole(directorUserId) : null;
      if (!canAssignCrmScopes(directorRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const director = directorUserId ? await storage.getUser(directorUserId) : undefined;
      const directorChurch = normalizeChurch(director?.church);
      const result = directorRole === "senior_pastor" && directorChurch
        ? await pool.query(
            `SELECT a.*, u.display_name AS assignee_name, u.email AS assignee_email
               FROM crm_scope_assignments a
               JOIN users u ON u.id = a.assignee_user_id
              WHERE a.is_active = true
                AND (
                  a.church = $1
                  OR a.group_id IN (SELECT id FROM small_groups WHERE church = $1)
                  OR a.member_user_id IN (SELECT id FROM users WHERE church = $1)
                  OR a.potential_member_id IN (SELECT id FROM potential_members WHERE church = $1)
                )
              ORDER BY a.created_at DESC`,
            [directorChurch]
          )
        : await pool.query(
            `SELECT a.*, u.display_name AS assignee_name, u.email AS assignee_email
               FROM crm_scope_assignments a
               JOIN users u ON u.id = a.assignee_user_id
              WHERE a.is_active = true
              ORDER BY a.created_at DESC`
          );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching CRM assignments:", error);
      res.status(500).json({ error: "Failed to get CRM assignments" });
    }
  });

  app.post("/api/crm/scope-assignments", requireCrmDirector, async (req, res) => {
    try {
      const input = crmScopeAssignmentBodySchema.parse(req.body);
      const directorUserId = (req as any).legacyUserId || await resolveUserId(req);
      const directorRole = directorUserId ? await storage.getUserRole(directorUserId) : null;
      if (!directorUserId || !canAssignCrmScopes(directorRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const director = await storage.getUser(directorUserId);
      const directorChurch = normalizeChurch(director?.church);
      const normalizedChurch = normalizeChurch(input.church);

      if (directorRole === "senior_pastor") {
        if (input.scopeType === "church" && normalizedChurch !== directorChurch) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (input.scopeType === "group") {
          const groupResult = await pool.query("SELECT church FROM small_groups WHERE id = $1", [input.groupId]);
          if (normalizeChurch(groupResult.rows[0]?.church) !== directorChurch) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        if (input.scopeType === "member" && input.memberUserId) {
          const target = await storage.getUser(input.memberUserId);
          if (normalizeChurch(target?.church) !== directorChurch) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        if (input.scopeType === "member" && input.potentialMemberId) {
          const targetResult = await pool.query("SELECT church FROM potential_members WHERE id = $1", [input.potentialMemberId]);
          if (normalizeChurch(targetResult.rows[0]?.church) !== directorChurch) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
      }

      const result = await pool.query(
        `INSERT INTO crm_scope_assignments (
          assignee_user_id, assigned_by_user_id, scope_type, church, group_id,
          member_user_id, potential_member_id, can_view_personal, can_manage_care,
          can_manage_members, note, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *`,
        [
          input.assigneeUserId,
          directorUserId,
          input.scopeType,
          normalizedChurch,
          input.groupId || null,
          input.memberUserId || null,
          input.potentialMemberId || null,
          input.canViewPersonal ?? false,
          input.canManageCare ?? true,
          input.canManageMembers ?? false,
          input.note || null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating CRM assignment:", error);
      res.status(400).json({ error: "Failed to create CRM assignment" });
    }
  });

  app.delete("/api/crm/scope-assignments/:id", requireCrmDirector, async (req, res) => {
    try {
      const directorUserId = (req as any).legacyUserId || await resolveUserId(req);
      const directorRole = directorUserId ? await storage.getUserRole(directorUserId) : null;
      if (!canAssignCrmScopes(directorRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await pool.query(
        "UPDATE crm_scope_assignments SET is_active = false, updated_at = NOW() WHERE id = $1",
        [req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting CRM assignment:", error);
      res.status(500).json({ error: "Failed to delete CRM assignment" });
    }
  });

  app.get("/api/crm/groups", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const requestedChurch = normalizeChurch(typeof req.query?.church === "string" ? req.query.church : null);
      const params: any[] = [];
      const conditions = ["g.is_active = true"];

      if (access.role !== "admin") {
        if (access.role === "senior_pastor" && access.churchScopes.length > 0) {
          params.push(access.churchScopes);
          conditions.push(`g.church = ANY($${params.length}::text[])`);
        } else {
          const scopeConditions: string[] = [];
          if (access.churchScopes.length > 0) {
            params.push(access.churchScopes);
            scopeConditions.push(`g.church = ANY($${params.length}::text[])`);
          }
          if (access.groupIds.length > 0) {
            params.push(access.groupIds);
            scopeConditions.push(`g.id = ANY($${params.length}::uuid[])`);
          }
          if (scopeConditions.length === 0) return res.json([]);
          conditions.push(`(${scopeConditions.join(" OR ")})`);
        }
      }

      if (requestedChurch && requestedChurch !== "all") {
        params.push(requestedChurch);
        conditions.push(`g.church = $${params.length}`);
      }

      const result = await pool.query(
        `SELECT
          g.id,
          g.name,
          g.church,
          g.leader_user_id AS "leaderUserId",
          g.pastor_user_id AS "pastorUserId",
          leader.display_name AS "leaderName",
          pastor.display_name AS "pastorName",
          COUNT(m.id)::int AS "memberCount"
        FROM small_groups g
        LEFT JOIN users leader ON leader.id = g.leader_user_id
        LEFT JOIN users pastor ON pastor.id = g.pastor_user_id
        LEFT JOIN small_group_members m ON m.group_id = g.id AND m.is_active = true
        WHERE ${conditions.join(" AND ")}
        GROUP BY g.id, leader.display_name, pastor.display_name
        ORDER BY g.church, g.name`,
        params
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching CRM groups:", error);
      res.status(500).json({ error: "Failed to get CRM groups" });
    }
  });

  app.post("/api/crm/groups", requireCrmDirector, async (req, res) => {
    try {
      const input = crmGroupBodySchema.parse(req.body);
      const creatorUserId = (req as any).legacyUserId || await resolveUserId(req);
      const creatorRole = creatorUserId ? await storage.getUserRole(creatorUserId) : null;
      const creator = creatorUserId ? await storage.getUser(creatorUserId) : undefined;
      const church = normalizeChurch(input.church);

      if (!church) {
        return res.status(400).json({ error: "Church is required" });
      }
      if (creatorRole === "senior_pastor" && normalizeChurch(creator?.church) !== church) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await pool.query(
        `INSERT INTO small_groups (church, name, leader_user_id, pastor_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, church, leader_user_id AS "leaderUserId", pastor_user_id AS "pastorUserId"`,
        [church, input.name, input.leaderUserId || null, input.pastorUserId || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating CRM group:", error);
      res.status(400).json({ error: "Failed to create CRM group" });
    }
  });

  app.post("/api/crm/groups/:id/members", requireLeader, async (req, res) => {
    try {
      const input = crmGroupMemberBodySchema.parse(req.body);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const groupResult = await pool.query("SELECT id, church FROM small_groups WHERE id = $1 AND is_active = true", [req.params.id]);
      const group = groupResult.rows[0];
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (access.role !== "admin" && access.role !== "senior_pastor") {
        const canUseGroup = access.groupIds.includes(group.id) || access.churchScopes.includes(normalizeChurch(group.church) || "");
        if (!canUseGroup) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      if (input.userId) {
        await pool.query("UPDATE small_group_members SET is_active = false, updated_at = NOW() WHERE user_id = $1", [input.userId]);
      }
      if (input.potentialMemberId) {
        await pool.query("UPDATE small_group_members SET is_active = false, updated_at = NOW() WHERE potential_member_id = $1", [input.potentialMemberId]);
      }
      if (input.memberEmail) {
        await pool.query("UPDATE small_group_members SET is_active = false, updated_at = NOW() WHERE lower(member_email) = lower($1)", [input.memberEmail]);
      }

      const result = await pool.query(
        `INSERT INTO small_group_members (group_id, user_id, potential_member_id, member_email, joined_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [req.params.id, input.userId || null, input.potentialMemberId || null, input.memberEmail || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error assigning CRM group member:", error);
      res.status(400).json({ error: "Failed to assign group member" });
    }
  });

  // Database connection check endpoint
  app.get("/api/health/db", requireAdmin, async (req, res) => {
    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      const latency = Date.now() - start;

      res.json({
        status: "ok",
        latency,
        pool: getPoolStats()
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        message: "Database connection failed",
        pool: getPoolStats()
      });
    }
  });

  // Debug endpoint to check database table counts
  app.get("/api/debug/db-counts", requireAdmin, async (req, res) => {
    try {
      const bibleCount = await pool.query("SELECT COUNT(*) as count FROM chinese_union_trad");
      const timelineCount = await pool.query("SELECT COUNT(*) as count FROM jesus_4seasons");
      const usersCount = await pool.query("SELECT COUNT(*) as count FROM users");

      res.json({
        status: "ok",
        counts: {
          chinese_union_trad: bibleCount.rows[0]?.count || 0,
          jesus_4seasons: timelineCount.rows[0]?.count || 0,
          users: usersCount.rows[0]?.count || 0,
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to query database counts",
        message: error.message
      });
    }
  });

  // Cache clear endpoint - useful for refreshing stale cached data
  app.post("/api/cache/clear", requireAdmin, async (req, res) => {
    try {
      bibleCache.clear();
      timelineCache.clear();
      apiCache.clear();
      console.log("[Cache] All caches cleared");
      res.json({
        status: "ok",
        message: "All caches cleared successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  app.get("/api/sessions", requireLeader, async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  app.get("/api/sessions/by-code/:shortCode", async (req, res) => {
    try {
      const session = await storage.getSessionByShortCode(req.params.shortCode);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.get("/api/sessions/:id/poll", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const phase = (req.query.phase as string) || 'all';
      const groupNumber = req.query.groupNumber ? parseInt(req.query.groupNumber as string) : undefined;
      const clientVersion = req.query.v as string | undefined;

      const cacheKey = `poll:${sessionId}:${phase}:${groupNumber || 'all'}`;
      const cached = sessionCache.get<any>(cacheKey);

      if (cached) {
        if (clientVersion && clientVersion === cached.version) {
          return res.status(304).end();
        }
        return res.json(cached);
      }

      // Fetch session and submissions in parallel (submissions don't depend on session)
      const fetchSubmissions = (phase === 'studying' || phase === 'all')
        ? storage.getSubmissions(sessionId)
        : Promise.resolve(null);

      const [session, submissions] = await Promise.all([
        storage.getSession(sessionId),
        fetchSubmissions,
      ]);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      let participants: any[] | null = null;

      const effectivePhase = (phase === 'waiting' && session.status !== 'waiting') ? 'grouping' : phase;

      if (effectivePhase !== 'waiting') {
        participants = await storage.getParticipants(sessionId, groupNumber ? { groupNumber } : undefined);
      }

      const participantCount = participants ? participants.length : 0;
      const submissionCount = submissions ? submissions.length : 0;

      let maxParticipantUpdate = '';
      if (participants && participants.length > 0) {
        // Only include fields that affect client rendering (omit updatedAt to keep string compact)
        const fields = participants.map((p: any) => `${p.id}:${p.groupNumber ?? ''}:${p.readyConfirmed ? 1 : 0}`);
        maxParticipantUpdate = fields.join(',');
      }
      let maxSubmissionUpdate = '';
      if (submissions && submissions.length > 0) {
        maxSubmissionUpdate = submissions.map((s: any) => s.id).join(',');
      }

      const versionRaw = `${session.status}:${participantCount}:${submissionCount}:${maxParticipantUpdate}:${maxSubmissionUpdate}`;
      let hash = 0;
      for (let i = 0; i < versionRaw.length; i++) {
        const char = versionRaw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      const version = Math.abs(hash).toString(36);

      if (clientVersion && clientVersion === version) {
        return res.status(304).end();
      }

      const responseData = {
        session,
        participants,
        submissions,
        version,
        participantCount,
      };

      sessionCache.set(cacheKey, responseData, 2000);

      res.json(responseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to poll session data" });
    }
  });

  app.post("/api/sessions", requireSessionManager, async (req, res) => {
    try {
      const parsed = insertSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid session data", details: parsed.error.errors });
      }
      const session = await storage.createSession(parsed.data);
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", requireSessionManager, async (req, res) => {
    try {
      const session = await storage.updateSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      sessionCache.invalidate(`poll:${req.params.id}`);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", requireLeader, async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      await storage.deleteSession(req.params.id);
      sessionCache.invalidate(`poll:${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.get("/api/admin/sessions/:sessionId/participants", requireSessionManager, async (req, res) => {
    try {
      const groupNumber = req.query.groupNumber ? parseInt(req.query.groupNumber as string) : undefined;
      const result = await storage.getParticipants(req.params.sessionId, { groupNumber });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get participants" });
    }
  });

  app.get("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const groupNumber = req.query.groupNumber ? parseInt(req.query.groupNumber as string) : undefined;
      const result = await storage.getParticipants(req.params.sessionId, { groupNumber });
      res.json(result.map(sanitizeParticipant));
    } catch (error) {
      res.status(500).json({ error: "Failed to get participants" });
    }
  });

  // Get participant by email for session restore
  app.get("/api/sessions/:sessionId/participants/by-email/:email", async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email).trim().toLowerCase();
      const participant = await storage.getParticipantBySessionEmail(req.params.sessionId, email);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ error: "Failed to get participant" });
    }
  });

  app.get("/api/sessions/:sessionId/participants/:participantId", async (req, res) => {
    try {
      const participant = await storage.getParticipant(req.params.participantId);
      if (!participant || participant.sessionId !== req.params.sessionId) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.json(sanitizeParticipant(participant));
    } catch (error) {
      res.status(500).json({ error: "Failed to get participant" });
    }
  });

  app.post("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const parsed = insertParticipantSchema.safeParse({ ...req.body, sessionId: req.params.sessionId });
      if (!parsed.success) {
        console.error("[create-participant] Validation error:", (parsed as any).error.errors);
        return res.status(400).json({ error: "Invalid participant data", details: (parsed as any).error.errors });
      }
      const existing = await storage.getParticipantBySessionEmail(req.params.sessionId, parsed.data.email);
      if (existing) {
        return res.status(200).json(existing);
      }
      const participant = await storage.createParticipant(parsed.data);
      sessionCache.invalidate(`poll:${req.params.sessionId}`);
      res.status(201).json(participant);
    } catch (error) {
      console.error("[create-participant] Error:", error);
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  app.patch("/api/participants/:id", async (req, res) => {
    try {
      const existing = await storage.getParticipant(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Participant not found" });
      }

      let updateData = req.body;
      if (!(await canManageSession(req))) {
        const selfUpdateSchema = z.object({
          sessionId: z.string().uuid(),
          email: z.string().email(),
          groupNumber: z.number().int().positive().nullable().optional(),
          readyConfirmed: z.boolean().optional(),
        });

        const parsed = selfUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const emailMatches = existing.email.trim().toLowerCase() === parsed.data.email.trim().toLowerCase();
        if (existing.sessionId !== parsed.data.sessionId || !emailMatches) {
          return res.status(403).json({ error: "Forbidden" });
        }

        updateData = {};
        if (parsed.data.groupNumber !== undefined) updateData.groupNumber = parsed.data.groupNumber;
        if (parsed.data.readyConfirmed !== undefined) updateData.readyConfirmed = parsed.data.readyConfirmed;
      }

      const participant = await storage.updateParticipant(req.params.id, updateData);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      if (participant.sessionId) {
        sessionCache.invalidate(`poll:${participant.sessionId}`);
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ error: "Failed to update participant" });
    }
  });

  app.post("/api/participants/:id/set-ready", async (req, res) => {
    try {
      const setReadySchema = z.object({
        sessionId: z.string().uuid(),
        email: z.string().email(),
        ready: z.boolean(),
      });

      const parsed = setReadySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data", success: false, details: parsed.error.errors });
      }

      const { sessionId, email, ready } = parsed.data;
      const participantId = req.params.id;

      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found", success: false });
      }

      if (participant.sessionId !== sessionId || participant.email !== email) {
        return res.status(403).json({ error: "Verification failed", success: false });
      }

      const session = await storage.getSession(sessionId);
      if (!session || (session.status !== "grouping" && session.status !== "studying")) {
        return res.status(400).json({ error: "Session not in valid state", success: false });
      }

      await storage.updateParticipant(participantId, { readyConfirmed: ready });
      sessionCache.invalidate(`poll:${sessionId}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set participant ready", success: false });
    }
  });

  app.post("/api/participants/batch-assign-groups", requireSessionManager, async (req, res) => {
    try {
      const batchAssignSchema = z.object({
        assignments: z.array(z.object({
          participantIds: z.array(z.string().uuid()),
          groupNumber: z.number().int().positive(),
        })),
      });

      const parsed = batchAssignSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("[batch-assign-groups] Validation error:", parsed.error.errors);
        return res.status(400).json({ error: "Invalid request data", success: false, details: parsed.error.errors });
      }

      const { assignments } = parsed.data;

      const updatePromises: Promise<any>[] = [];
      for (const { participantIds, groupNumber } of assignments) {
        for (const participantId of participantIds) {
          updatePromises.push(storage.updateParticipant(participantId, { groupNumber, readyConfirmed: false }));
        }
      }
      await Promise.all(updatePromises);

      sessionCache.clear();
      res.json({ success: true });
    } catch (error) {
      console.error("[batch-assign-groups] Error:", error);
      res.status(500).json({ error: "Failed to batch assign groups", success: false });
    }
  });

  app.get("/api/sessions/:sessionId/submissions", async (req, res) => {
    try {
      const submissions = await storage.getSubmissions(req.params.sessionId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  app.post("/api/sessions/:sessionId/submissions", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const participantId = typeof body.participantId === "string" ? body.participantId : undefined;
      const legacyParticipantId = typeof body.userId === "string" ? body.userId : undefined;
      const parsed = insertSubmissionSchema.safeParse({
        ...body,
        sessionId: req.params.sessionId,
        participantId: participantId || legacyParticipantId,
      });
      if (!parsed.success) {
        console.error("[create-submission] Validation error:", (parsed as any).error.errors);
        return res.status(400).json({ error: "Invalid submission data", details: (parsed as any).error.errors });
      }
      const submissionInput = parsed.data;
      // Ensure all fields are present or default to empty string to satisfy DB schema
      const submissionData = {
        sessionId: submissionInput.sessionId,
        participantId: submissionInput.participantId,
        groupNumber: submissionInput.groupNumber,
        name: submissionInput.name,
        email: submissionInput.email,
        bibleVerse: submissionInput.bibleVerse,
        theme: submissionInput.theme || "",
        movingVerse: submissionInput.movingVerse || "",
        factsDiscovered: submissionInput.factsDiscovered || "",
        traditionalExegesis: submissionInput.traditionalExegesis || "",
        inspirationFromGod: submissionInput.inspirationFromGod || "",
        applicationInLife: submissionInput.applicationInLife || "",
        others: submissionInput.others || "",
      };
      const submission = await storage.createSubmission(submissionData as any);
      sessionCache.invalidate(`poll:${req.params.sessionId}`);
      res.status(201).json(submission);
    } catch (error) {
      console.error("[create-submission] Error:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  app.delete("/api/sessions/:sessionId/submissions", requireSessionManager, async (req, res) => {
    try {
      await storage.deleteSubmissionsBySession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete submissions" });
    }
  });

  app.delete("/api/sessions/:sessionId/participants", requireSessionManager, async (req, res) => {
    try {
      await storage.deleteParticipantsBySession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete participants" });
    }
  });

  // Force verify all participants (set ready_confirmed = true)
  app.post("/api/sessions/:sessionId/force-verify-all", requireSessionManager, async (req, res) => {
    try {
      const count = await storage.forceVerifyAllParticipants(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[force-verify-all] Error:", error);
      res.status(500).json({ error: "Failed to force verify participants", success: false });
    }
  });

  // Reset all participants' ready_confirmed status to false
  app.post("/api/sessions/:sessionId/reset-ready-status", requireSessionManager, async (req, res) => {
    try {
      const count = await storage.resetAllReadyStatus(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[reset-ready-status] Error:", error);
      res.status(500).json({ error: "Failed to reset ready status", success: false });
    }
  });

  // Clear all group assignments (set group_number to null)
  app.post("/api/sessions/:sessionId/clear-groups", requireSessionManager, async (req, res) => {
    try {
      const count = await storage.clearAllGroupAssignments(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[clear-groups] Error:", error);
      res.status(500).json({ error: "Failed to clear group assignments", success: false });
    }
  });

  app.get("/api/admin/sessions/:sessionId/reports", requireSessionManager, async (req, res) => {
    try {
      const reports = await storage.getAiReports(req.params.sessionId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reports" });
    }
  });

  app.get("/api/sessions/:sessionId/reports", async (req, res) => {
    try {
      const reports = await storage.getAiReports(req.params.sessionId);

      if (await canManageSession(req)) {
        return res.json(reports);
      }

      const participantId = typeof req.query.participantId === "string" ? req.query.participantId : undefined;
      if (participantId) {
        const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
        if (!email) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const participant = await storage.getParticipant(participantId);
        if (!participant || participant.sessionId !== req.params.sessionId || participant.email.trim().toLowerCase() !== email) {
          return res.status(403).json({ error: "Forbidden" });
        }
        return res.json(filterReportsForParticipant(reports, participant));
      }

      const user = (req as any).user;
      const email = (user?.email || user?.claims?.email || "").trim().toLowerCase();
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const participants = await storage.getParticipants(req.params.sessionId);
      const participant = participants.find(p => p.email.trim().toLowerCase() === email);
      if (!participant) {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.json(filterReportsForParticipant(reports, participant));
    } catch (error) {
      res.status(500).json({ error: "Failed to get reports" });
    }
  });

  app.delete("/api/reports/:id", requireSessionManager, async (req, res) => {
    try {
      await storage.deleteAiReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.post("/api/sessions/:sessionId/reports", requireSessionManager, async (req, res) => {
    try {
      const { reportType, groupNumber, filledOnly, fastMode } = req.body;
      console.log(`[report-gen] START type=${reportType} group=${groupNumber} fast=${fastMode} filled=${filledOnly} session=${req.params.sessionId}`);

      const INSIGHT_LABELS: Record<string, string> = {
        'PROMISE': '應許', 'COMMAND': '命令', 'WARNING': '警戒', 'GOD_ATTRIBUTE': '對神的認識'
      };
      const buildContent = (fields: {
        titlePhrase?: string | null; heartbeatVerse?: string | null;
        observation?: string | null; coreInsightNote?: string | null;
        scholarsNote?: string | null; actionPlan?: string | null; coolDownNote?: string | null;
      }): string => {
        const parts: string[] = [];
        if (fields.titlePhrase) parts.push(`標題：${fields.titlePhrase}`);
        if (fields.heartbeatVerse) parts.push(`最感動的經文：${fields.heartbeatVerse}`);
        if (fields.observation) parts.push(`經文觀察：${fields.observation}`);
        if (fields.coreInsightNote) {
          try {
            const obj = JSON.parse(fields.coreInsightNote);
            if (typeof obj === 'object' && !Array.isArray(obj)) {
              Object.entries(obj).forEach(([cat, text]) => {
                if (text && String(text).trim()) parts.push(`神學亮光【${INSIGHT_LABELS[cat] || cat}】：${text}`);
              });
            } else { parts.push(`神學亮光：${fields.coreInsightNote}`); }
          } catch { parts.push(`神學亮光：${fields.coreInsightNote}`); }
        }
        if (fields.scholarsNote) parts.push(`學者筆記：${fields.scholarsNote}`);
        if (fields.actionPlan) parts.push(`行動計畫：${fields.actionPlan}`);
        if (fields.coolDownNote) parts.push(`冷靜筆記：${fields.coolDownNote}`);
        return parts.join('\n');
      };

      if (!process.env.GEMINI_API_KEY) {
        console.error('[report-gen] MISSING GEMINI_API_KEY');
        return res.status(503).json({ error: "AI 功能尚未設定：請聯絡管理員設定 GEMINI_API_KEY" });
      }

      // Fetch session to get verseReference
      const session = await storage.getSession(req.params.sessionId);
      const verseRange = session?.verseReference || undefined;

      const genAI = getGeminiClient();
      const aiModel = getSoulGymAiModel(fastMode);
      // Gemini 2.5 Flash uses thinking tokens that count toward maxOutputTokens.
      // Must set generous limits so thinking + actual output both fit.
      const groupMaxTokens = fastMode ? 10000 : 16000;
      const overallMaxTokens = fastMode ? 12000 : 20000;
      // In fast mode, truncate each member's notes to 400 chars to reduce input tokens
      const inputTruncate = fastMode ? 400 : undefined;
      let aiInputChars = 0;
      let aiOutputChars = 0;
      let aiLatencyMs = 0;
      let aiFinishReason: string | null = null;
      let aiRetryCount = 0;

      let content: string;
      if (reportType === 'group' && groupNumber) {
        // Single group: use getGroupStudyResponses (INNER JOIN + DB-level filter by groupNumber)
        const groupRows = await storage.getGroupStudyResponses(req.params.sessionId, groupNumber);
        console.log(`[report-gen] group ${groupNumber}: ${groupRows.length} DB rows`);
        const filtered = filledOnly
          ? groupRows.filter((r: any) => r.observation || r.core_insight_note || r.action_plan)
          : groupRows;
        if (filtered.length === 0) {
          console.warn(`[report-gen] group ${groupNumber}: 0 rows after filter`);
          return res.status(400).json({ error: `第 ${groupNumber} 組尚無查經筆記資料` });
        }
        const members = filtered.map((r: any) => ({
          name: r.participant_name || '匿名',
          content: buildContent({
            titlePhrase: r.title_phrase, heartbeatVerse: r.heartbeat_verse,
            observation: r.observation, coreInsightNote: r.core_insight_note,
            scholarsNote: r.scholars_note, actionPlan: r.action_plan, coolDownNote: r.cool_down_note,
          }),
        }));
        const groupSystemPrompt = GROUP_SMALL_SYSTEM_PROMPT;
        const dashboardNotes: ReportDashboardNote[] = filtered.map((r: any) => ({
          name: r.participant_name || '匿名',
          groupNumber,
          titlePhrase: r.title_phrase,
          heartbeatVerse: r.heartbeat_verse,
          observation: r.observation,
          coreInsightCategory: r.core_insight_category,
          coreInsightNote: r.core_insight_note,
          scholarsNote: r.scholars_note,
          actionPlan: r.action_plan,
          coolDownNote: r.cool_down_note,
        }));
        const userContent = prependReportDashboard(
          formatGroupNotesInput(members, verseRange, inputTruncate),
          dashboardNotes,
          { reportType: 'group', groupNumber, model: aiModel, fastMode }
        );
        console.log(`[report-gen] group ${groupNumber}: ${members.length} members, inputLen=${userContent.length}, model=${aiModel}`);
        aiInputChars = userContent.length;
        const aiStartedAt = Date.now();
        try {
          // Use systemInstruction instead of stuffing prompt into user message
          const model = genAI.getGenerativeModel({
            model: aiModel,
            systemInstruction: groupSystemPrompt,
          });
          const { result: resultObj, retryCount } = await runWithAiRetry(() => model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            generationConfig: { maxOutputTokens: groupMaxTokens }
          }));
          aiRetryCount = retryCount;
          aiLatencyMs = Date.now() - aiStartedAt;
          const finishReason = resultObj.response.candidates?.[0]?.finishReason;
          aiFinishReason = finishReason || null;
          content = resultObj.response.text() || '（AI 未回應）';
          aiOutputChars = content.length;
          console.log(`[report-gen] group ${groupNumber}: AI OK, contentLen=${content.length}, finishReason=${finishReason}`);
          if (finishReason === 'MAX_TOKENS') {
            console.warn(`[report-gen] group ${groupNumber}: ⚠️ TRUNCATED by MAX_TOKENS (limit=${groupMaxTokens})`);
          }
        } catch (err: any) {
          aiLatencyMs = Date.now() - aiStartedAt;
          aiRetryCount = err?.retryCount || aiRetryCount;
          await recordAiUsage({
            provider: 'google',
            model: aiModel,
            feature: 'soulgym-report',
            reportType,
            sessionId: req.params.sessionId,
            groupNumber,
            inputChars: aiInputChars,
            outputChars: 0,
            latencyMs: aiLatencyMs,
            status: 'FAILED',
            retryCount: aiRetryCount,
            errorMessage: err?.message || String(err),
          });
          console.error(`[report-gen] group ${groupNumber}: AI ERROR`, err?.status, err?.message?.slice(0, 200));
          const is429 = err?.status === 429 || err?.message?.includes('429') || String(err).includes('429');
          if (is429) {
            return res.status(429).json({ error: '請求過多，請稍後再試（Gemini rate limit）' });
          }
          throw err;
        }
      } else {
        // Overall: use getStudyResponses (all participants, camelCase fields)
        const allRows = await storage.getStudyResponses(req.params.sessionId);
        console.log(`[report-gen] overall: ${allRows.length} DB rows`);
        const filtered = filledOnly
          ? allRows.filter(r => r.observation || r.coreInsightNote || r.actionPlan)
          : allRows;
        if (filtered.length === 0) {
          console.warn(`[report-gen] overall: 0 rows after filter`);
          return res.status(400).json({ error: "尚無查經筆記資料" });
        }
        const members = filtered.map(r => ({
          name: (r as any).participantName || '匿名',
          content: buildContent({
            titlePhrase: r.titlePhrase, heartbeatVerse: r.heartbeatVerse,
            observation: r.observation, coreInsightNote: r.coreInsightNote,
            scholarsNote: r.scholarsNote, actionPlan: r.actionPlan, coolDownNote: r.coolDownNote,
          }),
        }));
        const dashboardNotes: ReportDashboardNote[] = filtered.map((r: any) => ({
          name: r.participantName || '匿名',
          groupNumber: r.groupNumber,
          titlePhrase: r.titlePhrase,
          heartbeatVerse: r.heartbeatVerse,
          observation: r.observation,
          coreInsightCategory: r.coreInsightCategory,
          coreInsightNote: r.coreInsightNote,
          scholarsNote: r.scholarsNote,
          actionPlan: r.actionPlan,
          coolDownNote: r.coolDownNote,
        }));
        const userContent = prependReportDashboard(
          formatGroupNotesInput(members, verseRange, inputTruncate),
          dashboardNotes,
          { reportType: 'overall', model: aiModel, fastMode }
        );
        const overallSystemPrompt = GROUP_OVERALL_SYSTEM_PROMPT;
        console.log(`[report-gen] overall: ${members.length} members, inputLen=${userContent.length}, model=${aiModel}`);
        aiInputChars = userContent.length;
        const aiStartedAt = Date.now();
        try {
          // Use systemInstruction instead of stuffing prompt into user message
          const model = genAI.getGenerativeModel({
            model: aiModel,
            systemInstruction: overallSystemPrompt,
          });
          const { result: resultObj, retryCount } = await runWithAiRetry(() => model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            generationConfig: { maxOutputTokens: overallMaxTokens }
          }));
          aiRetryCount = retryCount;
          aiLatencyMs = Date.now() - aiStartedAt;
          const finishReason = resultObj.response.candidates?.[0]?.finishReason;
          aiFinishReason = finishReason || null;
          content = resultObj.response.text() || '（AI 未回應）';
          aiOutputChars = content.length;
          console.log(`[report-gen] overall: AI OK, contentLen=${content.length}, finishReason=${finishReason}`);
          if (finishReason === 'MAX_TOKENS') {
            console.warn(`[report-gen] overall: ⚠️ TRUNCATED by MAX_TOKENS (limit=${overallMaxTokens})`);
          }
        } catch (err: any) {
          aiLatencyMs = Date.now() - aiStartedAt;
          aiRetryCount = err?.retryCount || aiRetryCount;
          await recordAiUsage({
            provider: 'google',
            model: aiModel,
            feature: 'soulgym-report',
            reportType,
            sessionId: req.params.sessionId,
            groupNumber,
            inputChars: aiInputChars,
            outputChars: 0,
            latencyMs: aiLatencyMs,
            status: 'FAILED',
            retryCount: aiRetryCount,
            errorMessage: err?.message || String(err),
          });
          console.error(`[report-gen] overall: AI ERROR`, err?.status, err?.message?.slice(0, 200));
          const is429 = err?.status === 429 || err?.message?.includes('429') || String(err).includes('429');
          if (is429) {
            return res.status(429).json({ error: '請求過多，請稍後再試（Gemini rate limit）' });
          }
          throw err;
        }
      }

      console.log(`[report-gen] Saving report contentLen=${content.length}`);
      const report = await storage.createAiReport({
        sessionId: req.params.sessionId,
        reportType,
        groupNumber,
        content,
        status: "COMPLETED"
      });
      console.log(`[report-gen] DONE id=${report.id}`);
      await recordAiUsage({
        provider: 'google',
        model: aiModel,
        feature: 'soulgym-report',
        reportType,
        sessionId: req.params.sessionId,
        reportId: report.id,
        groupNumber,
        inputChars: aiInputChars,
        outputChars: aiOutputChars,
        latencyMs: aiLatencyMs,
        status: 'COMPLETED',
        finishReason: aiFinishReason,
        qualityScore: scoreAiReportQuality(content),
        retryCount: aiRetryCount,
      });

      res.status(201).json(report);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[report-gen] FATAL:", errMsg);
      res.status(500).json({ error: `AI 報告生成失敗：${errMsg}` });
    }
  });

  // Streaming version — sends SSE chunks as AI generates, much faster perceived latency
  app.post("/api/sessions/:sessionId/reports/stream", requireSessionManager, async (req, res) => {
    try {
      const { reportType, groupNumber, filledOnly, fastMode } = req.body;
      console.log(`[report-stream] START type=${reportType} group=${groupNumber} fast=${fastMode}`);

      const INSIGHT_LABELS: Record<string, string> = {
        'PROMISE': '應許', 'COMMAND': '命令', 'WARNING': '警戒', 'GOD_ATTRIBUTE': '對神的認識'
      };
      const buildContent = (fields: {
        titlePhrase?: string | null; heartbeatVerse?: string | null;
        observation?: string | null; coreInsightNote?: string | null;
        scholarsNote?: string | null; actionPlan?: string | null; coolDownNote?: string | null;
      }): string => {
        const parts: string[] = [];
        if (fields.titlePhrase) parts.push(`標題：${fields.titlePhrase}`);
        if (fields.heartbeatVerse) parts.push(`最感動的經文：${fields.heartbeatVerse}`);
        if (fields.observation) parts.push(`經文觀察：${fields.observation}`);
        if (fields.coreInsightNote) {
          try {
            const obj = JSON.parse(fields.coreInsightNote);
            if (typeof obj === 'object' && !Array.isArray(obj)) {
              Object.entries(obj).forEach(([cat, text]) => {
                if (text && String(text).trim()) parts.push(`神學亮光【${INSIGHT_LABELS[cat] || cat}】：${text}`);
              });
            } else { parts.push(`神學亮光：${fields.coreInsightNote}`); }
          } catch { parts.push(`神學亮光：${fields.coreInsightNote}`); }
        }
        if (fields.scholarsNote) parts.push(`學者筆記：${fields.scholarsNote}`);
        if (fields.actionPlan) parts.push(`行動計畫：${fields.actionPlan}`);
        if (fields.coolDownNote) parts.push(`冷靜筆記：${fields.coolDownNote}`);
        return parts.join('\n');
      };

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "AI 功能尚未設定：請聯絡管理員設定 GEMINI_API_KEY" });
      }

      // Fetch session to get verseReference
      const session = await storage.getSession(req.params.sessionId);
      const verseRange = session?.verseReference || undefined;

      const genAI = getGeminiClient();
      const aiModel = getSoulGymAiModel(fastMode);
      // Gemini 2.5 Flash thinking tokens count toward maxOutputTokens
      const groupMaxTokens = fastMode ? 10000 : 16000;
      const overallMaxTokens = fastMode ? 12000 : 20000;
      const inputTruncate = fastMode ? 400 : undefined;

      let systemPrompt: string;
      let userContent: string;
      let maxTokens: number;

      if (reportType === 'group' && groupNumber) {
        const groupRows = await storage.getGroupStudyResponses(req.params.sessionId, groupNumber);
        const filtered = filledOnly
          ? groupRows.filter((r: any) => r.observation || r.core_insight_note || r.action_plan)
          : groupRows;
        if (filtered.length === 0) {
          return res.status(400).json({ error: `第 ${groupNumber} 組尚無查經筆記資料` });
        }
        const members = filtered.map((r: any) => ({
          name: r.participant_name || '匿名',
          content: buildContent({
            titlePhrase: r.title_phrase, heartbeatVerse: r.heartbeat_verse,
            observation: r.observation, coreInsightNote: r.core_insight_note,
            scholarsNote: r.scholars_note, actionPlan: r.action_plan, coolDownNote: r.cool_down_note,
          }),
        }));
        const dashboardNotes: ReportDashboardNote[] = filtered.map((r: any) => ({
          name: r.participant_name || '匿名',
          groupNumber,
          titlePhrase: r.title_phrase,
          heartbeatVerse: r.heartbeat_verse,
          observation: r.observation,
          coreInsightCategory: r.core_insight_category,
          coreInsightNote: r.core_insight_note,
          scholarsNote: r.scholars_note,
          actionPlan: r.action_plan,
          coolDownNote: r.cool_down_note,
        }));
        systemPrompt = GROUP_SMALL_SYSTEM_PROMPT;
        userContent = prependReportDashboard(
          formatGroupNotesInput(members, verseRange, inputTruncate),
          dashboardNotes,
          { reportType: 'group', groupNumber, model: aiModel, fastMode }
        );
        maxTokens = groupMaxTokens;
      } else {
        const allRows = await storage.getStudyResponses(req.params.sessionId);
        const filtered = filledOnly
          ? allRows.filter(r => r.observation || r.coreInsightNote || r.actionPlan)
          : allRows;
        if (filtered.length === 0) {
          return res.status(400).json({ error: "尚無查經筆記資料" });
        }
        const members = filtered.map(r => ({
          name: (r as any).participantName || '匿名',
          content: buildContent({
            titlePhrase: r.titlePhrase, heartbeatVerse: r.heartbeatVerse,
            observation: r.observation, coreInsightNote: r.coreInsightNote,
            scholarsNote: r.scholarsNote, actionPlan: r.actionPlan, coolDownNote: r.coolDownNote,
          }),
        }));
        const dashboardNotes: ReportDashboardNote[] = filtered.map((r: any) => ({
          name: r.participantName || '匿名',
          groupNumber: r.groupNumber,
          titlePhrase: r.titlePhrase,
          heartbeatVerse: r.heartbeatVerse,
          observation: r.observation,
          coreInsightCategory: r.coreInsightCategory,
          coreInsightNote: r.coreInsightNote,
          scholarsNote: r.scholarsNote,
          actionPlan: r.actionPlan,
          coolDownNote: r.coolDownNote,
        }));
        systemPrompt = GROUP_OVERALL_SYSTEM_PROMPT;
        userContent = prependReportDashboard(
          formatGroupNotesInput(members, verseRange, inputTruncate),
          dashboardNotes,
          { reportType: 'overall', model: aiModel, fastMode }
        );
        maxTokens = overallMaxTokens;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let fullContent = '';
      let streamRetryCount = 0;
      let streamFinishReason: string | null = null;
      const streamStartedAt = Date.now();
      try {
        // Use systemInstruction instead of stuffing prompt into user message
        const model = genAI.getGenerativeModel({
          model: aiModel,
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: maxTokens }
        });

        for await (const chunk of result.stream) {
          const finishReason = (chunk as any).response?.candidates?.[0]?.finishReason;
          if (finishReason) streamFinishReason = finishReason;
          const delta = chunk.text();
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
          }
        }
      } catch (err: any) {
        streamRetryCount = err?.retryCount || 0;
        await recordAiUsage({
          provider: 'google',
          model: aiModel,
          feature: 'soulgym-report-stream',
          reportType,
          sessionId: req.params.sessionId,
          groupNumber,
          inputChars: userContent?.length || 0,
          outputChars: fullContent.length,
          latencyMs: Date.now() - streamStartedAt,
          status: 'FAILED',
          retryCount: streamRetryCount,
          errorMessage: err?.message || String(err),
        });
        const is429 = err?.status === 429 || err?.message?.includes('429') || String(err).includes('429');
        if (is429) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: '請求過多，請稍後再試（Gemini rate limit）' })}\n\n`);
          res.end();
          return;
        }
        throw err;
      }

      if (!fullContent) fullContent = '（AI 未回應）';

      // Save completed report to DB
      const report = await storage.createAiReport({
        sessionId: req.params.sessionId,
        reportType,
        groupNumber,
        content: fullContent,
        status: "COMPLETED"
      });
      await recordAiUsage({
        provider: 'google',
        model: aiModel,
        feature: 'soulgym-report-stream',
        reportType,
        sessionId: req.params.sessionId,
        reportId: report.id,
        groupNumber,
        inputChars: userContent.length,
        outputChars: fullContent.length,
        latencyMs: Date.now() - streamStartedAt,
        status: 'COMPLETED',
        finishReason: streamFinishReason,
        qualityScore: scoreAiReportQuality(fullContent),
        retryCount: streamRetryCount,
      });

      res.write(`data: ${JSON.stringify({ type: 'done', reportId: report.id })}\n\n`);
      res.end();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[report-stream] Failed for session", req.params.sessionId, ":", error);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', error: `AI 報告生成失敗：${errMsg}` })}\n\n`);
        res.end();
      } catch {
        // Headers may have already been sent as JSON error
        if (!res.headersSent) {
          res.status(500).json({ error: `AI 報告生成失敗：${errMsg}` });
        }
      }
    }
  });

  app.post("/api/sessions/:sessionId/reports/generate", requireSessionManager, async (req, res) => {
    try {
      const { reportType, groupNumber } = req.body;
      const submissions = await storage.getSubmissions(req.params.sessionId);

      const groupSubmissions = groupNumber
        ? submissions.filter(s => s.groupNumber === groupNumber)
        : submissions;

      const content = JSON.stringify({
        summary: `Generated ${reportType} report for ${groupSubmissions.length} submissions`,
        submissions: groupSubmissions.map(s => ({ name: s.name, theme: s.theme }))
      });

      const report = await storage.createAiReport({
        sessionId: req.params.sessionId,
        reportType,
        groupNumber,
        content,
        status: "COMPLETED"
      });

      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/notebook", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const email = user.email || user.claims?.email;
      if (!email) return res.status(401).json({ error: "User email not found" });
      const entries = await storage.getNotebookEntries(email);
      res.json({ entries });
    } catch (error) {
      console.error("[notebook] Error:", error);
      res.status(500).json({ error: "Failed to get notebook entries" });
    }
  });

  app.get("/api/notebook/sessions", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const email = user.email || req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const notebookSessions = await storage.getNotebookSessions(email);
      res.json({ sessions: notebookSessions });
    } catch (error) {
      console.error("[notebook-sessions] Error:", error);
      res.status(500).json({ error: "Failed to get notebook sessions" });
    }
  });

  app.get("/api/notebook/sessions-with-data", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const email = user.email || user.claims?.email;
      if (!email) return res.status(401).json({ error: "User email not found" });
      const sessions = await storage.getNotebookSessionsWithData(email);
      res.json({ sessions });
    } catch (error) {
      console.error("[notebook-sessions-with-data] Error:", error);
      res.status(500).json({ error: "Failed to get notebook sessions" });
    }
  });

  app.get("/api/notebook/group-responses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const sessionId = req.query.sessionId as string;
      const groupNumber = parseInt(req.query.groupNumber as string);
      if (!sessionId || isNaN(groupNumber)) {
        return res.status(400).json({ error: "sessionId and groupNumber are required" });
      }
      const responses = await storage.getGroupStudyResponses(sessionId, groupNumber);
      res.json({ responses });
    } catch (error) {
      console.error("[group-responses] Error:", error);
      res.status(500).json({ error: "Failed to get group responses" });
    }
  });

  app.get("/api/study-responses/:sessionId/:participantId", async (req, res) => {
    try {
      const response = await storage.getStudyResponse(req.params.sessionId, req.params.participantId);
      res.json(response || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study response" });
    }
  });

  const studyResponseBodySchema = z.object({
    sessionId: z.string().uuid(),
    participantId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    participantEmail: z.string().optional(),
    titlePhrase: z.string().max(500).nullable().optional(),
    title_phrase: z.string().max(500).nullable().optional(),
    heartbeatVerse: z.string().max(500).nullable().optional(),
    heartbeat_verse: z.string().max(500).nullable().optional(),
    observation: z.string().max(5000).nullable().optional(),
    coreInsightCategory: z.string().max(100).nullable().optional(),
    core_insight_category: z.string().max(100).nullable().optional(),
    coreInsightNote: z.string().max(5000).nullable().optional(),
    core_insight_note: z.string().max(5000).nullable().optional(),
    scholarsNote: z.string().max(5000).nullable().optional(),
    scholars_note: z.string().max(5000).nullable().optional(),
    actionPlan: z.string().max(5000).nullable().optional(),
    action_plan: z.string().max(5000).nullable().optional(),
    coolDownNote: z.string().max(5000).nullable().optional(),
    cool_down_note: z.string().max(5000).nullable().optional(),
  });

  app.post("/api/study-responses", async (req, res) => {
    try {
      const parsed = studyResponseBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }

      const {
        participantId,
        title_phrase, heartbeat_verse, observation,
        core_insight_category, core_insight_note,
        scholars_note, action_plan, cool_down_note,
        sessionId, userId: bodyUserId,
        titlePhrase, heartbeatVerse, coreInsightCategory,
        coreInsightNote, scholarsNote, actionPlan, coolDownNote,
      } = parsed.data;

      const resolvedUserId = bodyUserId || participantId;
      if (!sessionId || !resolvedUserId) {
        return res.status(400).json({ error: "sessionId and userId/participantId are required" });
      }

      // Verify the participant belongs to this session (cached to reduce DB load during study phase)
      const participantCacheKey = `participant-session:${resolvedUserId}`;
      let participantSessionId = apiCache.get<string>(participantCacheKey);
      if (!participantSessionId) {
        const participant = await storage.getParticipant(resolvedUserId);
        if (!participant) {
          return res.status(403).json({ error: "Participant not found in this session" });
        }
        apiCache.set(participantCacheKey, participant.sessionId); // 5-min cache
        participantSessionId = participant.sessionId;
      }
      if (participantSessionId !== sessionId) {
        return res.status(403).json({ error: "Participant not found in this session" });
      }

      const cleanData = {
        sessionId,
        userId: resolvedUserId,
        titlePhrase: titlePhrase || title_phrase || null,
        heartbeatVerse: heartbeatVerse || heartbeat_verse || null,
        observation: observation || null,
        coreInsightCategory: coreInsightCategory || core_insight_category || null,
        coreInsightNote: coreInsightNote || core_insight_note || null,
        scholarsNote: scholarsNote || scholars_note || null,
        actionPlan: actionPlan || action_plan || null,
        coolDownNote: coolDownNote || cool_down_note || null,
      };

      const response = await storage.upsertStudyResponse(cleanData);
      res.json(response);
    } catch (error) {
      console.error("Error saving study response:", error);
      res.status(500).json({ error: "Failed to save study response" });
    }
  });

  app.patch("/api/study-responses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userEmail = user.claims?.email || user.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = await resolveUserId(req);
      const existing = await storage.getStudyResponseWithOwner(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Study response not found" });
      }

      const ownerMatch = (userId && existing.userId === userId) ||
        (existing.ownerEmail && existing.ownerEmail.toLowerCase() === userEmail.toLowerCase());
      if (!ownerMatch) {
        return res.status(403).json({ error: "Not authorized to edit this note" });
      }

      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: "Invalid request body" });
      }

      const cleanData: any = {};
      const tp = body.titlePhrase ?? body.title_phrase;
      if (tp !== undefined) cleanData.titlePhrase = tp || null;
      const hv = body.heartbeatVerse ?? body.heartbeat_verse;
      if (hv !== undefined) cleanData.heartbeatVerse = hv || null;
      if (body.observation !== undefined) cleanData.observation = body.observation || null;
      const cic = body.coreInsightCategory ?? body.core_insight_category;
      if (cic !== undefined) cleanData.coreInsightCategory = cic || null;
      const cin = body.coreInsightNote ?? body.core_insight_note;
      if (cin !== undefined) cleanData.coreInsightNote = cin || null;
      const sn = body.scholarsNote ?? body.scholars_note;
      if (sn !== undefined) cleanData.scholarsNote = sn || null;
      const ap = body.actionPlan ?? body.action_plan;
      if (ap !== undefined) cleanData.actionPlan = ap || null;
      const cdn = body.coolDownNote ?? body.cool_down_note;
      if (cdn !== undefined) cleanData.coolDownNote = cdn || null;

      const updated = await storage.updateStudyResponseById(req.params.id, cleanData);
      if (!updated) {
        return res.status(404).json({ error: "Study response not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating study response:", error);
      res.status(500).json({ error: "Failed to update study response" });
    }
  });

  app.delete("/api/study-responses/:id", requireLeader, async (req, res) => {
    try {
      await storage.deleteStudyResponse(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting study response:", error);
      res.status(500).json({ error: "Failed to delete study response" });
    }
  });

  app.get("/api/prayers", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const cached = prayerCache.get<any[]>(cacheKeys.prayers());
      if (cached) {
        return res.json(cached);
      }
      const prayers = await storage.getPrayers();
      prayerCache.set(cacheKeys.prayers(), prayers, 3);
      res.json(prayers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prayers" });
    }
  });

  app.post("/api/prayers", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const parsed = parseAuthenticatedPrayerBody(req.body, userId);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prayer data", details: parsed.error.flatten() });
      }
      const prayer = await storage.createPrayer(parsed.data);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(prayer);
    } catch (error) {
      console.error("[create-prayer] Error:", error);
      res.status(500).json({ error: "Failed to create prayer" });
    }
  });

  app.patch("/api/prayers/:id", async (req, res) => {
    try {
      const existingPrayer = (await storage.getPrayers()).find((prayer) => prayer.id === req.params.id);
      if (!existingPrayer) {
        return res.status(404).json({ error: "Prayer not found" });
      }

      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const role = userId ? await storage.getUserRole(userId) : null;
      const canManage = userId === existingPrayer.userId || !!role && crmLeaderRoles.includes(role as AppRole);
      if (!canManage) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = prayerPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prayer update", details: parsed.error.flatten() });
      }
      const updateData: Record<string, any> = {};
      if (parsed.data.isPinned !== undefined) updateData.isPinned = parsed.data.isPinned;
      if (parsed.data.isAnswered !== undefined) {
        updateData.isAnswered = parsed.data.isAnswered;
        updateData.answeredAt = parsed.data.isAnswered ? new Date() : null;
      }

      const prayer = await storage.updatePrayer(req.params.id, updateData);
      if (!prayer) {
        return res.status(404).json({ error: "Prayer not found" });
      }
      prayerCache.invalidatePattern('prayers:');
      res.json(prayer);
    } catch (error) {
      console.error("[update-prayer] Error:", error);
      res.status(500).json({ error: "Failed to update prayer" });
    }
  });

  app.delete("/api/prayers/:id", async (req, res) => {
    try {
      const existingPrayer = (await storage.getPrayers()).find((prayer) => prayer.id === req.params.id);
      if (!existingPrayer) {
        return res.status(404).json({ error: "Prayer not found" });
      }

      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const role = userId ? await storage.getUserRole(userId) : null;
      const canManage = userId === existingPrayer.userId || !!role && crmLeaderRoles.includes(role as AppRole);
      if (!canManage) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deletePrayer(req.params.id);
      prayerCache.invalidatePattern('prayers:');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete prayer" });
    }
  });

  app.post("/api/prayers/:id/amen", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const amen = await storage.createPrayerAmen(req.params.id, userId);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(amen);
    } catch (error) {
      console.error("[create-prayer-amen] Error:", error);
      res.status(500).json({ error: "Failed to add amen" });
    }
  });

  app.get("/api/prayers/:id/comments", async (req, res) => {
    try {
      const currentUserId = await resolveUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const comments = await storage.getPrayerComments(req.params.id, currentUserId);
      res.json(comments);
    } catch (error) {
      console.error("[get-prayer-comments] Error:", error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  app.post("/api/prayers/:id/comments", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const parsed = prayerCommentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prayer comment", details: parsed.error.flatten() });
      }
      const comment = await storage.createPrayerComment(req.params.id, userId, parsed.data.content);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(comment);
    } catch (error) {
      console.error("[create-prayer-comment] Error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/prayers/:id/comments/:commentId", requireLeader, async (req, res) => {
    try {
      await storage.deletePrayerComment(req.params.commentId);
      prayerCache.invalidatePattern('prayers:');
      res.json({ success: true });
    } catch (error) {
      console.error("[delete-prayer-comment] Error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.get("/api/care/contacts", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const contacts = await db
        .select()
        .from(careContacts)
        .where(and(eq(careContacts.userId, userId), eq(careContacts.isArchived, false)))
        .orderBy(desc(careContacts.createdAt));

      if (contacts.length === 0) {
        return res.json([]);
      }

      const actions = await db
        .select()
        .from(careActions)
        .where(eq(careActions.userId, userId))
        .orderBy(desc(careActions.createdAt));

      const prayerCounts = new Map<string, number>();
      const lastActionAt = new Map<string, Date>();
      for (const action of actions) {
        if (action.actionType === "prayer") {
          prayerCounts.set(action.contactId, (prayerCounts.get(action.contactId) || 0) + 1);
        }
        if (!lastActionAt.has(action.contactId)) {
          lastActionAt.set(action.contactId, action.createdAt);
        }
      }

      res.json(contacts.map((contact) => ({
        ...contact,
        prayerCount: prayerCounts.get(contact.id) || 0,
        lastActionAt: lastActionAt.get(contact.id) || null,
      })));
    } catch (error) {
      console.error("[care-contacts] Error:", error);
      res.status(500).json({ error: "Failed to get care contacts" });
    }
  });

  app.post("/api/care/contacts", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input = careContactBodySchema.parse(req.body);
      const [contact] = await db.insert(careContacts).values({
        userId,
        name: input.name,
        relationship: input.relationship || null,
        need: input.need || "需要更多了解與陪伴。",
        nextAction: input.nextAction || "這週主動問候一次。",
        prayer: input.prayer || "求主讓我用合宜的方式關心他。",
        source: input.source || "personal",
        visibility: input.visibility || "private",
        isArchived: false,
      }).returning();
      res.status(201).json({ ...contact, prayerCount: 0, lastActionAt: null });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid care contact", details: error.flatten() });
      }
      console.error("[create-care-contact] Error:", error);
      res.status(500).json({ error: "Failed to create care contact" });
    }
  });

  app.patch("/api/care/contacts/:id", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const input = careContactPatchSchema.parse(req.body);
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.relationship !== undefined) updateData.relationship = input.relationship || null;
      if (input.need !== undefined) updateData.need = input.need || "";
      if (input.nextAction !== undefined) updateData.nextAction = input.nextAction || "";
      if (input.prayer !== undefined) updateData.prayer = input.prayer || "";
      if (input.source !== undefined) updateData.source = input.source || "personal";
      if (input.visibility !== undefined) updateData.visibility = input.visibility || "private";
      if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

      const [contact] = await db
        .update(careContacts)
        .set(updateData)
        .where(and(eq(careContacts.id, req.params.id), eq(careContacts.userId, userId)))
        .returning();

      if (!contact) {
        return res.status(404).json({ error: "Care contact not found" });
      }

      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid care contact", details: error.flatten() });
      }
      console.error("[update-care-contact] Error:", error);
      res.status(500).json({ error: "Failed to update care contact" });
    }
  });

  app.delete("/api/care/contacts/:id", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [contact] = await db
        .update(careContacts)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(careContacts.id, req.params.id), eq(careContacts.userId, userId)))
        .returning();

      if (!contact) {
        return res.status(404).json({ error: "Care contact not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[archive-care-contact] Error:", error);
      res.status(500).json({ error: "Failed to archive care contact" });
    }
  });

  app.post("/api/care/contacts/:id/actions", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [contact] = await db
        .select()
        .from(careContacts)
        .where(and(eq(careContacts.id, req.params.id), eq(careContacts.userId, userId), eq(careContacts.isArchived, false)))
        .limit(1);

      if (!contact) {
        return res.status(404).json({ error: "Care contact not found" });
      }

      const input = careActionBodySchema.parse(req.body);
      const [action] = await db
        .insert(careActions)
        .values({
          contactId: contact.id,
          userId,
          actionType: input.actionType,
          note: input.note || null,
        })
        .returning();

      if (careActionTypesThatUpdateLastCared.has(input.actionType)) {
        await db
          .update(careContacts)
          .set({ lastCaredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(careContacts.id, contact.id), eq(careContacts.userId, userId)));
      }

      res.status(201).json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid care action", details: error.flatten() });
      }
      console.error("[create-care-action] Error:", error);
      res.status(500).json({ error: "Failed to create care action" });
    }
  });

  app.get("/api/feature-toggles", async (req, res) => {
    try {
      const cached = apiCache.get<any[]>(cacheKeys.featureToggles());
      if (cached) {
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.json(cached);
      }
      const toggles = await storage.getFeatureToggles();
      // Cache for 5 minutes — feature toggles are rarely updated
      apiCache.set(cacheKeys.featureToggles(), toggles, 300);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.json(toggles);
    } catch (error) {
      res.status(500).json({ error: "Failed to get feature toggles" });
    }
  });

  app.get("/api/feature-toggles/:key", async (req, res) => {
    try {
      const toggle = await storage.getFeatureToggle(req.params.key);
      res.json(toggle || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get feature toggle" });
    }
  });

  app.patch("/api/feature-toggles/:id", requireAdmin, async (req, res) => {
    try {
      const toggle = await storage.updateFeatureToggle(req.params.id, req.body);
      if (!toggle) {
        return res.status(404).json({ error: "Feature toggle not found" });
      }
      apiCache.delete(cacheKeys.featureToggles());
      res.json(toggle);
    } catch (error) {
      res.status(500).json({ error: "Failed to update feature toggle" });
    }
  });

  app.get("/api/potential-members", requireLeader, async (req, res) => {
    try {
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const members = await storage.getPotentialMembers(churchScope);
      res.json(filterPotentialMembersForCrmAccess(members, access));
    } catch (error) {
      res.status(500).json({ error: "Failed to get potential members" });
    }
  });

  app.post("/api/potential-members", async (req, res) => {
    try {
      const member = await storage.upsertPotentialMember({
        ...req.body,
        church: normalizeChurch(typeof req.body?.church === "string" ? req.body.church : null),
      });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create potential member" });
    }
  });

  app.get("/api/icebreaker/games/:roomCode", async (req, res) => {
    try {
      const game = await storage.getIcebreakerGameByRoomCode(req.params.roomCode);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get game" });
    }
  });

  app.post("/api/icebreaker/games", async (req, res) => {
    const lockKey = req.body.bibleStudySessionId && req.body.groupNumber
      ? `${req.body.bibleStudySessionId}:${req.body.groupNumber}`
      : null;

    const findOrCreate = async () => {
      if (req.body.bibleStudySessionId && req.body.groupNumber) {
        const existingGame = await storage.getSessionIcebreakerGame(
          req.body.bibleStudySessionId,
          parseInt(req.body.groupNumber)
        );
        if (existingGame) {
          return existingGame;
        }
      }
      const gameData = { ...req.body };
      if (gameData.mode === 'session') {
        gameData.status = 'active';
      }
      try {
        return await storage.createIcebreakerGame(gameData);
      } catch (createError: any) {
        if (req.body.bibleStudySessionId && req.body.groupNumber) {
          const fallback = await storage.getSessionIcebreakerGame(
            req.body.bibleStudySessionId,
            parseInt(req.body.groupNumber)
          );
          if (fallback) return fallback;
        }
        throw createError;
      }
    };

    try {
      let game;
      if (lockKey) {
        const existingLock = gameCreationLocks.get(lockKey);
        if (existingLock) {
          await existingLock;
          game = await storage.getSessionIcebreakerGame(
            req.body.bibleStudySessionId,
            parseInt(req.body.groupNumber)
          );
          if (!game) {
            game = await findOrCreate();
          }
        } else {
          const promise = findOrCreate();
          gameCreationLocks.set(lockKey, promise);
          try {
            game = await promise;
          } finally {
            gameCreationLocks.delete(lockKey);
          }
        }
      } else {
        game = await findOrCreate();
      }
      res.status(200).json(game);
    } catch (error) {
      if (req.body.bibleStudySessionId && req.body.groupNumber) {
        try {
          const existingGame = await storage.getSessionIcebreakerGame(
            req.body.bibleStudySessionId,
            parseInt(req.body.groupNumber)
          );
          if (existingGame) {
            return res.status(200).json(existingGame);
          }
        } catch { }
      }
      res.status(500).json({ error: "Failed to create game" });
    }
  });

  app.patch("/api/icebreaker/games/:id", async (req, res) => {
    try {
      const game = await storage.updateIcebreakerGame(req.params.id, req.body);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to update game" });
    }
  });

  app.get("/api/icebreaker/games/:gameId/players", async (req, res) => {
    try {
      const players = await storage.getIcebreakerPlayers(req.params.gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/players", async (req, res) => {
    try {
      const player = await storage.createIcebreakerPlayer({
        ...req.body,
        gameId: req.params.gameId
      });
      res.status(201).json(player);
    } catch (error) {
      res.status(500).json({ error: "Failed to create player" });
    }
  });

  app.get("/api/icebreaker/cards", async (req, res) => {
    try {
      const level = req.query.level as string | undefined;
      const cards = await storage.getCardQuestions(level);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to get cards" });
    }
  });

  app.get("/api/icebreaker/cards/:id", async (req, res) => {
    try {
      const card = await storage.getCardQuestionById(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to get card" });
    }
  });

  app.get("/api/icebreaker/session-game", async (req, res) => {
    try {
      const { sessionId, groupNumber } = req.query;
      if (!sessionId || !groupNumber) {
        return res.status(400).json({ error: "sessionId and groupNumber required" });
      }
      const game = await storage.getSessionIcebreakerGame(
        sessionId as string,
        parseInt(groupNumber as string)
      );
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get session game" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/draw-card", async (req, res) => {
    try {
      const { level } = req.body;
      const result = await storage.drawIcebreakerCard(req.params.gameId, level || 'L1');
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to draw card" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/reset", async (req, res) => {
    try {
      await storage.resetIcebreakerDeck(req.params.gameId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset deck" });
    }
  });

  // ========== Grouping Activities (神的安排) ==========

  // Get user's own active grouping activities
  app.get("/api/grouping/my-activities", async (req, res) => {
    try {
      if (!req.user) {
        return res.json({ activities: [] });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      if (!userId) {
        return res.json({ activities: [] });
      }

      const activities = await storage.getActiveGroupingActivitiesByOwner(userId);
      const activitiesWithParticipants = await Promise.all(
        activities.map(async (activity) => {
          const participants = await storage.getGroupingParticipants(activity.id);
          return { activity, participants };
        })
      );
      res.json({ activities: activitiesWithParticipants });
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  // Get grouping activity by short code (for joining)
  app.get("/api/grouping/code/:code", async (req, res) => {
    try {
      const activity = await storage.getGroupingActivityByCode(req.params.code);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found or already closed" });
      }
      const participants = await storage.getGroupingParticipants(activity.id);
      res.json({ activity, participants });
    } catch (error) {
      res.status(500).json({ error: "Failed to get activity" });
    }
  });

  // Get grouping activity by ID
  app.get("/api/grouping/:id", async (req, res) => {
    try {
      const activity = await storage.getGroupingActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const participants = await storage.getGroupingParticipants(activity.id);
      res.json({ activity, participants });
    } catch (error) {
      res.status(500).json({ error: "Failed to get activity" });
    }
  });

  // Create grouping activity (requires leader/admin role)
  app.post("/api/grouping", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user info from OIDC claims
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;

      // Look up the full user info from auth storage (which includes legacyUserId)
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      let role: string | undefined;

      if (!userId && fullUser?.email) {
        // Fallback: look up legacy user by email
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) {
          userId = legacyUser.id;
        }
      }

      if (userId) {
        role = await storage.getUserRole(userId);
      }

      if (!role || !['leader', 'future_leader', 'admin'].includes(role)) {
        return res.status(403).json({ error: "Only leaders and admins can create grouping activities" });
      }

      const { title, groupingMode, groupSize, groupCount, genderMode } = req.body;

      // Generate unique short code for this activity
      const shortCode = await storage.generateUniqueShortCode();

      const activity = await storage.createGroupingActivity({
        shortCode,
        title: title || '神的安排',
        groupingMode: groupingMode || 'bySize',
        groupSize: groupSize || 4,
        groupCount: groupCount || 3,
        genderMode: genderMode || 'mixed',
        ownerId: userId,
        status: 'joining',
      });
      res.json(activity);
    } catch (error) {
      console.error("[Grouping] Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  // Join grouping activity (no auth required)
  app.post("/api/grouping/:id/join", async (req, res) => {
    try {
      const activity = await storage.getGroupingActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (activity.status !== 'joining') {
        return res.status(400).json({ error: "Activity is not accepting participants" });
      }

      const { name, gender } = req.body;
      if (!name || !gender) {
        return res.status(400).json({ error: "Name and gender are required" });
      }

      // Return existing record if same name already joined (handles page refresh / rejoin)
      const existingParticipants = await storage.getGroupingParticipants(activity.id);
      const existing = existingParticipants.find(p => p.name === name);
      if (existing) {
        return res.json(existing);
      }

      const participant = await storage.addGroupingParticipant({
        activityId: activity.id,
        name,
        gender,
      });
      res.json(participant);
    } catch (error) {
      res.status(500).json({ error: "Failed to join activity" });
    }
  });

  // Execute grouping (requires owner)
  app.post("/api/grouping/:id/execute", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const activity = await storage.getGroupingActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      // Get user info from OIDC claims
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      if (activity.ownerId !== userId) {
        const role = userId ? await storage.getUserRole(userId) : undefined;
        if (role !== 'admin') {
          return res.status(403).json({ error: "Only the activity owner can execute grouping" });
        }
      }

      const participants = await storage.getGroupingParticipants(activity.id);
      if (participants.length === 0) {
        return res.status(400).json({ error: "No participants to group" });
      }

      // Shuffle participants
      const shuffled = [...participants].sort(() => Math.random() - 0.5);

      let numGroups: number;
      if (activity.groupingMode === 'bySize') {
        numGroups = Math.ceil(shuffled.length / (activity.groupSize || 4));
      } else {
        numGroups = Math.min(activity.groupCount || 3, shuffled.length);
      }

      // Assign groups based on gender mode
      let updates: { id: string; groupNumber: number }[] = [];

      if (activity.genderMode === 'split') {
        // Split by gender
        const males = shuffled.filter(p => p.gender === 'M');
        const females = shuffled.filter(p => p.gender === 'F');

        const assignGroups = (list: typeof participants, startGroup: number) => {
          const groupCount = Math.max(1, Math.ceil(list.length / (activity.groupSize || 4)));
          list.forEach((p, i) => {
            updates.push({ id: p.id, groupNumber: startGroup + (i % groupCount) });
          });
          return groupCount;
        };

        const maleGroups = assignGroups(males, 1);
        assignGroups(females, maleGroups + 1);
      } else {
        // Mixed - interleave genders for balance
        const males = shuffled.filter(p => p.gender === 'M');
        const females = shuffled.filter(p => p.gender === 'F');
        const interleaved: typeof participants = [];

        const maxLen = Math.max(males.length, females.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < males.length) interleaved.push(males[i]);
          if (i < females.length) interleaved.push(females[i]);
        }

        interleaved.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: (i % numGroups) + 1 });
        });
      }

      await storage.updateGroupingParticipants(activity.id, updates);
      await storage.updateGroupingActivity(activity.id, { status: 'finished' });

      const updatedParticipants = await storage.getGroupingParticipants(activity.id);
      res.json({ activity: { ...activity, status: 'finished' }, participants: updatedParticipants });
    } catch (error) {
      console.error("[Grouping] Failed to execute grouping:", error);
      res.status(500).json({ error: "Failed to execute grouping" });
    }
  });

  // Close grouping activity
  app.post("/api/grouping/:id/close", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const activity = await storage.getGroupingActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      // Get user info from OIDC claims
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      if (activity.ownerId !== userId) {
        const role = userId ? await storage.getUserRole(userId) : undefined;
        if (role !== 'admin') {
          return res.status(403).json({ error: "Only the activity owner can close it" });
        }
      }

      await storage.deleteGroupingActivity(activity.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to close activity" });
    }
  });

  // ==================== Prayer Meeting Routes ====================

  // Get all prayer meetings
  app.get("/api/prayer-meetings", async (req, res) => {
    try {
      const meetings = await storage.getPrayerMeetings();
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prayer meetings" });
    }
  });

  app.get("/api/prayer-meetings/active", async (req, res) => {
    try {
      const meetings = await storage.getPrayerMeetings();
      const active = meetings.filter(m => m.status !== 'completed' && m.status !== 'cancelled' && m.status !== 'closed');
      res.json(active);
    } catch (error) {
      res.status(500).json({ error: "Failed to get active prayer meetings" });
    }
  });

  // Get historical (closed/completed) prayer meetings (leader/admin only)
  app.get("/api/prayer-meetings/history", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      const role = userId ? await storage.getUserRole(userId) : undefined;
      if (!role || !['leader', 'future_leader', 'admin'].includes(role)) {
        return res.status(403).json({ error: "Only leaders can view history" });
      }

      const closedMeetings = await storage.getClosedPrayerMeetings();
      res.json(closedMeetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get historical prayer meetings" });
    }
  });

  // Get prayer meeting by ID
  app.get("/api/prayer-meetings/:id", async (req, res) => {
    try {
      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prayer meeting" });
    }
  });

  // Get prayer meeting by short code
  app.get("/api/prayer-meetings/code/:code", async (req, res) => {
    try {
      const meeting = await storage.getPrayerMeetingByCode(req.params.code);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prayer meeting" });
    }
  });

  // Get participants for a prayer meeting
  app.get("/api/prayer-meetings/:id/participants", async (req, res) => {
    try {
      const participants = await storage.getPrayerMeetingParticipants(req.params.id);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get participants" });
    }
  });

  // Create a new prayer meeting (requires leader/admin role)
  app.post("/api/prayer-meetings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      let role: string | undefined;
      if (userId) {
        role = await storage.getUserRole(userId);
      }

      if (!role || !['leader', 'future_leader', 'admin'].includes(role)) {
        return res.status(403).json({ error: "Only leaders and admins can create prayer meetings" });
      }

      const { title, groupingMode, groupSize, groupCount, genderMode } = req.body;
      const shortCode = await storage.generateUniquePrayerMeetingCode();

      const meeting = await storage.createPrayerMeeting({
        shortCode,
        title: title || '禱告會',
        groupingMode: groupingMode || 'bySize',
        groupSize: groupSize || 4,
        groupCount: groupCount || 3,
        genderMode: genderMode || 'mixed',
        ownerId: userId,
        status: 'joining',
      });
      res.json(meeting);
    } catch (error) {
      console.error("[PrayerMeeting] Failed to create:", error);
      res.status(500).json({ error: "Failed to create prayer meeting" });
    }
  });

  // Join a prayer meeting
  app.post("/api/prayer-meetings/:id/join", async (req, res) => {
    try {
      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }
      if (meeting.status === 'completed') {
        return res.status(400).json({ error: "Prayer meeting has ended" });
      }

      const { name, gender, userId } = req.body;
      if (!name || !gender) {
        return res.status(400).json({ error: "Name and gender are required" });
      }

      const participant = await storage.addPrayerMeetingParticipant({
        meetingId: meeting.id,
        userId: userId || null,
        name,
        gender,
      });
      res.json(participant);
    } catch (error) {
      res.status(500).json({ error: "Failed to join prayer meeting" });
    }
  });

  // Update prayer meeting (status, settings)
  app.patch("/api/prayer-meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      if (meeting.ownerId !== userId) {
        const role = userId ? await storage.getUserRole(userId) : undefined;
        if (role !== 'admin') {
          return res.status(403).json({ error: "Only the meeting owner can update it" });
        }
      }

      const updated = await storage.updatePrayerMeeting(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update prayer meeting" });
    }
  });

  // Delete prayer meeting (admin/leader only, for historical records)
  app.delete("/api/prayer-meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check user role
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      const role = userId ? await storage.getUserRole(userId) : undefined;
      if (!role || !['leader', 'future_leader', 'admin'].includes(role)) {
        return res.status(403).json({ error: "Only leaders can delete prayer meetings" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      // Delete participants first
      await db.delete(prayerMeetingParticipants).where(eq(prayerMeetingParticipants.meetingId, req.params.id));

      // Delete the meeting
      await db.delete(prayerMeetings).where(eq(prayerMeetings.id, req.params.id));

      res.json({ success: true });
    } catch (error) {
      console.error("[PrayerMeeting] Failed to delete prayer meeting:", error);
      res.status(500).json({ error: "Failed to delete prayer meeting" });
    }
  });

  // Execute grouping for prayer meeting
  app.post("/api/prayer-meetings/:id/execute-grouping", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      // Allow meeting owner, or any leader/admin to execute grouping
      const role = userId ? await storage.getUserRole(userId) : undefined;
      const isOwner = meeting.ownerId === userId;
      const isLeaderOrAdmin = role && ['leader', 'future_leader', 'admin'].includes(role);

      if (!isOwner && !isLeaderOrAdmin) {
        return res.status(403).json({ error: "Only leaders and admins can execute grouping" });
      }

      const participants = await storage.getPrayerMeetingParticipants(meeting.id);
      if (participants.length === 0) {
        return res.status(400).json({ error: "No participants to group" });
      }

      const shuffled = [...participants].sort(() => Math.random() - 0.5);

      let numGroups: number;
      if (meeting.groupingMode === 'bySize') {
        numGroups = Math.ceil(shuffled.length / (meeting.groupSize || 4));
      } else {
        numGroups = Math.min(meeting.groupCount || 3, shuffled.length);
      }

      let updates: { id: string; groupNumber: number }[] = [];

      if (meeting.genderMode === 'separate') {
        const males = shuffled.filter(p => p.gender === 'M');
        const females = shuffled.filter(p => p.gender === 'F');

        const maleGroups = Math.max(1, Math.ceil(males.length / (meeting.groupSize || 4)));
        const femaleGroups = Math.max(1, Math.ceil(females.length / (meeting.groupSize || 4)));

        males.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: (i % maleGroups) + 1 });
        });
        females.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: maleGroups + (i % femaleGroups) + 1 });
        });
      } else if (meeting.genderMode === 'male_only') {
        const males = shuffled.filter(p => p.gender === 'M');
        males.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: (i % numGroups) + 1 });
        });
        shuffled.filter(p => p.gender === 'F').forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: numGroups + 1 });
        });
      } else if (meeting.genderMode === 'female_only') {
        const females = shuffled.filter(p => p.gender === 'F');
        females.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: (i % numGroups) + 1 });
        });
        shuffled.filter(p => p.gender === 'M').forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: numGroups + 1 });
        });
      } else {
        shuffled.forEach((p, i) => {
          updates.push({ id: p.id, groupNumber: (i % numGroups) + 1 });
        });
      }

      await storage.updatePrayerMeetingParticipants(meeting.id, updates);
      await storage.updatePrayerMeeting(meeting.id, { status: 'grouped' });

      const updatedParticipants = await storage.getPrayerMeetingParticipants(meeting.id);
      res.json({ participants: updatedParticipants });
    } catch (error) {
      console.error("[PrayerMeeting] Failed to execute grouping:", error);
      res.status(500).json({ error: "Failed to execute grouping" });
    }
  });

  app.post("/api/prayer-meetings/:id/start-praying", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      // Verify user is a leader/admin
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      const role = userId ? await storage.getUserRole(userId) : undefined;
      const isOwner = meeting.ownerId === userId;
      const isLeaderOrAdmin = role && ['leader', 'future_leader', 'admin'].includes(role);

      if (!isOwner && !isLeaderOrAdmin) {
        return res.status(403).json({ error: "Only leaders and admins can start praying" });
      }

      await storage.updatePrayerMeeting(meeting.id, { status: 'praying' });
      const updated = await storage.getPrayerMeeting(meeting.id);
      res.json(updated);
    } catch (error) {
      console.error("[PrayerMeeting] Failed to start praying:", error);
      res.status(500).json({ error: "Failed to start praying" });
    }
  });

  // Unified endpoint to update both named and anonymous prayers in a single request
  // Allows both authenticated users and guest participants (who have their participantId)
  app.patch("/api/prayer-meetings/:id/my-prayers/:participantId", async (req, res) => {
    try {
      const prayersSchema = z.object({
        namedPrayer: z.string().max(2000).optional().default(''),
        urgentPrayer: z.string().max(2000).optional().default(''),
        anonymousPrayer: z.string().max(2000).optional().default(''),
        meetingCode: z.string().optional(),
      });

      const validation = prayersSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid prayer content", details: validation.error.errors });
      }

      const { namedPrayer, urgentPrayer, anonymousPrayer, meetingCode } = validation.data;

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const participant = await storage.getPrayerMeetingParticipantById(req.params.participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // Verify participant belongs to this meeting
      if (participant.meetingId !== req.params.id) {
        return res.status(403).json({ error: "Participant does not belong to this meeting" });
      }

      // For authenticated users, verify ownership or leadership
      if (req.user) {
        const claims = (req.user as any).claims || {};
        const authUserId = claims.sub;
        const { authStorage } = await import("./replit_integrations/auth/storage");
        const fullUser = await authStorage.getUser(authUserId);

        let userId = fullUser?.legacyUserId;
        if (!userId && fullUser?.email) {
          const legacyUser = await storage.getUserByEmail(fullUser.email);
          if (legacyUser) userId = legacyUser.id;
        }

        const isOwner = participant.userId === userId;
        const role = userId ? await storage.getUserRole(userId) : undefined;
        const isLeaderOrAdmin = role && ['leader', 'future_leader', 'admin'].includes(role);

        if (!isOwner && !isLeaderOrAdmin) {
          return res.status(403).json({ error: "You can only update your own prayer requests" });
        }
      }
      // For guest users (no req.user), verify meeting code for additional security
      if (!req.user) {
        if (!meetingCode || meetingCode !== meeting.shortCode) {
          return res.status(403).json({ error: "Invalid meeting code" });
        }
      }

      const updated = await storage.updatePrayerMeetingParticipant(req.params.participantId, {
        prayerRequest: namedPrayer || null,
        urgentPrayer: urgentPrayer || null,
        anonymousPrayer: anonymousPrayer || null,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[PrayerMeeting] Failed to update prayers:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to update prayers", details: error?.message });
    }
  });

  // Update participant prayer request (legacy route, requires auth)
  app.patch("/api/prayer-meetings/:meetingId/participants/:participantId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const participant = await storage.getPrayerMeetingParticipantById(req.params.participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // Verify participant belongs to this meeting
      if (participant.meetingId !== req.params.meetingId) {
        return res.status(403).json({ error: "Participant does not belong to this meeting" });
      }

      // Get the current user's ID and verify ownership
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      // Check if user owns this participant or is a leader/admin
      const isOwner = participant.userId === userId;
      const role = userId ? await storage.getUserRole(userId) : undefined;
      const isLeaderOrAdmin = role && ['leader', 'future_leader', 'admin'].includes(role);

      if (!isOwner && !isLeaderOrAdmin) {
        return res.status(403).json({ error: "You can only update your own prayer requests" });
      }

      const { prayerRequest, isAnonymous } = req.body;
      const updateData: { prayerRequest?: string; isAnonymous?: boolean } = {};
      if (prayerRequest !== undefined) updateData.prayerRequest = prayerRequest;
      if (isAnonymous !== undefined) updateData.isAnonymous = isAnonymous;

      const updated = await storage.updatePrayerMeetingParticipant(req.params.participantId, updateData);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update prayer request" });
    }
  });

  // Update anonymous prayer for a participant (stored in separate field)
  app.patch("/api/prayer-meetings/:id/anonymous-prayer/:participantId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate payload with Zod
      const anonymousPrayerSchema = z.object({
        anonymousPrayer: z.string().max(2000).nullable().optional(),
      });

      const validation = anonymousPrayerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid prayer content", details: validation.error.errors });
      }

      const { anonymousPrayer } = validation.data;

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const participant = await storage.getPrayerMeetingParticipantById(req.params.participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // Verify participant belongs to this meeting
      if (participant.meetingId !== req.params.id) {
        return res.status(403).json({ error: "Participant does not belong to this meeting" });
      }

      // Get the current user's ID and verify ownership or leadership
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      // Check if user owns this participant or is a leader/admin
      const isOwner = participant.userId === userId;
      const role = userId ? await storage.getUserRole(userId) : undefined;
      const isLeaderOrAdmin = role && ['leader', 'future_leader', 'admin'].includes(role);

      if (!isOwner && !isLeaderOrAdmin) {
        return res.status(403).json({ error: "You can only update your own prayer requests" });
      }

      // Update the participant's anonymous prayer field
      const updated = await storage.updatePrayerMeetingParticipant(req.params.participantId, {
        anonymousPrayer: anonymousPrayer || null,
      });

      res.json(updated);
    } catch (error) {
      console.error("[PrayerMeeting] Failed to update anonymous prayer:", error);
      res.status(500).json({ error: "Failed to update anonymous prayer" });
    }
  });

  // AI-classify prayers for a meeting
  app.post("/api/prayer-meetings/:id/classify-prayers", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      const role = userId ? await storage.getUserRole(userId) : undefined;
      if (!role || !['leader', 'future_leader', 'admin'].includes(role)) {
        return res.status(403).json({ error: "Only leaders and admins can classify prayers" });
      }

      const participants = await storage.getPrayerMeetingParticipants(meeting.id);

      // Collect both named prayers and anonymous prayers for classification
      const namedPrayers = participants.filter(p => p.prayerRequest && p.prayerRequest.trim());
      const anonymousPrayers = participants.filter(p => p.anonymousPrayer && p.anonymousPrayer.trim());

      if (namedPrayers.length === 0 && anonymousPrayers.length === 0) {
        return res.json({ message: "No prayers to classify", classified: 0 });
      }

      console.log("[PrayerMeeting] Starting AI classification for", namedPrayers.length, "named prayers and", anonymousPrayers.length, "anonymous prayers");

      const openai = getOpenAIClient();

      // Build prayer data for classification with names and group info
      const prayerData: { index: number; name: string; gender: string; group: number | null; prayer: string; isAnonymous: boolean; participantId: string }[] = [];
      let prayerIndex = 1;

      for (const p of namedPrayers) {
        prayerData.push({
          index: prayerIndex,
          name: p.name,
          gender: p.gender,
          group: p.groupNumber,
          prayer: p.prayerRequest!,
          isAnonymous: false,
          participantId: p.id
        });
        prayerIndex++;
      }
      for (const p of anonymousPrayers) {
        prayerData.push({
          index: prayerIndex,
          name: p.name,
          gender: p.gender,
          group: p.groupNumber,
          prayer: p.anonymousPrayer!,
          isAnonymous: true,
          participantId: p.id
        });
        prayerIndex++;
      }

      // Build input text for AI
      let prayerInputText = "";
      for (const p of prayerData) {
        if (p.isAnonymous) {
          prayerInputText += `${p.index}. [匿名] ${p.prayer}\n`;
        } else {
          prayerInputText += `${p.index}. ${p.name}（${p.gender === 'male' ? '弟兄' : '姊妹'}，第${p.group || '?'}組）：${p.prayer}\n`;
        }
      }

      console.log("[PrayerMeeting] Prayer input for AI:", prayerInputText.substring(0, 500) + "...");

      // Use the enhanced "Church Prayer Secretary" prompt
      const systemPrompt = `# Role
你是一位具備高度組織力與同理心的「教會代禱秘書」。你的專長是從大量的感性文字中，精準提取核心需求並進行系統化分類。

# Goal
請處理以下提供的禱告數據，並依照以下維度輸出整理後的報告。

# Classification Rules
1. 需求分類：標籤包括「疾病醫治」、「財務供應」、「親子家庭」、「職場工作」、「靈魂得救」、「人際關係」、「婚姻關係」、「學業考試」、「信仰成長」、「事工服事」、「感恩讚美」、「其他」。
2. 緊急程度：
   - [緊急]：涉及手術、病危、立即性債務、心理崩潰、家庭變故、自殺傾向、重大疾病（癌症等）。
   - [一般]：常規生活代禱、感謝讚美。
3. 匿名原則：在 (c) 清單中，必須將姓名轉為「一位弟兄」或「一位姊妹」，並遮蔽具體公司名稱或路名。

# Output Format (JSON)
請回傳以下JSON結構：

{
  "classifications": [
    { "index": 1, "category": "疾病醫治", "isUrgent": true, "urgentReason": "癌症診斷" },
    { "index": 2, "category": "職場工作", "isUrgent": false, "urgentReason": null }
  ],
  "report": {
    "summary": [
      { "name": "張小明", "group": 1, "summary": "為工作面試禱告" },
      { "name": "李美玲", "group": 2, "summary": "感謝神的恩典" }
    ],
    "categories": {
      "疾病醫治": [
        { "name": "王大偉", "content": "為父親的健康禱告", "isUrgent": true }
      ],
      "職場工作": [
        { "name": "張小明", "content": "求神帶領工作面試", "isUrgent": false }
      ]
    },
    "anonymousWall": [
      { "gender": "弟兄", "content": "求主醫治身體的軟弱，賜下平安" },
      { "gender": "姊妹", "content": "為家庭關係修復禱告" }
    ],
    "urgent": [
      { "name": "王大偉", "reason": "父親確診癌症，需要緊急代禱", "category": "疾病醫治" }
    ],
    "hasAlertContent": false,
    "alertMessage": ""
  }
}

# Constraint
- 語氣必須溫暖且莊重，不可有冷冰冰的機器感。
- 若內容提及自殺、自殘或重大犯罪，請設置 hasAlertContent 為 true，並在 alertMessage 中說明需要牧長特別關注。
- 必須使用繁體中文。
- 只回覆JSON，不要其他文字。`;

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const resultObj = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `System: ${systemPrompt}\n\nUser: ${prayerInputText}` }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8000
        }
      });

      console.log("[PrayerMeeting] AI response received");
      const content = resultObj.response.text();
      if (!content) {
        console.error("[PrayerMeeting] AI response empty");
        return res.status(500).json({ error: "AI response empty" });
      }

      console.log("[PrayerMeeting] AI response length:", content.length);
      const result = JSON.parse(content);
      const classifications = result.classifications || [];
      const report = result.report || {};

      console.log("[PrayerMeeting] Classifications:", classifications.length);

      // Update individual participant categories for quick filtering
      let classifiedCount = 0;
      for (const classification of classifications) {
        const prayerItem = prayerData.find(p => p.index === classification.index);
        if (prayerItem) {
          if (prayerItem.isAnonymous) {
            await storage.updatePrayerMeetingParticipant(prayerItem.participantId, {
              anonymousPrayerCategory: classification.category,
              isAnonymousPrayerUrgent: classification.isUrgent === true,
            });
          } else {
            await storage.updatePrayerMeetingParticipant(prayerItem.participantId, {
              prayerCategory: classification.category,
              isUrgent: classification.isUrgent === true,
            });
          }
          classifiedCount++;
        }
      }

      // Generate Markdown report
      let markdownReport = `# ${meeting.title} 禱告報告\n\n`;
      markdownReport += `> 生成時間：${new Date().toLocaleString('zh-TW')}\n`;
      markdownReport += `> 實名禱告：${namedPrayers.length} 則 | 匿名禱告：${anonymousPrayers.length} 則\n\n`;

      // Alert section if needed
      if (report.hasAlertContent) {
        markdownReport += `## ⚠️ 特別關注事項\n\n`;
        markdownReport += `> **請牧長特別留意：** ${report.alertMessage}\n\n`;
        markdownReport += `---\n\n`;
      }

      // Section (a): Summary list
      markdownReport += `## (a) 各組/個人彙總清單\n\n`;
      if (report.summary && report.summary.length > 0) {
        for (const item of report.summary) {
          markdownReport += `- **${item.name}**（第${item.group || '?'}組）：${item.summary}\n`;
        }
      } else {
        markdownReport += `_無資料_\n`;
      }
      markdownReport += `\n`;

      // Section (b): Category report
      markdownReport += `## (b) 需求類別分類報告\n\n`;
      if (report.categories) {
        for (const [category, items] of Object.entries(report.categories)) {
          if (Array.isArray(items) && items.length > 0) {
            markdownReport += `### 📂 ${category}\n`;
            for (const item of items as any[]) {
              const urgentBadge = item.isUrgent ? ' 🚨' : '';
              markdownReport += `- **${item.name}**：${item.content}${urgentBadge}\n`;
            }
            markdownReport += `\n`;
          }
        }
      }

      // Section (c): Anonymous prayer wall
      markdownReport += `## (c) 匿名代禱牆\n\n`;
      markdownReport += `> _適合公開投影使用_\n\n`;
      if (report.anonymousWall && report.anonymousWall.length > 0) {
        for (const item of report.anonymousWall) {
          markdownReport += `- 「一位${item.gender}：${item.content}」\n`;
        }
      } else {
        markdownReport += `_無匿名禱告_\n`;
      }
      markdownReport += `\n`;

      // Section (d): Urgent prayers
      markdownReport += `## (d) 🚨 緊急代禱專區\n\n`;
      if (report.urgent && report.urgent.length > 0) {
        markdownReport += `> _需要特別關注的禱告事項_\n\n`;
        let urgentIndex = 1;
        for (const item of report.urgent) {
          markdownReport += `${urgentIndex}. **${item.name}**（${item.category}）：${item.reason}\n`;
          urgentIndex++;
        }
      } else {
        markdownReport += `_目前沒有緊急代禱事項_\n`;
      }

      // Save report to database
      await db.update(prayerMeetings)
        .set({ prayerReport: markdownReport })
        .where(eq(prayerMeetings.id, meeting.id));

      console.log("[PrayerMeeting] Classification and report generation complete");
      res.json({
        message: "Prayers classified successfully",
        classified: classifiedCount,
        report: markdownReport,
        hasAlertContent: report.hasAlertContent || false
      });
    } catch (error) {
      console.error("[PrayerMeeting] Failed to classify prayers:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to classify prayers", details: errorMessage });
    }
  });

  // Get prayer list for a meeting (with AI classification)
  app.get("/api/prayer-meetings/:id/prayer-list", async (req, res) => {
    try {
      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const participants = await storage.getPrayerMeetingParticipants(meeting.id);
      const groupNumber = req.query.group ? parseInt(req.query.group as string) : null;

      // Support both old (includeAnonymous) and new (mode) parameters for backward compatibility
      const includeAnonymousLegacy = req.query.includeAnonymous === 'true';
      let mode = (req.query.mode as string) || (includeAnonymousLegacy ? 'all' : 'named');

      const excludeParticipantId = req.query.excludeParticipant as string | undefined;

      type PrayerItem = {
        id: string;
        name: string;
        prayerRequest: string;
        isAnonymous: boolean;
        groupNumber: number | null;
        prayerType: 'named' | 'anonymous' | 'urgent';
        gender?: string;
      };

      const namedPrayers: PrayerItem[] = [];
      const urgentPrayers: PrayerItem[] = [];
      const anonymousPrayers: PrayerItem[] = [];

      for (const p of participants) {
        if (p.urgentPrayer && p.urgentPrayer.trim()) {
          urgentPrayers.push({
            id: `${p.id}-urgent`,
            name: p.name,
            prayerRequest: p.urgentPrayer,
            isAnonymous: false,
            groupNumber: p.groupNumber,
            prayerType: 'urgent',
          });
        }

        if (p.prayerRequest && p.prayerRequest.trim()) {
          if (groupNumber && p.groupNumber !== groupNumber) {
          } else {
            namedPrayers.push({
              id: p.id,
              name: p.name,
              prayerRequest: p.prayerRequest,
              isAnonymous: false,
              groupNumber: p.groupNumber,
              prayerType: 'named',
            });
          }
        }

        if (p.anonymousPrayer && p.anonymousPrayer.trim()) {
          if (excludeParticipantId && p.id === excludeParticipantId) continue;
          anonymousPrayers.push({
            id: `${p.id}-anon`,
            name: '匿名',
            prayerRequest: p.anonymousPrayer,
            isAnonymous: true,
            groupNumber: p.groupNumber,
            prayerType: 'anonymous',
            gender: p.gender,
          });
        }
      }

      const groupedNamedPrayers: Record<number, PrayerItem[]> = {};
      for (const prayer of [...namedPrayers, ...urgentPrayers]) {
        const groupKey = prayer.groupNumber || 0;
        if (!groupedNamedPrayers[groupKey]) groupedNamedPrayers[groupKey] = [];
        groupedNamedPrayers[groupKey].push(prayer);
      }

      res.json({
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        groupNumber,
        urgentPrayers,
        namedPrayers,
        anonymousPrayers,
        groupedNamedPrayers,
        totalCount: urgentPrayers.length + namedPrayers.length + anonymousPrayers.length,
        stats: {
          totalParticipants: participants.length,
          urgentCount: urgentPrayers.length,
          namedCount: namedPrayers.length,
          anonymousCount: anonymousPrayers.length,
          groupCount: new Set(participants.map(p => p.groupNumber).filter(Boolean)).size,
        },
      });
    } catch (error) {
      console.error("[PrayerMeeting] Failed to get prayer list:", error);
      res.status(500).json({ error: "Failed to get prayer list" });
    }
  });

  // Close a prayer meeting (mark as closed, keep data for history)
  app.delete("/api/prayer-meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const meeting = await storage.getPrayerMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Prayer meeting not found" });
      }

      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);

      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }

      if (meeting.ownerId !== userId) {
        const role = userId ? await storage.getUserRole(userId) : undefined;
        if (role !== 'admin') {
          return res.status(403).json({ error: "Only the meeting owner can close it" });
        }
      }

      // Mark as closed instead of deleting - preserves prayer data for history
      await storage.updatePrayerMeetingStatus(meeting.id, 'closed');
      res.json({ success: true, status: 'closed' });
    } catch (error) {
      res.status(500).json({ error: "Failed to close prayer meeting" });
    }
  });


  // Card Questions CRUD for admin
  app.get("/api/card-questions", async (req, res) => {
    try {
      const questions = await storage.getAllCardQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get card questions" });
    }
  });

  app.post("/api/card-questions", requireLeader, async (req, res) => {
    try {
      const { contentText, contentTextEn, level, isActive, sortOrder } = req.body;
      const question = await storage.createCardQuestion({
        contentText,
        contentTextEn,
        level,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      });
      res.json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to create card question" });
    }
  });

  app.patch("/api/card-questions/:id", requireLeader, async (req, res) => {
    try {
      const question = await storage.updateCardQuestion(req.params.id, req.body);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      res.json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to update card question" });
    }
  });

  app.delete("/api/card-questions/:id", requireLeader, async (req, res) => {
    try {
      await storage.deleteCardQuestion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card question" });
    }
  });

  app.get("/api/message-cards", async (req, res) => {
    try {
      const cards = await storage.getMessageCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message cards" });
    }
  });

  app.get("/api/message-cards/all", requireLeader, async (req, res) => {
    try {
      const cards = await storage.getAllMessageCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all message cards" });
    }
  });

  app.get("/api/message-card-downloads", requireLeader, async (req, res) => {
    try {
      const downloads = await storage.getMessageCardDownloads();
      res.json(downloads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message card downloads" });
    }
  });

  app.get("/api/message-cards/:shortCode", async (req, res) => {
    try {
      const card = await storage.getMessageCard(req.params.shortCode);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message card" });
    }
  });

  // Get message card image
  app.get("/api/message-cards/image/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);

    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join(process.cwd(), 'public', 'message-cards', filename);

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      // Fallback for migrated data: redirect to legacy Supabase storage
      // This ensures images from the old environment still work by redirecting to the original source
      const legacyUrl = `https://evyfzgrkvpwyvwmiajtx.supabase.co/storage/v1/object/public/card-images/${filename}`;
      return res.redirect(legacyUrl);
    }
  });

  // Upload message card image
  app.post("/api/message-cards/upload", requireLeader, uploadMessageCard.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const imagePath = req.file.filename;
      res.json({ imagePath });
    } catch (error) {
      console.error("Failed to upload image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Delete message card image
  app.delete("/api/message-cards/image/:filename", requireLeader, async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'message-cards', path.basename(req.params.filename));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  app.post("/api/message-cards", requireLeader, async (req, res) => {
    try {
      // Generate short code if not provided
      const shortCode = req.body.shortCode || Math.random().toString(36).substring(2, 6).toUpperCase();
      const card = await storage.createMessageCard({
        ...req.body,
        shortCode,
      });
      res.status(201).json(card);
    } catch (error) {
      console.error("Failed to create message card:", error);
      res.status(500).json({ error: "Failed to create message card" });
    }
  });

  app.patch("/api/message-cards/:id", requireLeader, async (req, res) => {
    try {
      const card = await storage.updateMessageCard(req.params.id, req.body);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Failed to update message card:", error);
      res.status(500).json({ error: "Failed to update message card" });
    }
  });

  app.delete("/api/message-cards/:id", requireLeader, async (req, res) => {
    try {
      await storage.deleteMessageCard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message card:", error);
      res.status(500).json({ error: "Failed to delete message card" });
    }
  });

  app.get("/api/message-card-downloads/by-card/:cardId", requireLeader, async (req, res) => {
    try {
      const downloads = await storage.getMessageCardDownloadsByCardId(req.params.cardId);
      res.json(downloads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get downloads" });
    }
  });

  app.get("/api/users/:id/profile", requireSelfOrRole("id", "admin", "senior_pastor", "pastor", "minister", "group_leader", "leader"), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        birthday: user.birthday,
        userGender: user.userGender,
        address: user.address,
        church: normalizeChurch(user.church),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  app.patch("/api/users/:id/profile", requireSelfOrRole("id", "admin", "senior_pastor", "pastor", "minister", "group_leader", "leader"), async (req, res) => {
    try {
      const { displayName, avatarUrl, birthday, userGender, address, church } = req.body;

      if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        return res.status(400).json({ error: "Display name is required" });
      }

      const updated = await storage.updateUser(req.params.id, {
        displayName: displayName.trim(),
        avatarUrl,
        birthday: birthday || null,
        userGender: userGender || null,
        address: address ? String(address).trim() : null,
        church: normalizeChurch(church ? String(church) : null),
      });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.post("/api/users/:id/avatar", requireSelfOrRole("id", "admin", "leader"), async (req, res) => {
    try {
      const multer = (await import("multer")).default;
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }
      });

      upload.single('avatar')(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: "Upload failed" });
        }

        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const fsP = await import("fs/promises");
        const pathMod = await import("path");
        const uploadDir = pathMod.default.join(process.cwd(), "uploads", "avatars");
        await fsP.mkdir(uploadDir, { recursive: true });

        const filename = `${req.params.id}-${Date.now()}.jpg`;
        const filepath = pathMod.default.join(uploadDir, filename);
        await fsP.writeFile(filepath, file.buffer);

        const avatarUrl = `/uploads/avatars/${filename}`;
        await storage.updateUser(req.params.id, { avatarUrl });

        res.json({ avatarUrl });
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  app.delete("/api/users/:id/avatar", requireSelfOrRole("id", "admin", "leader"), async (req, res) => {
    try {
      await storage.updateUser(req.params.id, { avatarUrl: null });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove avatar" });
    }
  });

  app.get("/api/users", requireLeader, async (req, res) => {
    try {
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const users = await storage.getUsers(churchScope);
      res.json(filterUsersForCrmAccess(users, access).map(sanitizeUserRecord));
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/user-roles", requireLeader, async (req, res) => {
    try {
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const visibleUsers = filterUsersForCrmAccess(await storage.getUsers(churchScope), access);
      const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
      const roles = await storage.getUserRoles(churchScope);
      res.json(access.role === "admin" ? roles : roles.filter((role) => visibleUserIds.has(role.userId)));
    } catch (error) {
      res.status(500).json({ error: "Failed to get user roles" });
    }
  });

  app.put("/api/user-roles/:userId", requireCrmDirector, async (req, res) => {
    try {
      const { role } = req.body;
      if (!["member", "leader", "future_leader", "admin", "senior_pastor", "pastor", "minister", "group_leader"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const directorUserId = (req as any).legacyUserId || await resolveUserId(req);
      const directorRole = directorUserId ? await storage.getUserRole(directorUserId) : null;
      if (directorRole === "senior_pastor") {
        const [director, target] = await Promise.all([
          directorUserId ? storage.getUser(directorUserId) : Promise.resolve(undefined),
          storage.getUser(req.params.userId),
        ]);
        if (!target || normalizeChurch(target.church) !== normalizeChurch(director?.church)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      await storage.upsertUserRole(req.params.userId, role);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.patch("/api/potential-members/:id", requireLeader, async (req, res) => {
    try {
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (churchScope) {
        const existing = await pool.query("SELECT id, email, church FROM potential_members WHERE id = $1", [req.params.id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Potential member not found" });
        }
        const existingChurch = normalizeChurch(existing.rows[0].church);
        const inScope = churchScope === UNASSIGNED_CHURCH_ID
          ? !existingChurch
          : existingChurch === churchScope;
        const inCrmAccess = filterPotentialMembersForCrmAccess(existing.rows, access).length > 0;
        if (!inScope || !inCrmAccess || (!access.canManageMembers && !access.canManageCare)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const updates = { ...req.body };
      if (typeof updates.church === "string") {
        updates.church = normalizeChurch(updates.church);
      }
      const updated = await storage.updatePotentialMember(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Potential member not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update potential member" });
    }
  });

  app.delete("/api/potential-members/:id", requireLeader, async (req, res) => {
    try {
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (churchScope) {
        const existing = await pool.query("SELECT id, email, church FROM potential_members WHERE id = $1", [req.params.id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Potential member not found" });
        }
        const existingChurch = normalizeChurch(existing.rows[0].church);
        const inScope = churchScope === UNASSIGNED_CHURCH_ID
          ? !existingChurch
          : existingChurch === churchScope;
        const inCrmAccess = filterPotentialMembersForCrmAccess(existing.rows, access).length > 0;
        if (!inScope || !inCrmAccess) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      await storage.deletePotentialMember(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete potential member" });
    }
  });

  app.get("/api/sessions/:sessionId/study-responses", requireLeader, async (req, res) => {
    try {
      const responses = await storage.getStudyResponses(req.params.sessionId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study responses" });
    }
  });

  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Profile notification endpoint using Resend integration
  app.post("/api/send-profile-notification", requireLeader, async (req, res) => {
    try {
      const { email, name, type, redirectUrl } = req.body;

      const { sendEmail } = await import('./resend');

      let subject = '';
      let html = '';

      switch (type) {
        case 'welcome':
          subject = '歡迎加入 WeChurch';
          html = `
            <h1>歡迎 ${name}!</h1>
            <p>感謝您加入 WeChurch 社群。</p>
            <p>點擊下方連結開始您的信仰之旅：</p>
            <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 8px;">開始使用</a>
          `;
          break;
        case 'session_invite':
          subject = '您收到了一個聚會邀請';
          html = `
            <h1>Hi ${name}!</h1>
            <p>您被邀請參加一個新的聚會。</p>
            <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 8px;">查看詳情</a>
          `;
          break;
        default:
          subject = 'WeChurch 通知';
          html = `
            <h1>Hi ${name}!</h1>
            <p>您有一則新通知。</p>
            <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 8px;">查看</a>
          `;
      }

      await sendEmail({
        to: email,
        subject,
        html
      });

      res.json({ success: true, message: "郵件已發送" });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: "Failed to send notification", message: error.message });
    }
  });

  app.get("/api/admin/users-for-email", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { role, church } = req.query;
      const churchScope = await getChurchScope(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const allUsers = filterUsersForCrmAccess(await storage.getUsers(churchScope), access);
      const visibleUserIds = new Set(allUsers.map((user) => user.id));
      const allRoles = (await storage.getUserRoles(churchScope)).filter((role) => visibleUserIds.has(role.userId));

      const roleMap = new Map<string, string>();
      for (const r of allRoles) {
        roleMap.set(r.userId, r.role);
      }

      let result = allUsers
        .filter(u => u.email)
        .map(u => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName || null,
          church: normalizeChurch((u as any).church) || null,
          role: roleMap.get(u.id) || 'member',
        }));

      if (role && typeof role === 'string') {
        result = result.filter(u => u.role === role);
      }
      if (!churchScope && church && typeof church === 'string' && church !== 'all') {
        result = result.filter(u => u.church === normalizeChurch(church));
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching users for email:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/daily-follow-email/preview", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(404).json({ error: "User email not found" });
      }

      const { buildDailyFollowEmail } = await import("./dailyFollowEmail");
      const email = await buildDailyFollowEmail(user);
      res.json(email);
    } catch (error: any) {
      console.error("Error building daily follow email preview:", error);
      res.status(500).json({ error: "Failed to build daily follow email", message: error.message });
    }
  });

  const defaultEmailPreferences = (userId: string) => ({
    userId,
    dailyFollowEnabled: false,
    dailyFollowTime: "07:00",
    timezone: "Asia/Taipei",
    lastDailyFollowSentAt: null,
    createdAt: null,
    updatedAt: null,
  });

  app.get("/api/email-preferences", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [preferences] = await db
        .select()
        .from(userEmailPreferences)
        .where(eq(userEmailPreferences.userId, userId))
        .limit(1);

      res.json(preferences || defaultEmailPreferences(userId));
    } catch (error: any) {
      console.error("Error fetching email preferences:", error);
      res.status(500).json({ error: "Failed to fetch email preferences", message: error.message });
    }
  });

  app.get("/api/email-provider-status", async (_req, res) => {
    const hasResendKey = Boolean(process.env.RESEND_API_KEY);
    const hasReplitConnector = Boolean(
      process.env.REPLIT_CONNECTORS_HOSTNAME &&
      (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
    );

    res.json({
      configured: hasResendKey || hasReplitConnector,
      mode: hasResendKey ? "resend_api_key" : hasReplitConnector ? "replit_connector" : "preview_only",
    });
  });

  app.patch("/api/email-preferences", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const preferenceSchema = z.object({
        dailyFollowEnabled: z.boolean().optional(),
        dailyFollowTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
      });
      const parsed = preferenceSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email preferences", details: parsed.error.flatten() });
      }

      const now = new Date();
      const [preferences] = await db
        .insert(userEmailPreferences)
        .values({
          userId,
          dailyFollowEnabled: parsed.data.dailyFollowEnabled ?? false,
          dailyFollowTime: parsed.data.dailyFollowTime || "07:00",
          timezone: parsed.data.timezone || "Asia/Taipei",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userEmailPreferences.userId,
          set: {
            ...parsed.data,
            updatedAt: now,
          },
        })
        .returning();

      res.json(preferences);
    } catch (error: any) {
      console.error("Error updating email preferences:", error);
      res.status(500).json({ error: "Failed to update email preferences", message: error.message });
    }
  });

  app.post("/api/daily-follow-email/send-test", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(404).json({ error: "User email not found" });
      }

      const { sendDailyFollowEmail } = await import("./dailyFollowEmail");
      const context = await sendDailyFollowEmail(user);
      res.json({ success: true, sent: 1, context });
    } catch (error: any) {
      if (error?.message === "EMAIL_PROVIDER_NOT_CONFIGURED" || error?.message?.includes("X_REPLIT_TOKEN")) {
        try {
          const userId = await resolveUserId(req);
          const user = userId ? await storage.getUser(userId) : null;
          if (!user?.email) {
            return res.status(503).json({
              error: "Email provider not configured",
              message: "本機尚未連接寄信服務，也找不到使用者 email。",
            });
          }

          const { buildDailyFollowEmail } = await import("./dailyFollowEmail");
          const preview = await buildDailyFollowEmail(user);
          return res.status(202).json({
            success: false,
            previewOnly: true,
            message: "本機尚未連接 Resend 寄信服務，已改為產生測試信預覽。正式部署設定 Resend 後會真的寄出。",
            subject: preview.subject,
            html: preview.html,
            text: preview.text,
            context: preview.context,
          });
        } catch (previewError: any) {
          console.error("Error building daily follow test email preview:", previewError);
        }
      }
      console.error("Error sending daily follow test email:", error);
      res.status(500).json({ error: "Failed to send daily follow test email", message: error.message });
    }
  });

  app.post("/api/admin/daily-follow-email/send", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !["admin", "leader"].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const bodySchema = z.object({
        userIds: z.array(z.string().uuid()).optional(),
        dryRun: z.boolean().optional().default(true),
        limit: z.number().int().min(1).max(500).optional(),
      });
      const parsed = bodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { userIds, dryRun, limit } = parsed.data;
      const allUsers = await storage.getUsers();
      const enabledPreferences = await db
        .select()
        .from(userEmailPreferences)
        .where(eq(userEmailPreferences.dailyFollowEnabled, true));
      const enabledUserIds = new Set(enabledPreferences.map((preference) => preference.userId));
      const selectedUsers = allUsers
        .filter((user) => user.email && (!userIds ? enabledUserIds.has(user.id) : userIds.includes(user.id)))
        .slice(0, limit ?? allUsers.length);

      const { buildDailyFollowEmail, sendDailyFollowEmail } = await import("./dailyFollowEmail");
      const results = {
        dryRun,
        total: selectedUsers.length,
        sent: 0,
        failed: 0,
        previews: [] as Array<{ userId: string; email: string; subject: string; context: any }>,
        errors: [] as string[],
      };

      for (const user of selectedUsers) {
        try {
          if (dryRun) {
            const email = await buildDailyFollowEmail(user);
            results.previews.push({ userId: user.id, email: user.email, subject: email.subject, context: email.context });
          } else {
            const context = await sendDailyFollowEmail(user);
            results.sent++;
            results.previews.push({ userId: user.id, email: user.email, subject: "", context });
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${user.email}: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error sending admin daily follow emails:", error);
      res.status(500).json({ error: "Failed to send daily follow emails", message: error.message });
    }
  });

  app.post("/api/cron/daily-follow-email", async (req, res) => {
    try {
      const secret = process.env.DAILY_FOLLOW_EMAIL_CRON_SECRET;
      if (!secret || req.headers["x-cron-secret"] !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const bodySchema = z.object({
        dryRun: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(1000).optional(),
      });
      const parsed = bodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const allUsers = await storage.getUsers();
      const enabledPreferences = await db
        .select()
        .from(userEmailPreferences)
        .where(eq(userEmailPreferences.dailyFollowEnabled, true));
      const enabledUserIds = new Set(enabledPreferences.map((preference) => preference.userId));
      const selectedUsers = allUsers
        .filter((user) => user.email && enabledUserIds.has(user.id))
        .slice(0, parsed.data.limit ?? allUsers.length);
      const { buildDailyFollowEmail, sendDailyFollowEmail } = await import("./dailyFollowEmail");
      const results = { dryRun: parsed.data.dryRun, total: selectedUsers.length, sent: 0, failed: 0, errors: [] as string[] };

      for (const user of selectedUsers) {
        try {
          if (parsed.data.dryRun) {
            await buildDailyFollowEmail(user);
          } else {
            await sendDailyFollowEmail(user);
            results.sent++;
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${user.email}: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error running daily follow email cron:", error);
      res.status(500).json({ error: "Failed to run daily follow email cron", message: error.message });
    }
  });

  app.post("/api/send-bulk-email", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { recipients, subject, body, isHtml, attachments } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients required" });
      }
      if (!subject || typeof subject !== 'string') {
        return res.status(400).json({ error: "Subject required" });
      }
      if (!body || typeof body !== 'string') {
        return res.status(400).json({ error: "Body required" });
      }
      if (attachments && Array.isArray(attachments)) {
        if (attachments.length > 5) {
          return res.status(400).json({ error: "Maximum 5 attachments allowed" });
        }
        for (const att of attachments) {
          if (!att.filename || !att.content) {
            return res.status(400).json({ error: "Invalid attachment format" });
          }
        }
      }

      const { sendBulkEmail } = await import('./resend');

      const result = await sendBulkEmail(recipients, subject, body, isHtml !== false, attachments);

      res.json(result);
    } catch (error: any) {
      console.error('Error sending bulk email:', error);
      res.status(500).json({ error: "Failed to send emails", message: error.message });
    }
  });

  // ============ Inbox / Inbound Email Routes ============
  app.post("/api/webhooks/resend/inbound", async (req, res) => {
    try {
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (webhookSecret) {
        const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
        if (providedSecret !== webhookSecret) {
          console.warn('[Inbound] Invalid webhook secret');
          return res.status(401).json({ error: "Invalid webhook secret" });
        }
      }

      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const from = body.from;
      const to = body.to;
      const subject = body.subject;
      const text = body.text;
      const html = body.html;

      if (!from || typeof from !== 'string') {
        return res.status(400).json({ error: "Missing or invalid 'from' field" });
      }
      if (!to) {
        return res.status(400).json({ error: "Missing 'to' field" });
      }

      let fromEmail = from;
      let fromName: string | undefined;
      const emailMatch = from.match(/^(.+?)\s*<(.+?)>$/);
      if (emailMatch) {
        fromName = emailMatch[1].trim();
        fromEmail = emailMatch[2].trim();
      }

      const toEmail = typeof to === 'string' ? to : Array.isArray(to) ? to[0] : to;

      await storage.createInboxEmail({
        fromEmail,
        fromName: fromName || null,
        toEmail: typeof toEmail === 'string' ? toEmail.replace(/<|>/g, '').trim() : String(toEmail),
        subject: (typeof subject === 'string' ? subject : null) || '(無主旨)',
        bodyText: typeof text === 'string' ? text : null,
        bodyHtml: typeof html === 'string' ? html : null,
        isRead: false,
        isArchived: false,
        resendEmailId: null,
      });

      console.log('[Inbound] Received email from:', fromEmail, 'subject:', subject);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Inbound] Error processing inbound email:', error);
      res.status(500).json({ error: "Failed to process inbound email" });
    }
  });

  app.get("/api/admin/inbox", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const archived = req.query.archived === 'true';
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const emails = await storage.getInboxEmails({ archived, limit, offset });
      res.json(emails);
    } catch (error: any) {
      console.error('Error fetching inbox:', error);
      res.status(500).json({ error: "Failed to fetch inbox" });
    }
  });

  app.get("/api/admin/inbox/unread-count", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const count = await storage.getInboxUnreadCount();
      res.json({ count });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  app.patch("/api/admin/inbox/:id/read", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

      const isRead = req.body.isRead !== false;
      const email = await storage.markInboxEmailRead(id, isRead);
      if (!email) return res.status(404).json({ error: "Email not found" });
      res.json(email);
    } catch (error: any) {
      console.error('Error marking email read:', error);
      res.status(500).json({ error: "Failed to update email" });
    }
  });

  app.patch("/api/admin/inbox/:id/archive", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

      const isArchived = req.body.isArchived !== false;
      const email = await storage.archiveInboxEmail(id, isArchived);
      if (!email) return res.status(404).json({ error: "Email not found" });
      res.json(email);
    } catch (error: any) {
      console.error('Error archiving email:', error);
      res.status(500).json({ error: "Failed to archive email" });
    }
  });

  // ============ Bible API Routes ============
  app.get("/api/bible/books", async (req, res) => {
    try {
      const books = await storage.getBibleBooks();
      res.json(books);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
      res.status(500).json({ error: "Failed to get Bible books" });
    }
  });

  app.get("/api/bible/chapters/:bookName", async (req, res) => {
    try {
      const chapters = await storage.getBibleChapters(req.params.bookName);
      res.json(chapters);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      res.status(500).json({ error: "Failed to get chapters" });
    }
  });

  app.get("/api/bible/verses/:bookName/:chapter", async (req, res) => {
    try {
      const chapter = parseInt(req.params.chapter, 10);
      const verses = await storage.getBibleVerses(req.params.bookName, chapter);
      res.json(verses);
    } catch (error) {
      console.error('Error fetching verses:', error);
      res.status(500).json({ error: "Failed to get verses" });
    }
  });

  app.get("/api/bible/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const verses = await storage.searchBibleVerses(query, limit);
      res.json(verses);
    } catch (error) {
      console.error('Error searching Bible:', error);
      res.status(500).json({ error: "Failed to search Bible" });
    }
  });

  app.get("/api/bible/blessing", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const verses = await storage.getBlessingVerses(type);
      res.json(verses);
    } catch (error) {
      console.error('Error fetching blessing verses:', error);
      res.status(500).json({ error: "Failed to get blessing verses" });
    }
  });

  app.get("/api/bible/blessing/random", async (req, res) => {
    try {
      const verse = await storage.getRandomBlessingVerse();
      // Cache for 10 minutes on client — blessing verse changes infrequently
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.json(verse || null);
    } catch (error) {
      console.error('Error fetching random blessing verse:', error);
      res.status(500).json({ error: "Failed to get random blessing verse" });
    }
  });

  // ============ Jesus 4 Seasons API Routes ============
  app.get("/api/jesus/timeline", async (req, res) => {
    try {
      const season = req.query.season as string | undefined;
      const events = season
        ? await storage.getJesus4SeasonsBySeason(season)
        : await storage.getJesus4Seasons();
      // Timeline is static content — cache for 1 hour
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.json(events);
    } catch (error) {
      console.error('Error fetching Jesus timeline:', error);
      res.status(500).json({ error: "Failed to get Jesus timeline" });
    }
  });

  // Fetch Bible verses by scripture reference (e.g., "Mt 1:1-17")
  app.get("/api/bible/by-reference", async (req, res) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: "Missing ref parameter" });
      }

      // Map gospel abbreviations to Chinese book names
      const bookMap: Record<string, string> = {
        'Mt': '馬太福音',
        'Mk': '馬可福音',
        'Lk': '路加福音',
        'Jn': '約翰福音',
      };

      // Parse reference like "Mt 1:1-17" or "Lk 3:23-38"
      const match = ref.match(/^(Mt|Mk|Lk|Jn)\s*(\d+):(\d+)(?:-(\d+))?$/);
      if (!match) {
        return res.json({ verses: [], error: "Invalid reference format" });
      }

      const [, abbr, chapterStr, startStr, endStr] = match;
      const bookName = bookMap[abbr];
      const chapter = parseInt(chapterStr);
      const startVerse = parseInt(startStr);
      const endVerse = endStr ? parseInt(endStr) : startVerse;

      const allVerses = await storage.getBibleVerses(bookName, chapter);
      const filteredVerses = allVerses.filter(v => v.verse >= startVerse && v.verse <= endVerse);

      res.json({
        bookName,
        chapter,
        verses: filteredVerses
      });
    } catch (error) {
      console.error('Error fetching verses by reference:', error);
      res.status(500).json({ error: "Failed to get verses" });
    }
  });

  app.get("/api/jesus/daily-content", async (req, res) => {
    try {
      const season = req.query.season as string | undefined;
      const content = await storage.getJesusDailyContent(season);
      res.json(content);
    } catch (error) {
      console.error('Error fetching daily content:', error);
      res.status(500).json({ error: "Failed to get daily content" });
    }
  });

  app.get("/api/church-reading/today", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    try {
      const content = await fetchDailyDevotionBrief(date);
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      res.json(content);
    } catch (error) {
      console.error("Error fetching church daily devotion:", error);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.json(buildFallbackDailyDevotionBrief(date));
    }
  });

  // ============ Journey Templates API Routes ============
  app.get("/api/journeys/love-journey-28/seed", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json(buildLoveJourneyTemplateSeed());
  });

  app.get("/api/line-login/config", (req, res) => {
    const config = getLineLoginConfig(req);
    res.json({
      configured: config.configured,
      channelId: config.channelId || null,
      liffId: config.liffId || null,
      officialAccountId: config.officialAccountId || null,
      callbackPath: config.callbackPath,
      callbackUrl: config.callbackUrl,
      loginUrlPath: "/api/line-login/url",
    });
  });

  app.get("/api/line-login/url", (req: any, res) => {
    const config = getLineLoginConfig(req);
    if (!config.configured) {
      return res.status(409).json({
        configured: false,
        error: "LINE Login is not configured",
        requiredEnv: ["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET"],
      });
    }

    const state = randomBytes(24).toString("hex");
    const nonce = randomBytes(24).toString("hex");
    const redirectPath = getSafeRedirectPath(req.query.redirect);
    req.session.lineLogin = {
      state,
      nonce,
      redirectPath,
      createdAt: Date.now(),
    };

    const scopes = ["profile", "openid"];
    if (process.env.LINE_REQUEST_EMAIL === "1") scopes.push("email");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.channelId,
      redirect_uri: config.callbackUrl,
      state,
      scope: scopes.join(" "),
      nonce,
    });
    if (process.env.LINE_BOT_PROMPT) params.set("bot_prompt", process.env.LINE_BOT_PROMPT);

    const url = `https://access.line.me/oauth2/v2.1/authorize?${params.toString().replace(/\+/g, "%20")}`;
    req.session.save((error: unknown) => {
      if (error) {
        console.error("[LINE Login] Failed to save state:", error);
        return res.status(500).json({ error: "Failed to initialize LINE Login" });
      }
      res.json({ configured: true, url, redirectPath });
    });
  });

  app.get("/api/line-login/callback", async (req: any, res) => {
    try {
      const config = getLineLoginConfig(req);
      if (!config.configured) return res.status(409).send("LINE Login is not configured.");

      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const savedState = req.session?.lineLogin;
      if (!code || !state || !savedState || savedState.state !== state) {
        return res.status(400).send("Invalid LINE Login state.");
      }

      const ageMs = Date.now() - Number(savedState.createdAt || 0);
      if (ageMs > 10 * 60 * 1000) {
        delete req.session.lineLogin;
        return res.status(400).send("LINE Login state expired.");
      }

      const profile = await exchangeLineCodeForProfile({
        code,
        redirectUri: config.callbackUrl,
        channelId: config.channelId,
        channelSecret: config.channelSecret,
        expectedNonce: savedState.nonce,
      });
      const linked = await ensureLineLinkedUser(profile);

      const sessionUser: any = {
        claims: {
          sub: linked.authUserId,
          email: linked.email,
          first_name: linked.displayName,
          profile_image_url: profile.pictureUrl ?? undefined,
        },
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
      };

      delete req.session.lineLogin;
      req.login(sessionUser, (loginError: unknown) => {
        if (loginError) {
          console.error("[LINE Login] Session error:", loginError);
          return res.status(500).send("LINE Login succeeded but session creation failed.");
        }
        req.session.save((saveError: unknown) => {
          if (saveError) console.error("[LINE Login] Session save error:", saveError);
          res.redirect(savedState.redirectPath || "/");
        });
      });
    } catch (error) {
      if (isLineSchemaMissingError(error)) {
        return res.status(409).send("LINE schema is not ready. Run npm run db:push first.");
      }
      console.error("[LINE Login] Callback failed:", error);
      res.status(500).send("LINE Login failed.");
    }
  });

  app.post("/api/pastoral/journey-templates/love-journey-28/seed", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const result = await ensureLoveJourneyTemplate();
      res.status(201).json({ schemaReady: true, templateId: result.templateId, seed: result.seed });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before seeding 愛的旅程",
        });
      }
      console.error("Error seeding love journey template:", error);
      res.status(500).json({ error: "Failed to seed love journey template" });
    }
  });

  app.get("/api/serving/overview", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const overview = await getServingScheduleOverview(churchScope);
      res.json({ schemaReady: true, ...overview });
    } catch (error) {
      if (isServingSchemaMissingError(error)) {
        return res.json({
          schemaReady: false,
          teams: [],
          roles: [],
          members: [],
          events: [],
          people: [],
          message: "Serving schedule schema is not ready. Run npm run db:push to enable serving teams.",
        });
      }
      console.error("Error fetching serving schedule overview:", error);
      res.status(500).json({ error: "Failed to get serving schedule overview" });
    }
  });

  app.post("/api/serving/seed-defaults", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const result = await seedDefaultServingTeams(churchScope, userId);
      const overview = await getServingScheduleOverview(churchScope);
      res.status(201).json({ schemaReady: true, ...result, ...overview });
    } catch (error) {
      if (isServingSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Serving schedule schema is not ready",
          action: "Run npm run db:push before seeding serving teams",
        });
      }
      console.error("Error seeding serving teams:", error);
      res.status(500).json({ error: "Failed to seed serving teams" });
    }
  });

  app.post("/api/serving/teams", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingTeamBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const team = await createServingTeam({
        church: churchScope,
        name: input.name,
        category: input.category,
        description: input.description,
        leaderUserId: input.leaderUserId,
        defaultLocation: input.defaultLocation,
        defaultStartTime: input.defaultStartTime,
      });
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving team", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error creating serving team:", error);
      res.status(500).json({ error: "Failed to create serving team" });
    }
  });

  app.post("/api/serving/teams/:teamId/roles", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingRoleBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const role = await createServingRole({ teamId: req.params.teamId, ...input }, churchScope);
      if (!role) return res.status(404).json({ error: "Serving team not found" });
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving role", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error creating serving role:", error);
      res.status(500).json({ error: "Failed to create serving role" });
    }
  });

  app.post("/api/serving/teams/:teamId/members", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingMemberBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const member = await createServingTeamMember({ teamId: req.params.teamId, ...input }, churchScope);
      if (!member) return res.status(404).json({ error: "Serving team or person not found" });
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving member", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error creating serving member:", error);
      res.status(500).json({ error: "Failed to create serving member" });
    }
  });

  app.post("/api/serving/teams/:teamId/events", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingEventBodySchema.parse(req.body);
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const event = await createServingEvent({ teamId: req.params.teamId, ...input, createdByUserId: userId }, churchScope);
      if (!event) return res.status(404).json({ error: "Serving team not found" });
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving event", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error creating serving event:", error);
      res.status(500).json({ error: "Failed to create serving event" });
    }
  });

  app.patch("/api/serving/events/:eventId/status", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingEventStatusSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const event = await updateServingEventStatus(req.params.eventId, input.status, churchScope);
      if (!event) return res.status(404).json({ error: "Serving event not found" });
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving event status", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error updating serving event status:", error);
      res.status(500).json({ error: "Failed to update serving event status" });
    }
  });

  app.post("/api/serving/assignments", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingAssignmentBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const assignment = await createServingAssignment(input, churchScope);
      if (!assignment) return res.status(404).json({ error: "Serving event, role, or person not found" });
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving assignment", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error creating serving assignment:", error);
      res.status(500).json({ error: "Failed to create serving assignment" });
    }
  });

  app.patch("/api/serving/assignments/:assignmentId", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = servingAssignmentPatchSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const assignment = await updateServingAssignment(req.params.assignmentId, input, churchScope);
      if (!assignment) return res.status(404).json({ error: "Serving assignment not found" });
      res.json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid serving assignment", details: error.flatten() });
      if (isServingSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Serving schedule schema is not ready" });
      console.error("Error updating serving assignment:", error);
      res.status(500).json({ error: "Failed to update serving assignment" });
    }
  });

  app.get("/api/facilities/overview", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const overview = await getFacilityBookingOverview(churchScope);
      res.json({ schemaReady: true, ...overview });
    } catch (error) {
      if (isFacilitySchemaMissingError(error)) {
        return res.json({
          schemaReady: false,
          rooms: [],
          bookings: [],
          message: "Facility booking schema is not ready. Run npm run db:push to enable room booking.",
        });
      }
      console.error("Error fetching facility overview:", error);
      res.status(500).json({ error: "Failed to get facility overview" });
    }
  });

  app.post("/api/facilities/seed-defaults", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const result = await seedDefaultFacilityRooms(churchScope);
      const overview = await getFacilityBookingOverview(churchScope);
      res.status(201).json({ schemaReady: true, ...result, ...overview });
    } catch (error) {
      if (isFacilitySchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Facility booking schema is not ready",
          action: "Run npm run db:push before seeding rooms",
        });
      }
      console.error("Error seeding facility rooms:", error);
      res.status(500).json({ error: "Failed to seed facility rooms" });
    }
  });

  app.post("/api/facilities/rooms", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = facilityRoomBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const room = await createFacilityRoom({ church: churchScope, ...input });
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid facility room", details: error.flatten() });
      if (isFacilitySchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Facility booking schema is not ready" });
      console.error("Error creating facility room:", error);
      res.status(500).json({ error: "Failed to create facility room" });
    }
  });

  app.post("/api/facilities/bookings", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = facilityBookingBodySchema.parse(req.body);
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const booking = await createFacilityBooking({ ...input, requesterUserId: userId, createdByUserId: userId }, churchScope);
      if (!booking) return res.status(404).json({ error: "Facility room not found" });
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof FacilityBookingConflictError) {
        return res.status(409).json({
          error: "Facility booking conflict",
          conflicts: error.conflicts,
        });
      }
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid facility booking", details: error.flatten() });
      if (isFacilitySchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Facility booking schema is not ready" });
      console.error("Error creating facility booking:", error);
      res.status(500).json({ error: "Failed to create facility booking" });
    }
  });

  app.patch("/api/facilities/bookings/:bookingId/status", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = facilityBookingStatusSchema.parse(req.body);
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const booking = await updateFacilityBookingStatus(req.params.bookingId, input.status, userId, churchScope);
      if (!booking) return res.status(404).json({ error: "Facility booking not found" });
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid facility booking status", details: error.flatten() });
      if (isFacilitySchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Facility booking schema is not ready" });
      console.error("Error updating facility booking:", error);
      res.status(500).json({ error: "Failed to update facility booking" });
    }
  });

  app.get("/api/pastoral/framework", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const overview = await getPastoralFrameworkOverview(churchScope);
      res.json({ schemaReady: true, ...overview });
    } catch (error) {
      if (isPastoralFrameworkSchemaMissingError(error)) {
        return res.json({
          schemaReady: false,
          stages: [],
          sources: [],
          message: "Pastoral framework schema is not ready. Run npm run db:push to enable framework stages.",
        });
      }
      console.error("Error fetching pastoral framework:", error);
      res.status(500).json({ error: "Failed to get pastoral framework" });
    }
  });

  app.post("/api/pastoral/framework/seed-153", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const result = await seedPastoralFramework153();
      const churchScope = await getChurchScope(req);
      const overview = await getPastoralFrameworkOverview(churchScope);
      res.status(201).json({ schemaReady: true, ...result, ...overview });
    } catch (error) {
      if (isPastoralFrameworkSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral framework schema is not ready",
          action: "Run npm run db:push before seeding the pastoral framework",
        });
      }
      console.error("Error seeding pastoral framework:", error);
      res.status(500).json({ error: "Failed to seed pastoral framework" });
    }
  });

  app.patch("/api/pastoral/persons/:personId/stage", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = personStagePatchSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const allowedPerson = await getPastoralPersonDetail(req.params.personId, churchScope, { canViewPersonal: false, access });
      if (!allowedPerson) {
        return res.status(404).json({ error: "Person or pastoral stage not found" });
      }
      const result = await updatePersonPastoralStage({ personId: req.params.personId, ...input }, churchScope);
      if (!result) return res.status(404).json({ error: "Person or pastoral stage not found" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid person stage", details: error.flatten() });
      if (isPastoralFrameworkSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Pastoral framework schema is not ready" });
      console.error("Error updating person pastoral stage:", error);
      res.status(500).json({ error: "Failed to update person pastoral stage" });
    }
  });

  app.get("/api/pastoral/persons", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const limit = Number.parseInt(String(req.query.limit || "120"), 10);
      const offset = Number.parseInt(String(req.query.offset || "0"), 10);
      const persons = await getPastoralPersons(churchScope, {
        limit: Number.isFinite(limit) ? limit : 120,
        offset: Number.isFinite(offset) ? offset : 0,
        search: typeof req.query.search === "string" ? req.query.search : null,
        filter: typeof req.query.filter === "string" ? req.query.filter : null,
        access,
      });
      res.json({ schemaReady: true, persons, page: { limit, offset, hasMore: persons.length >= limit } });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.json({
          schemaReady: false,
          persons: [],
          message: "Pastoral schema is not ready. Run npm run db:push to enable persons and journeys.",
        });
      }
      console.error("Error fetching pastoral persons:", error);
      res.status(500).json({ error: "Failed to get pastoral persons" });
    }
  });

  app.post("/api/pastoral/reconcile", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const churchScope = await getChurchScope(req);
      const result = await reconcilePastoralPersons({ churchScope, careOwnerUserId: userId });
      const persons = await getPastoralPersons(churchScope, { access });
      res.json({ schemaReady: true, ...result, persons });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before reconciling persons",
        });
      }
      console.error("Error reconciling pastoral persons:", error);
      res.status(500).json({ error: "Failed to reconcile pastoral persons" });
    }
  });

  app.get("/api/pastoral/persons/:personId", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      const detail = await getPastoralPersonDetail(req.params.personId, churchScope, { canViewPersonal: access.canViewPersonal, access });
      if (!detail) {
        return res.status(404).json({ error: "Pastoral person not found" });
      }
      res.json({ schemaReady: true, access: { canViewPersonal: access.canViewPersonal, canManageCare: access.canManageCare }, ...detail });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before viewing pastoral person detail",
        });
      }
      console.error("Error fetching pastoral person detail:", error);
      res.status(500).json({ error: "Failed to get pastoral person detail" });
    }
  });

  app.post("/api/pastoral/persons/:personId/love-journey/start", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const journeyId = await startLoveJourneyForPerson(req.params.personId, userId, churchScope, access);
      if (!journeyId) {
        return res.status(404).json({ error: "Pastoral person not found" });
      }
      const detail = await getPastoralPersonDetail(req.params.personId, churchScope, { canViewPersonal: access.canViewPersonal, access });
      res.status(201).json({ schemaReady: true, journeyId, detail });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before starting 愛的旅程",
        });
      }
      console.error("Error starting love journey:", error);
      res.status(500).json({ error: "Failed to start love journey" });
    }
  });

  app.patch("/api/pastoral/journey-progress/:progressId", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = journeyProgressPatchSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const progress = await updateJourneyProgress(req.params.progressId, input, churchScope, access);
      if (!progress) {
        return res.status(404).json({ error: "Journey progress not found" });
      }
      res.json(progress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid journey progress", details: error.flatten() });
      }
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before updating journey progress",
        });
      }
      console.error("Error updating journey progress:", error);
      res.status(500).json({ error: "Failed to update journey progress" });
    }
  });

  app.patch("/api/pastoral/journey-milestones/:milestoneId", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = journeyMilestonePatchSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const milestone = await updateJourneyMilestone(req.params.milestoneId, input, churchScope, access);
      if (!milestone) {
        return res.status(404).json({ error: "Journey milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid journey milestone", details: error.flatten() });
      }
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({
          schemaReady: false,
          error: "Pastoral schema is not ready",
          action: "Run npm run db:push before updating journey milestones",
        });
      }
      console.error("Error updating journey milestone:", error);
      res.status(500).json({ error: "Failed to update journey milestone" });
    }
  });

  app.get("/api/pastoral/persons/:personId/tasks", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      res.json({ schemaReady: true, tasks: await listPastoralTasks(req.params.personId, churchScope, access) });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error listing pastoral tasks:", error);
      res.status(500).json({ error: "Failed to list pastoral tasks" });
    }
  });

  app.post("/api/pastoral/persons/:personId/tasks", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = pastoralTaskBodySchema.parse(req.body);
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const task = await createPastoralTask({
        personId: req.params.personId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt,
        assignedToUserId: input.assignedToUserId ?? userId,
        createdByUserId: userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        visibility: input.visibility,
      }, churchScope, access);
      if (!task) return res.status(404).json({ error: "Pastoral person not found" });
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pastoral task", details: error.flatten() });
      }
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error creating pastoral task:", error);
      res.status(500).json({ error: "Failed to create pastoral task" });
    }
  });

  app.post("/api/pastoral/persons/:personId/tasks/next-step", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getChurchScope(req);
      const task = await createNextStepTaskForPerson(req.params.personId, userId, churchScope, access);
      if (!task) return res.status(404).json({ error: "Pastoral person not found" });
      res.status(201).json(task);
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error creating next step pastoral task:", error);
      res.status(500).json({ error: "Failed to create next step task" });
    }
  });

  app.patch("/api/pastoral/tasks/:taskId", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = pastoralTaskPatchSchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const task = await updatePastoralTask(req.params.taskId, input, churchScope, access);
      if (!task) return res.status(404).json({ error: "Pastoral task not found" });
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pastoral task", details: error.flatten() });
      }
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error updating pastoral task:", error);
      res.status(500).json({ error: "Failed to update pastoral task" });
    }
  });

  app.get("/api/pastoral/merge-suggestions", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getChurchScope(req);
      res.json({ schemaReady: true, suggestions: await listPersonMergeSuggestions(churchScope) });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error listing merge suggestions:", error);
      res.status(500).json({ error: "Failed to list merge suggestions" });
    }
  });

  app.post("/api/pastoral/merge-suggestions/dismiss", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = mergeSuggestionBodySchema.parse(req.body);
      res.json(await dismissPersonMergeSuggestion(input.primaryPersonId, input.duplicatePersonId));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid merge suggestion", details: error.flatten() });
      console.error("Error dismissing merge suggestion:", error);
      res.status(500).json({ error: "Failed to dismiss merge suggestion" });
    }
  });

  app.post("/api/pastoral/merge-suggestions/merge", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = mergeSuggestionBodySchema.parse(req.body);
      const churchScope = await getChurchScope(req);
      const result = await mergePastoralPersons(input.primaryPersonId, input.duplicatePersonId, churchScope);
      if (!result) return res.status(404).json({ error: "Merge candidate not found" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid merge suggestion", details: error.flatten() });
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error merging pastoral persons:", error);
      res.status(500).json({ error: "Failed to merge pastoral persons" });
    }
  });

  app.get("/api/me/love-journey", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const detail = await getSelfLoveJourney(userId);
      if (!detail) return res.status(404).json({ error: "Love journey profile not found" });
      res.json({ schemaReady: true, ...detail });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error getting self love journey:", error);
      res.status(500).json({ error: "Failed to get love journey" });
    }
  });

  app.post("/api/me/love-journey/start", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const detail = await startSelfLoveJourney(userId);
      if (!detail) return res.status(404).json({ error: "Love journey profile not found" });
      res.status(201).json({ schemaReady: true, ...detail });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error starting self love journey:", error);
      res.status(500).json({ error: "Failed to start love journey" });
    }
  });

  app.patch("/api/me/love-journey/progress/:progressId", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const input = journeyProgressPatchSchema.pick({ status: true, responseText: true }).parse(req.body);
      const progress = await updateSelfJourneyProgress(userId, req.params.progressId, input);
      if (!progress) return res.status(404).json({ error: "Journey progress not found" });
      res.json(progress);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid journey progress", details: error.flatten() });
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error updating self love journey:", error);
      res.status(500).json({ error: "Failed to update love journey" });
    }
  });

  // ============ Reading Plans API Routes ============
  app.get("/api/reading-plans", async (req, res) => {
    try {
      const templates = await storage.getReadingPlanTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching reading plans:', error);
      res.status(500).json({ error: "Failed to get reading plans" });
    }
  });

  app.get("/api/reading-plans/:id", async (req, res) => {
    try {
      const template = await storage.getReadingPlanTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Reading plan not found" });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching reading plan:', error);
      res.status(500).json({ error: "Failed to get reading plan" });
    }
  });

  app.get("/api/reading-plans/:id/items", async (req, res) => {
    try {
      const items = await storage.getReadingPlanItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error('Error fetching reading plan items:', error);
      res.status(500).json({ error: "Failed to get reading plan items" });
    }
  });

  app.get("/api/user-reading-plans/today-summary", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);
      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }

      const plans = await storage.getUserReadingPlans(userId);
      const activePlans = plans.filter(p => p.isActive);

      if (activePlans.length === 0) {
        return res.json(null);
      }

      const plan = activePlans[0];
      const today = new Date();
      const startDate = new Date(plan.startDate);
      const diffTime = today.getTime() - startDate.getTime();
      const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const items = plan.templateId ? await storage.getReadingPlanItems(plan.templateId) : [];
      const todayItem = items.find(i => i.dayNumber === dayNumber);

      const progress = await storage.getUserReadingProgress(plan.id);
      const completedDays = progress.filter(p => p.isCompleted).length;
      const totalDays = plan.totalDays || items.length || 1;

      if (dayNumber > totalDays) {
        return res.json(null);
      }

      let previewVerses: Array<{ verse: number; text: string }> = [];
      let scriptureRef = todayItem?.scriptureReference || '';

      if (todayItem?.bookName && todayItem?.chapterStart) {
        try {
          const verses = await storage.getBibleVerses(todayItem.bookName, todayItem.chapterStart);
          const startVerse = todayItem.verseStart || 1;
          const filtered = verses.filter(v => v.verse >= startVerse);
          previewVerses = filtered.slice(0, 3).map(v => ({
            verse: v.verse,
            text: v.text,
          }));
        } catch (e) {
        }
      }

      if (!scriptureRef && todayItem?.bookName) {
        scriptureRef = todayItem.bookName;
        if (todayItem.chapterStart) {
          scriptureRef += ` ${todayItem.chapterStart}`;
          if (todayItem.chapterEnd && todayItem.chapterEnd !== todayItem.chapterStart) {
            scriptureRef += `-${todayItem.chapterEnd}`;
          }
        }
      }

      if (!todayItem && items.length === 0) {
        const todayProgress = progress.find(p => p.dayNumber === dayNumber);
        if (todayProgress?.scriptureReference) {
          scriptureRef = todayProgress.scriptureReference;
        }
      }

      res.json({
        planId: plan.id,
        planName: plan.name,
        dayNumber,
        totalDays,
        completedDays,
        isCompleted: false,
        scriptureReference: scriptureRef,
        previewVerses,
        todayCompleted: progress.some(p => p.dayNumber === dayNumber && p.isCompleted),
      });
    } catch (error) {
      console.error('Error fetching today reading summary:', error);
      res.status(500).json({ error: "Failed to get today's reading summary" });
    }
  });

  // ============ Personal Reading Plans API Routes ============
  app.get("/api/user-reading-plans", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);
      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const plans = await storage.getUserReadingPlans(userId);
      res.json(plans);
    } catch (error) {
      console.error('Error fetching user reading plans:', error);
      res.status(500).json({ error: "Failed to get user reading plans" });
    }
  });

  app.get("/api/user-reading-progress/today", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);
      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const progress = await storage.getUserTodayProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error('Error fetching today progress:', error);
      res.status(500).json({ error: "Failed to get today's progress" });
    }
  });

  app.get("/api/user-reading-plans/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getUserReadingPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Reading plan not found" });
      }
      const progress = await storage.getUserReadingProgress(plan.id);
      const completedDays = progress.filter(p => p.isCompleted).length;
      const totalDays = plan.totalDays || progress.length;
      res.json({ ...plan, progress: { completedDays, totalDays, entries: progress } });
    } catch (error) {
      console.error('Error fetching user reading plan:', error);
      res.status(500).json({ error: "Failed to get reading plan" });
    }
  });

  app.post("/api/user-reading-plans", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const claims = (req.user as any).claims || {};
      const authUserId = claims.sub;
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const fullUser = await authStorage.getUser(authUserId);
      let userId = fullUser?.legacyUserId;
      if (!userId && fullUser?.email) {
        const legacyUser = await storage.getUserByEmail(fullUser.email);
        if (legacyUser) userId = legacyUser.id;
      }
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }

      const { name, description, startDate, bookSelections, chaptersPerDay, reminderEnabled, reminderMorning, reminderNoon, reminderEvening, templateId } = req.body;
      if (!name || !startDate) {
        return res.status(400).json({ error: "Missing required fields: name, startDate" });
      }

      let finalTemplateId = templateId;
      let totalDays = 0;
      let templateItems: Array<{ templateId: string; dayNumber: number; bookName: string; chapterStart: number; chapterEnd: number; scriptureReference: string }> = [];

      if (templateId) {
        const template = await storage.getReadingPlanTemplate(templateId);
        if (!template) {
          return res.status(404).json({ error: "Reading plan template not found" });
        }
        const existingItems = await storage.getReadingPlanItems(templateId);
        templateItems = existingItems.map(item => ({
          templateId: item.templateId,
          dayNumber: item.dayNumber,
          bookName: item.bookName || '',
          chapterStart: item.chapterStart || 1,
          chapterEnd: item.chapterEnd || 1,
          scriptureReference: item.scriptureReference,
        }));
        totalDays = template.durationDays;
      } else {
        if (!bookSelections || !chaptersPerDay) {
          return res.status(400).json({ error: "Missing required fields for custom plan: bookSelections, chaptersPerDay" });
        }

        const chapters: Array<{ bookName: string; chapter: number }> = [];
        for (const sel of bookSelections) {
          const start = sel.chapterStart || 1;
          const end = sel.chapterEnd || start;
          for (let ch = start; ch <= end; ch++) {
            chapters.push({ bookName: sel.bookName, chapter: ch });
          }
        }

        totalDays = Math.ceil(chapters.length / chaptersPerDay);

        const template = await storage.createReadingPlanTemplate({
          name: `${name} - Personal`,
          description: description || null,
          category: "personal",
          durationDays: totalDays,
          isPublic: false,
          createdBy: userId,
        });
        finalTemplateId = template.id;

        for (let day = 0; day < totalDays; day++) {
          const dayChapters = chapters.slice(day * chaptersPerDay, (day + 1) * chaptersPerDay);
          if (dayChapters.length === 0) continue;
          const firstChapter = dayChapters[0];
          const lastChapter = dayChapters[dayChapters.length - 1];
          let scriptureRef: string;
          if (firstChapter.bookName === lastChapter.bookName) {
            if (firstChapter.chapter === lastChapter.chapter) {
              scriptureRef = `${firstChapter.bookName} ${firstChapter.chapter}`;
            } else {
              scriptureRef = `${firstChapter.bookName} ${firstChapter.chapter}-${lastChapter.chapter}`;
            }
          } else {
            scriptureRef = `${firstChapter.bookName} ${firstChapter.chapter} - ${lastChapter.bookName} ${lastChapter.chapter}`;
          }
          templateItems.push({
            templateId: template.id,
            dayNumber: day + 1,
            bookName: firstChapter.bookName,
            chapterStart: firstChapter.chapter,
            chapterEnd: lastChapter.chapter,
            scriptureReference: scriptureRef,
          });
        }

        await storage.createReadingPlanTemplateItems(templateItems);
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + totalDays - 1);

      const plan = await storage.createUserReadingPlan({
        userId,
        templateId: finalTemplateId,
        name,
        description: description || null,
        startDate,
        endDate: endDate.toISOString().split('T')[0],
        isActive: true,
        totalDays,
        reminderEnabled: reminderEnabled ?? true,
        reminderMorning: reminderMorning ?? "07:00",
        reminderNoon: reminderNoon ?? "12:00",
        reminderEvening: reminderEvening ?? "20:00",
      });

      const progressEntries = templateItems.map((item, idx) => {
        const readingDate = new Date(startDate);
        readingDate.setDate(readingDate.getDate() + idx);
        return {
          userId,
          planId: plan.id,
          dayNumber: item.dayNumber,
          readingDate: readingDate.toISOString().split('T')[0],
          scriptureReference: item.scriptureReference,
          isCompleted: false,
        };
      });

      for (const entry of progressEntries) {
        await storage.createReadingProgress(entry);
      }

      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating user reading plan:', error);
      res.status(500).json({ error: "Failed to create reading plan" });
    }
  });

  app.patch("/api/user-reading-plans/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { name, description, isActive, reminderEnabled, reminderMorning, reminderNoon, reminderEvening } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.isActive = isActive;
      if (reminderEnabled !== undefined) updates.reminderEnabled = reminderEnabled;
      if (reminderMorning !== undefined) updates.reminderMorning = reminderMorning;
      if (reminderNoon !== undefined) updates.reminderNoon = reminderNoon;
      if (reminderEvening !== undefined) updates.reminderEvening = reminderEvening;

      const plan = await storage.updateUserReadingPlan(req.params.id, updates);
      if (!plan) {
        return res.status(404).json({ error: "Reading plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error('Error updating user reading plan:', error);
      res.status(500).json({ error: "Failed to update reading plan" });
    }
  });

  app.delete("/api/user-reading-plans/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.deleteUserReadingPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user reading plan:', error);
      res.status(500).json({ error: "Failed to delete reading plan" });
    }
  });

  // ============ Reading Progress API Routes ============
  app.get("/api/user-reading-plans/:id/progress", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const progress = await storage.getUserReadingProgress(req.params.id);
      res.json(progress);
    } catch (error) {
      console.error('Error fetching reading progress:', error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });

  app.get("/api/user-reading-plans/:id/today", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getUserReadingPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Reading plan not found" });
      }
      const today = new Date();
      const startDate = new Date(plan.startDate);
      const diffTime = today.getTime() - startDate.getTime();
      const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const progress = await storage.getUserReadingProgress(plan.id);
      const todayProgress = progress.find(p => p.dayNumber === dayNumber);

      const items = await storage.getReadingPlanItems(plan.templateId || '');
      const todayItem = items.find(i => i.dayNumber === dayNumber);

      res.json({
        dayNumber,
        totalDays: plan.totalDays || progress.length,
        progress: todayProgress || null,
        planItem: todayItem || null,
      });
    } catch (error) {
      console.error('Error fetching today reading:', error);
      res.status(500).json({ error: "Failed to get today's reading" });
    }
  });

  app.post("/api/user-reading-plans/:id/progress/:dayNumber/complete", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const dayNumber = parseInt(req.params.dayNumber);
      const progress = await storage.getUserReadingProgress(req.params.id);
      const dayProgress = progress.find(p => p.dayNumber === dayNumber);
      if (!dayProgress) {
        return res.status(404).json({ error: "Progress entry not found for this day" });
      }
      const updated = await storage.markReadingComplete(dayProgress.id);
      res.json(updated);
    } catch (error) {
      console.error('Error marking reading complete:', error);
      res.status(500).json({ error: "Failed to mark reading as complete" });
    }
  });

  // ============ Devotional Notes API Routes ============
  app.get("/api/devotional-notes", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const notes = await storage.getDevotionalNotes(userId);
      res.json(notes);
    } catch (error) {
      console.error('Error fetching devotional notes:', error);
      res.status(500).json({ error: "Failed to get devotional notes" });
    }
  });

  app.get("/api/devotional-notes/by-reference", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: "Missing ref query parameter" });
      }
      const note = await storage.getDevotionalNoteByVerseReference(userId, ref);
      res.json(note || null);
    } catch (error) {
      console.error('Error fetching devotional note by verse reference:', error);
      res.status(500).json({ error: "Failed to get devotional note by verse reference" });
    }
  });

  app.get("/api/devotional-notes/:id", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const note = await storage.getDevotionalNoteForUser(req.params.id, userId);
      if (!note) {
        return res.status(404).json({ error: "Devotional note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error('Error fetching devotional note:', error);
      res.status(500).json({ error: "Failed to get devotional note" });
    }
  });

  app.get("/api/user-reading-plans/:planId/devotional/:dayNumber", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const dayNumber = parseInt(req.params.dayNumber);
      if (!Number.isFinite(dayNumber)) {
        return res.status(400).json({ error: "Invalid day number" });
      }
      const note = await storage.getDevotionalNoteByPlanDayForUser(userId, req.params.planId, dayNumber);
      res.json(note || null);
    } catch (error) {
      console.error('Error fetching devotional note by plan day:', error);
      res.status(500).json({ error: "Failed to get devotional note" });
    }
  });

  app.post("/api/devotional-notes", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const parsed = insertDevotionalNoteSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid devotional note data", details: parsed.error.errors });
      }
      const note = await storage.createDevotionalNote(parsed.data);
      res.status(201).json(note);
    } catch (error) {
      console.error('Error creating devotional note:', error);
      res.status(500).json({ error: "Failed to create devotional note" });
    }
  });

  app.patch("/api/devotional-notes/:id", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const parsed = parseDevotionalNotePatch(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid devotional note data", details: parsed.error.flatten() });
      }
      const note = await storage.updateDevotionalNoteForUser(req.params.id, userId, parsed.data);
      if (!note) {
        return res.status(404).json({ error: "Devotional note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error('Error updating devotional note:', error);
      res.status(500).json({ error: "Failed to update devotional note" });
    }
  });

  app.patch("/api/devotional-notes/:id/hidden", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { hidden } = req.body;
      if (typeof hidden !== 'boolean') {
        return res.status(400).json({ error: "hidden must be a boolean" });
      }
      const note = await storage.toggleDevotionalNoteHiddenForUser(req.params.id, userId, hidden);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error('Error toggling devotional note hidden:', error);
      res.status(500).json({ error: "Failed to toggle note visibility" });
    }
  });

  app.patch("/api/notebook/:id/hidden", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { hidden } = req.body;
      if (typeof hidden !== 'boolean') {
        return res.status(400).json({ error: "hidden must be a boolean" });
      }
      const entry = await storage.toggleStudyResponseHidden(req.params.id, hidden);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error('Error toggling study response hidden:', error);
      res.status(500).json({ error: "Failed to toggle entry visibility" });
    }
  });

  // ============ Devotional Notes AI Analysis ============
  app.post("/api/devotional-notes/analyze", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const { noteId } = req.body;
      if (!noteId) {
        return res.status(400).json({ error: "Missing noteId" });
      }
      const note = await storage.getDevotionalNote(noteId);
      if (!note) {
        return res.status(404).json({ error: "Devotional note not found" });
      }
      if (note.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to analyze this note" });
      }

      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        return res.status(503).json({ error: "AI 功能尚未設定，請聯絡管理員" });
      }

      const userContent = formatSingleNoteInput(note);
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const resultObj = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `System: ${SINGLE_NOTE_SYSTEM_PROMPT}\n\nUser: 請整理以下靈修筆記：\n\n${userContent}` }]
        }],
        generationConfig: { maxOutputTokens: 4000 }
      });

      const result = resultObj.response.text();
      if (!result) {
        return res.status(500).json({ error: "AI response empty" });
      }
      res.json({ analysis: result, noteId });
    } catch (error) {
      console.error('Error analyzing devotional note:', error);
      res.status(500).json({ error: "Failed to analyze devotional note" });
    }
  });

  app.post("/api/devotional-notes/analyze-batch", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const { noteIds, dateFrom, dateTo } = req.body;

      let notes: DevotionalNote[] = [];

      if (noteIds && Array.isArray(noteIds) && noteIds.length > 0) {
        const allNotes = await storage.getDevotionalNotes(userId);
        notes = allNotes.filter(n => noteIds.includes(n.id));
      } else {
        const allNotes = await storage.getDevotionalNotes(userId);
        if (dateFrom || dateTo) {
          notes = allNotes.filter(n => {
            const noteDate = new Date(n.createdAt);
            if (dateFrom && noteDate < new Date(dateFrom)) return false;
            if (dateTo) {
              const endDate = new Date(dateTo);
              endDate.setHours(23, 59, 59, 999);
              if (noteDate > endDate) return false;
            }
            return true;
          });
        } else {
          notes = allNotes;
        }
      }

      if (notes.length === 0) {
        return res.status(400).json({ error: "No devotional notes found for the given criteria" });
      }
      if (notes.length === 1) {
        const userContent = formatSingleNoteInput(notes[0]);
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const resultObj = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: `System: ${SINGLE_NOTE_SYSTEM_PROMPT}\n\nUser: 請整理以下靈修筆記：\n\n${userContent}` }]
          }],
          generationConfig: { maxOutputTokens: 4000 }
        });

        const result = resultObj.response.text();
        return res.json({ analysis: result || '', noteCount: 1 });
      }

      const userContent = formatMultiNoteInput(notes);
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const resultObj = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `System: ${MULTI_NOTE_SYSTEM_PROMPT}\n\nUser: 請整合分析以下 ${notes.length} 篇靈修筆記：\n\n${userContent}` }]
        }],
        generationConfig: { maxOutputTokens: 8000 }
      });

      const result = resultObj.response.text();
      if (!result) {
        return res.status(500).json({ error: "AI response empty" });
      }
      res.json({ analysis: result, noteCount: notes.length });
    } catch (error) {
      console.error('Error batch analyzing devotional notes:', error);
      res.status(500).json({ error: "Failed to batch analyze devotional notes" });
    }
  });

  // Group Bible study note integration (small group or large group)
  app.post("/api/devotional-notes/analyze-group", isAuthenticated, async (req, res) => {
    try {
      const { mode, verseRange, members } = req.body;

      if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: "No member notes provided" });
      }
      for (const m of members) {
        if (typeof m.name !== 'string' || typeof m.content !== 'string') {
          return res.status(400).json({ error: "Each member must have name and content fields" });
        }
      }

      const systemPrompt = mode === 'large' ? GROUP_LARGE_SYSTEM_PROMPT : GROUP_SMALL_SYSTEM_PROMPT;
      const userContent = formatGroupNotesInput(members, verseRange);
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const resultObj = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `System: ${systemPrompt}\n\nUser: ${userContent}` }]
        }],
        generationConfig: { maxOutputTokens: mode === 'large' ? 6000 : 4000 }
      });

      const result = resultObj.response.text();
      if (!result) {
        return res.status(500).json({ error: "AI response empty" });
      }
      res.json({ analysis: result, memberCount: members.length, mode: mode || 'small' });
    } catch (error) {
      console.error('[analyze-group] Error:', error);
      res.status(500).json({ error: "Failed to analyze group notes" });
    }
  });

  // ============ Saved Verses API Routes ============
  app.get("/api/saved-verses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const verses = await storage.getSavedVerses(user.id);
      res.json(verses);
    } catch (error) {
      console.error('Error fetching saved verses:', error);
      res.status(500).json({ error: "Failed to get saved verses" });
    }
  });

  app.get("/api/saved-verses/check", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { bookName, chapter, verse } = req.query;
      if (!bookName || !chapter || !verse) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      const saved = await storage.getSavedVerse(user.id, bookName as string, parseInt(chapter as string), parseInt(verse as string));
      res.json({ saved: !!saved, id: saved?.id });
    } catch (error) {
      console.error('Error checking saved verse:', error);
      res.status(500).json({ error: "Failed to check saved verse" });
    }
  });

  app.post("/api/saved-verses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const data = insertSavedVerseSchema.parse({ ...req.body, userId: user.id });
      const saved = await storage.createSavedVerse(data);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Error saving verse:', error);
      res.status(500).json({ error: "Failed to save verse" });
    }
  });

  app.delete("/api/saved-verses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.deleteSavedVerse(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting saved verse:', error);
      res.status(500).json({ error: "Failed to delete saved verse" });
    }
  });
}
