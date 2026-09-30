import type { Express, RequestHandler } from "express";
import express from "express";
import { mergePersons, PersonMergeError } from './personMerge';
import { mayManageStudySession } from './studySessionPolicy';
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadRoot, messageCardRoot } from './uploadPaths';
import { rasterExtension, rasterOnly, setMediaHeaders } from './uploadSafety';
import { apiIdentity, boundedWindowLimiter, clientAddress } from './requestLimits';
import { bulkEmailInput, emailPreferencesInput, emailStaffRoles, profileNotificationInput } from '@shared/email';
import { emailAppUrl, emailProviderStatus, escapeEmailHtml } from './emailPolicy';
import { randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { careActions, careContacts, insertSessionSchema, insertParticipantSchema, insertSubmissionSchema, insertStudyResponseSchema, insertSavedVerseSchema, insertGroupingActivitySchema, insertGroupingParticipantSchema, insertDevotionalNoteSchema, prayerMeetings, prayerMeetingParticipants, userEmailPreferences } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { readingPlanBodySchema } from './readingPlanInput';
import { createReadingPlan, ReadingPlanError } from './readingPlanTransaction';
import { soulGymAccess, visibleSubmissions, browserIdentity } from './soulGymAccess';
import { pool, getPoolStats } from "./db";
import type { AppRole, DevotionalNote } from '@shared/schema';
import { bibleCache, timelineCache, apiCache, sessionCache, prayerCache, cacheKeys } from "./cache";
import { bibleStudyRoutes, bibleStudyCreditsRoutes } from './bibleStudy/routes';
import { getKnownChurchOptions, normalizeChurch, UNASSIGNED_CHURCH_ID, getChurchAliases } from "./churches";
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
  reconcilePastoralPersons,
  startLoveJourneyForPerson,
  startSelfLoveJourney,
  changeSelfJourneyStatus,
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
  prayerPatchSchema,
} from "./securityPolicies";
import compression from "compression";
import {
  getPlatformSummary,
  recordAppEvent,
  recordErrorEvent,
  requestContext,
} from "./observability";
import { readingPlanAccess, retiredOperations } from './readingPlanAccess';
import { personalPrayerRoutes } from './personalPrayerRoutes';
import { prayerSharingRoutes } from './prayerSharingRoutes';
import { prayerInteractionRoutes } from './prayerInteractionRoutes';
import { accessControlRoutes, changeAccountRole, hasPermission, myAccess, memberRoleNames } from './accessControl';
import type { Permission } from '../shared/accessControl';
import { GroupError } from './groupError';
import { devotionWallRoutes } from './devotionWallRoutes';
import { publicPrayerFeed, publicPrayerReceipt } from './prayerSharingRepository';
import { lifeGroupRoutes } from './lifeGroupRoutes';
import { supportRoutes } from './supportRoutes';
import { careVisitRoutes } from './careVisitRoutes';
import { careActionInput } from '../shared/care';
import { mentoringRoutes } from './mentoringRoutes';
import { assignCrmGroupMember } from './crmGroupMembership';
import { churchDevotionRoutes } from './churchDevotionRoutes';
import { getManagedChurchDevotion } from './churchDevotionRepository';
import { managedDevotionBrief } from './churchDevotionPublic';
import { withDevotionScripture } from './devotionScripture';
import { devotionDate, taipeiToday } from '../shared/churchDevotion';
import { releaseFlags } from "@shared/releaseFlags";

const gameCreationLocks = new Map<string, Promise<any>>();
const careContactBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional().nullable(),
  need: z.string().trim().max(500).optional(),
  nextAction: z.string().trim().max(300).optional(),
  prayer: z.string().trim().max(500).optional(),
  nextCareDate: devotionDate.nullable().optional(),
  source: z.string().trim().max(60).optional(),
  visibility: z.enum(["private", "pastoral", "team"]).optional(),
});
const careContactPatchSchema = careContactBodySchema.partial().extend({
  isArchived: z.boolean().optional(),
});
const careActionBodySchema = careActionInput;
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
  preview: z.boolean().optional(),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
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
  const redirectPath = typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\s]/.test(value) && !/^\/api(?:\/|$)/.test(value)
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
  if (profile.aud !== input.channelId) throw new Error("LINE id_token audience mismatch");
  if (input.expectedNonce && profile.nonce !== input.expectedNonce) {
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

// Configure multer for file uploads
const uploadMessageCard = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 },
});


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

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', boundedWindowLimiter({ max: Number(process.env.API_INGRESS_RATE_LIMIT_MAX || 12000), key: clientAddress }));
  app.use('/api/telemetry', boundedWindowLimiter({ max: 120, key: clientAddress }));
  // Retired meeting APIs contain legacy anonymous identity links. Keep records private.
  app.use('/api/prayer-meetings', (_req, res) => res.status(410).json({ error: '此舊版禱告會功能已停用，請使用禱告牆。' }));

  app.use('/uploads/.bible-study', (_req, res) => res.sendStatus(404));
  app.use('/uploads', rasterOnly, express.static(uploadRoot, { dotfiles: 'ignore' }), (_req, res) => res.sendStatus(404));
  app.use('/message-cards', rasterOnly);

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

  const requireRole = (...roles: AppRole[]): RequestHandler<Record<string, string>> => async (req, res, next) => {
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

  const requireSelfOrRole = (paramName: string, ...roles: AppRole[]): RequestHandler<Record<string, string>> => async (req, res, next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const role = await storage.getUserRole(userId);
      (req as any).legacyUserId = userId;
      (req as any).userRole = role;
      if (req.params[paramName] === userId) return next();
      if ((role && roles.includes(role as AppRole)) || (req.method === 'PATCH' && await hasPermission(userId, 'members.manage'))) {
        const capability = req.method === 'GET' ? 'personal' : 'members';
        const access = await getCrmAccessForRequest(req, capability);
        const target = await storage.getUser(req.params[paramName]);
        const permitted = capability === 'personal' ? access?.canViewPersonal : access?.canManageMembers;
        if (target && access?.canEnterCrm && permitted && filterUsersForCrmAccess([target], access).length) return next();
      }
      return res.status(403).json({ error: "Forbidden" });
    } catch (error) {
      console.error("[auth] Failed to check ownership:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };

  const crmLeaderRoles: AppRole[] = ["admin", "senior_pastor", "pastor", "minister", "group_leader", "leader", "future_leader"];
  const sessionManagerRoleGuard = requireRole(...crmLeaderRoles);
  const requireSessionManager: RequestHandler<Record<string, string>> = (req, res, next) => sessionManagerRoleGuard(req, res, async error => {
    if (error) return next(error);
    try {
      // Creation has no session yet; batch assignment validates every target before writing.
      if (req.method === 'POST' && ['/api/sessions', '/api/participants/batch-assign-groups'].includes(req.path)) return next();
      if (!await canManageSession(req)) return res.status(403).json({ error: 'Session management access denied' });
      next();
    } catch (failure) { next(failure); }
  });
  const requireLeader = requireRole(...crmLeaderRoles);
  const requireCrmDirector = requireRole("admin", "senior_pastor");
  const requireAdmin = requireRole("admin");
  const requireDelegated = (permission: Permission, legacy: readonly string[]): RequestHandler => async (req,res,next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return void res.status(401).json({error:'請先登入。'});
      const role = await storage.getUserRole(userId);
      if (!legacy.includes(role || '') && !await hasPermission(userId,permission)) return void res.status(403).json({error:'沒有這項權限。'});
      (req as any).legacyUserId=userId; (req as any).userRole=role; next();
    } catch { res.status(503).json({error:'無法確認權限。'}); }
  };
  const requireCrmMemberAccess: RequestHandler<Record<string,string>> = async(req,res,next)=>{
    try {
      const id=await resolveUserId(req); if(!id)return void res.status(401).json({error:'請先登入。'});
      if(!(await myAccess(id)).canEnterCrm)return void res.status(403).json({error:'沒有會員管理權限。'});
      (req as any).legacyUserId=id; next();
    }catch{res.status(503).json({error:'無法確認權限。'});}
  };

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
  app.use("/api/mentoring", requireReleaseFeature(releaseFlags.pastoral));
  // Personal care has owner-scoped authentication on every route; it is not a pastoral beta feature.
  app.use(['/api/serving', '/api/facilities'], retiredOperations);
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

  const canManageSession = async (req: any, explicitSessionId?: string): Promise<boolean> => {
    const role = await getRequestRole(req);
    if (!role || !sessionManagerRoles.includes(role)) return false;
    let sessionId = explicitSessionId || req.params?.sessionId;
    if (!sessionId && req.params?.id) {
      if (req.path.includes('/participants/')) sessionId = (await storage.getParticipant(req.params.id))?.sessionId;
      else if (req.path.includes('/reports/')) sessionId = (await pool.query('SELECT session_id FROM ai_reports WHERE id=$1', [req.params.id])).rows[0]?.session_id;
      else if (req.path.includes('/sessions/')) sessionId = req.params.id;
    }
    // Query parameters are only a target on collection routes, never an override for a path resource.
    if (!sessionId && !req.params?.id) sessionId = req.query?.sessionId;
    if (!sessionId || !z.string().uuid().safeParse(sessionId).success) return false;
    const session = await storage.getSession(sessionId);
    const userId = await resolveUserId(req);
    if (!session || !userId) return false;
    const user = await storage.getUser(userId);
    if (role !== 'admin' && normalizeChurch(user?.church) !== normalizeChurch(session.churchUnit)) return false;
    return mayManageStudySession(role, user, session);
  };

  const getCrmChurchFilter = async (req: any): Promise<string | null> => {
    const selected = normalizeChurch(typeof req.query?.church === 'string' ? req.query.church : null);
    return selected && selected !== 'all' ? selected : null;
  };
  const getCrmAccessForRequest = async (req: any, capability?: import('./crmPermissions').CrmCapability) => {
    const userId = req.legacyUserId || await resolveUserId(req);
    if (!userId) return null;
    const role = await storage.getUserRole(userId);
    const access = await getCrmAccessContext(userId, role, capability);
    access.personalAccess = await getCrmAccessContext(userId, role, 'personal');
    return access;
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
    throw error;
  }

  const studyAccess = soulGymAccess({ pool, resolveUserId, canManageSession });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/webhooks/resend/inbound') return next();
    let crossSite = req.get('sec-fetch-site') === 'cross-site';
    const origin = req.get('origin');
    if (origin) {
      try { crossSite ||= new URL(origin).host !== req.get('host'); }
      catch { crossSite = true; }
    }
    if (crossSite) return res.status(403).json({ error: '不接受跨網站寫入。' });
    next();
  });
  const readLimit = boundedWindowLimiter({ max: Number(process.env.API_RATE_LIMIT_MAX || 600), key: apiIdentity });
  const writeLimit = boundedWindowLimiter({ max: Number(process.env.API_WRITE_RATE_LIMIT_MAX || 120), key: apiIdentity });
  app.use('/api', (req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? readLimit : writeLimit)(req, res, next));

  // Retire old clients without sending member content to model providers.
  app.all([
    '/api/admin/product-growth-brief',
    '/api/admin/sessions/:sessionId/reports',
    '/api/sessions/:sessionId/reports',
    '/api/sessions/:sessionId/reports/stream',
    '/api/sessions/:sessionId/reports/generate',
    '/api/reports/:id',
    '/api/prayer-meetings/:id/classify-prayers',
    '/api/devotional-notes/analyze',
    '/api/devotional-notes/analyze-batch',
    '/api/devotional-notes/analyze-group',
  ], retiredOperations);
  app.use('/api', studyAccess.router);

  // Health check endpoint - detailed with database
  app.use('/api/access-control', accessControlRoutes(resolveUserId));
  app.use('/api/admin/church-devotions', churchDevotionRoutes(requireDelegated('devotions.manage', ['admin','senior_pastor'])));
  app.use('/api/life-groups', lifeGroupRoutes(resolveUserId));
  app.use('/api/bible-study', bibleStudyRoutes());
  app.use('/open/api', (req, res) => res.redirect(308, `/api/bible-study${req.url.startsWith('/') ? req.url : '/'}`));
  app.use('/open', bibleStudyCreditsRoutes());
  app.use(['/library', '/data/core.sqlite', '/bible-study-data', '/api/info', '/api/reference', '/COBSGreek.ttf', '/cobsh.ttf'], (_req, res) => res.sendStatus(404));
  app.use('/api/support', supportRoutes(resolveUserId));
  app.use('/api/care-visits', careVisitRoutes(resolveUserId));
  app.use('/api/mentoring', mentoringRoutes(resolveUserId));

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
      res.setHeader('Cache-Control', 'no-store');
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to get platform summary" });
    }
  });

  app.get("/api/churches", requireCrmMemberAccess, async (req, res) => {
    try {
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const role = userId ? await storage.getUserRole(userId) : null;
      const currentUser = userId ? await storage.getUser(userId) : null;

      if (role !== "admin") {
        const church = normalizeChurch(currentUser?.church);
        return res.json(church ? knownChurches.filter(item => item.id === church) : knownChurches);
      }

      res.json(knownChurches);
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
      if (directorRole === 'senior_pastor' && !directorChurch) return res.json([]);
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
        if (!directorChurch) return res.status(403).json({ error: '請先指定教會管理範圍' });
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
      if (directorRole === 'senior_pastor') {
        const church = normalizeChurch((await storage.getUser(directorUserId!))?.church);
        if (!church || !(await pool.query(`SELECT a.id FROM crm_scope_assignments a WHERE a.id=$1 AND (
          a.church=ANY($2::text[]) OR a.group_id IN(SELECT id FROM small_groups WHERE church=ANY($2::text[]))
          OR a.member_user_id IN(SELECT id FROM users WHERE church=ANY($2::text[]))
          OR a.potential_member_id IN(SELECT id FROM potential_members WHERE church=ANY($2::text[])))`, [req.params.id, getChurchAliases(church)])).rowCount) return res.status(403).json({ error: 'Forbidden' });
      }
      await pool.query(
        `WITH previous AS (SELECT * FROM crm_scope_assignments WHERE id=$1 AND is_active FOR UPDATE),
         revoked AS (UPDATE crm_scope_assignments SET is_active=false,updated_at=now() WHERE id IN(SELECT id FROM previous) RETURNING id)
         INSERT INTO access_audit(church,actor_id,target_id,action,before_value,after_value)
         SELECT coalesce(p.church,(SELECT church FROM small_groups WHERE id=p.group_id),
           (SELECT church FROM users WHERE id=p.member_user_id),(SELECT church FROM potential_members WHERE id=p.potential_member_id),''),
           $2,p.id,'撤回舊有授權',to_jsonb(p),'{"active":false}'::jsonb
         FROM previous p JOIN revoked r ON r.id=p.id`,
        [req.params.id,directorUserId]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting CRM assignment:", error);
      res.status(500).json({ error: "Failed to delete CRM assignment" });
    }
  });

  app.get("/api/crm/groups", requireCrmMemberAccess, async (req, res) => {
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
      const access = await getCrmAccessForRequest(req, 'members');
      if (!access || !access.canManageMembers) return res.status(403).json({error:'Forbidden'});
      res.status(201).json(await assignCrmGroupMember(req.params.id, input, access));
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
      const member = res.locals.soulGymParticipant;
      const groupNumber = res.locals.soulGymManager
        ? (req.query.groupNumber ? parseInt(req.query.groupNumber as string) : undefined)
        : member?.groupNumber ?? undefined;
      const clientVersion = req.query.v as string | undefined;

      const cacheKey = `poll:${sessionId}:${phase}:${groupNumber || 'all'}:${res.locals.soulGymManager ? 'manager' : member.id}`;
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
        participants: participants?.map(sanitizeParticipant) ?? null,
        submissions: submissions ? visibleSubmissions(submissions, member, !!res.locals.soulGymManager) : null,
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
      const parsed = insertSessionSchema.omit({ shortCode: true }).strict().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid session data", details: parsed.error.issues });
      }
      const actorId = (req as any).legacyUserId as string;
      const actor = await storage.getUser(actorId);
      const church = normalizeChurch(parsed.data.churchUnit);
      const ownChurch = normalizeChurch(actor?.church);
      if ((req as any).userRole !== 'admin' && ((church && church !== ownChurch) || (parsed.data.ownerId && parsed.data.ownerId !== actorId))) {
        return res.status(403).json({ error: 'Session ownership and church must match the creator' });
      }
      const session = await storage.createSession({ ...parsed.data,
        ownerId: (req as any).userRole === 'admin' ? parsed.data.ownerId || actorId : actorId,
        churchUnit: (req as any).userRole === 'admin' ? church : ownChurch,
      });
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", requireSessionManager, async (req, res) => {
    try {
      const parsed = insertSessionSchema.omit({ shortCode: true }).partial().strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid session fields' });
      const existing = await storage.getSession(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if ((req as any).userRole !== 'admin' && (
        (parsed.data.ownerId !== undefined && parsed.data.ownerId !== existing.ownerId) ||
        (parsed.data.churchUnit !== undefined && normalizeChurch(parsed.data.churchUnit) !== normalizeChurch(existing.churchUnit))
      )) return res.status(403).json({ error: 'Only administrators may transfer session ownership or church' });
      const updates = { ...parsed.data };
      if (updates.churchUnit !== undefined) updates.churchUnit = normalizeChurch(updates.churchUnit);
      const session = await storage.updateSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      sessionCache.invalidate(`poll:${req.params.id}`);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", requireSessionManager, async (req, res) => {
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
      if (!await studyAccess.canOwn(req, participant)) return res.status(403).json({ error: '請使用原瀏覽器或已綁定的帳號；舊紀錄請由管理員確認身份後恢復' });
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
      if (!await studyAccess.canOwn(req, participant)) return res.status(403).json({ error: 'Participant identity required' });
      res.json(sanitizeParticipant(participant));
    } catch (error) {
      res.status(500).json({ error: "Failed to get participant" });
    }
  });

  app.post("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const parsed = insertParticipantSchema.safeParse({ ...req.body, sessionId: req.params.sessionId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid participant data", details: parsed.error.issues });
      }
      const existing = await storage.getParticipantBySessionEmail(req.params.sessionId, parsed.data.email);
      if (existing) {
        if (!await studyAccess.canOwn(req, existing)) return res.status(403).json({ error: '此參與紀錄需使用原瀏覽器或已綁定的帳號，請聯絡管理員恢復身份' });
        return res.status(200).json(existing);
      }
      const participant = await storage.createParticipant({ ...parsed.data, groupNumber: null, readyConfirmed: false }, await studyAccess.grant(req));
      sessionCache.invalidate(`poll:${req.params.sessionId}`);
      res.status(201).json(participant);
    } catch (error) {
      console.error("[create-participant] Error:", error);
      if ((error as { status?: number }).status === 409) return res.status(409).json({ error: (error as Error).message });
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  app.patch("/api/participants/:id", async (req, res) => {
    try {
      const existing = await storage.getParticipant(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Participant not found" });
      }

      let updateData: Record<string, unknown> = {};
      if (!(await canManageSession(req))) {
        if (!await studyAccess.canOwn(req, existing)) return res.status(403).json({ error: 'Participant identity required' });
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
        if (parsed.data.groupNumber !== undefined && parsed.data.groupNumber !== existing.groupNumber) {
          return res.status(403).json({ error: '變更小組請由主持人分組，以保護各組分享內容' });
        }
        if (parsed.data.readyConfirmed !== undefined) updateData.readyConfirmed = parsed.data.readyConfirmed;
      } else {
        const managed = z.object({ name: z.string().trim().min(1).max(100).optional(), email: z.string().email().optional(),
          gender: z.enum(['male', 'female']).optional(), location: z.string().trim().min(1).max(100).optional(),
          groupNumber: z.number().int().positive().nullable().optional(), readyConfirmed: z.boolean().optional() }).safeParse(req.body);
        if (!managed.success) return res.status(400).json({ error: 'Invalid participant update' });
        updateData = managed.data;
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

      if (!await studyAccess.canOwn(req, participant)) return res.status(403).json({ error: 'Participant identity required' });

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

      const allIds = [...new Set(assignments.flatMap(assignment => assignment.participantIds))];
      if (!allIds.length || allIds.length > 1000) return res.status(400).json({ error: 'Invalid assignment count' });
      const targets = await pool.query('SELECT id,session_id FROM participants WHERE id=ANY($1::uuid[])', [allIds]);
      if (targets.rows.length !== allIds.length) return res.status(404).json({ error: 'Participant not found' });
      for (const sessionId of new Set<string>(targets.rows.map(row => row.session_id))) {
        if (!await canManageSession(req, sessionId)) return res.status(403).json({ error: 'Session management access denied' });
      }

      const updates = assignments.flatMap(assignment => assignment.participantIds.map(id => ({ id, group_number: assignment.groupNumber })));
      if (updates.length !== allIds.length) return res.status(400).json({ error: '同一位成員不可重複分組' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM sessions WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[...new Set(targets.rows.map(row => row.session_id))]]);
        const result = await client.query(`UPDATE participants p SET group_number=a.group_number,ready_confirmed=false,updated_at=NOW()
          FROM jsonb_to_recordset($1::jsonb) AS a(id uuid,group_number integer) WHERE p.id=a.id RETURNING p.id`, [JSON.stringify(updates)]);
        if (result.rowCount !== allIds.length) throw new Error('Group assignment changed during update');
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }

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
      res.json(visibleSubmissions(submissions, res.locals.soulGymParticipant, !!res.locals.soulGymManager));
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
        return res.status(400).json({ error: "Invalid submission data", details: parsed.error.issues });
      }
      const submissionInput = parsed.data;
      const owner = await storage.getParticipant(submissionInput.participantId);
      if (!owner || owner.sessionId !== req.params.sessionId || !await studyAccess.canOwn(req, owner)) return res.status(403).json({ error: 'Participant identity required' });
      if (!owner.groupNumber) return res.status(409).json({ error: '尚未分組' });
      // Ensure all fields are present or default to empty string to satisfy DB schema
      const submissionData = {
        sessionId: submissionInput.sessionId,
        participantId: submissionInput.participantId,
        groupNumber: owner.groupNumber,
        name: owner.name,
        email: owner.email,
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

  app.get("/api/notebook", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const email = user.email || user.claims?.email;
      if (!email) return res.status(401).json({ error: "User email not found" });
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const entries = await storage.getNotebookEntries(userId, browserIdentity(req));
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
      const email = user.email || user.claims?.email;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const notebookSessions = await storage.getNotebookSessions(userId, browserIdentity(req));
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
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const sessions = await storage.getNotebookSessionsWithData(userId, browserIdentity(req));
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
      const member = await studyAccess.owned(req, sessionId);
      const manager = await canManageSession(req);
      if (!manager && (!member || member.groupNumber !== groupNumber)) return res.status(403).json({ error: 'Group access denied' });
      const responses = await storage.getGroupStudyResponses(sessionId, groupNumber);
      res.json({ responses: manager ? responses : responses.map(({ participant_email: _email, ...response }) => response) });
    } catch (error) {
      console.error("[group-responses] Error:", error);
      res.status(500).json({ error: "Failed to get group responses" });
    }
  });

  app.get("/api/study-responses/:sessionId/:participantId", async (req, res) => {
    try {
      if (!await studyAccess.owned(req, req.params.sessionId, req.params.participantId)) return res.status(403).json({ error: 'Participant identity required' });
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
      if (bodyUserId && participantId && bodyUserId !== participantId) return res.status(400).json({ error: 'Conflicting participant identity' });
      if (!sessionId || !resolvedUserId) {
        return res.status(400).json({ error: "sessionId and userId/participantId are required" });
      }
      if (!await studyAccess.owned(req, sessionId, resolvedUserId)) return res.status(403).json({ error: 'Participant identity required' });

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
        await studyAccess.owned(req, existing.sessionId, existing.userId);
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
      const response = await storage.getStudyResponseWithOwner(req.params.id);
      if (!response) return res.status(404).json({ error: 'Response not found' });
      if (!await canManageSession(req, response.sessionId)) return res.status(403).json({ error: 'Session management access denied' });
      await storage.deleteStudyResponse(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting study response:", error);
      res.status(500).json({ error: "Failed to delete study response" });
    }
  });

  app.use('/api/personal-prayers', personalPrayerRoutes(resolveUserId));
  app.use('/api/prayer-sharing', prayerSharingRoutes(resolveUserId));
  app.use('/api/devotion-wall', devotionWallRoutes(resolveUserId));
  app.use('/api/prayers', prayerInteractionRoutes(resolveUserId, id => storage.getUserRole(id)));

  app.get("/api/prayers", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(await publicPrayerFeed(userId, req.query.view === 'my'));
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
      res.status(201).json((await publicPrayerFeed(userId, true)).find(p => p.id === prayer.id));
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
      const canManage = userId === existingPrayer.userId || !!role && crmLeaderRoles.includes(role as AppRole) || await hasPermission(userId, 'wall.moderate', 'site');
      if (!canManage) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = prayerPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prayer update", details: parsed.error.flatten() });
      }
      const updateData: Record<string, any> = {};
      if (parsed.data.isPinned !== undefined) updateData.isPinned = parsed.data.isPinned;
      if (parsed.data.isUrgent !== undefined) updateData.isUrgent = parsed.data.isUrgent;
      if (parsed.data.isClosed !== undefined) {
        updateData.closedAt = parsed.data.isClosed ? new Date() : null;
        if (!parsed.data.isClosed) { updateData.isAnswered = false; updateData.answeredAt = null; }
      }
      if (parsed.data.isAnswered !== undefined) {
        updateData.isAnswered = parsed.data.isAnswered;
        updateData.answeredAt = parsed.data.isAnswered ? new Date() : null;
        updateData.closedAt = parsed.data.isAnswered ? new Date() : null;
      }

      const prayer = await storage.updatePrayer(req.params.id, updateData);
      if (!prayer) {
        return res.status(404).json({ error: "Prayer not found" });
      }
      prayerCache.invalidatePattern('prayers:');
      res.json(publicPrayerReceipt(prayer));
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
      const canManage = userId === existingPrayer.userId || !!role && crmLeaderRoles.includes(role as AppRole) || await hasPermission(userId, 'wall.moderate', 'site');
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

  app.get("/api/care/contacts", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const contacts = await db
        .select()
        .from(careContacts)
        .where(and(eq(careContacts.userId, userId), req.query.includeArchived === '1' ? undefined : eq(careContacts.isArchived, false)))
        .orderBy(desc(careContacts.createdAt));

      if (contacts.length === 0) {
        return res.json([]);
      }

      const actions = await db
        .select({ contactId: careActions.contactId,
          prayerCount: sql<number>`count(*) filter (where ${careActions.actionType} = 'prayer')::int`,
          lastActionAt: sql<string>`max(${careActions.createdAt})`,
        })
        .from(careActions)
        .where(eq(careActions.userId, userId))
        .groupBy(careActions.contactId);
      const counts = new Map(actions.map(action => [action.contactId, action]));

      res.json(contacts.map((contact) => ({
        ...contact,
        prayerCount: counts.get(contact.id)?.prayerCount || 0,
        lastActionAt: counts.get(contact.id)?.lastActionAt || null,
      })));
    } catch (error) {
      console.error("[care-contacts] Request failed");
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
        need: input.need || "",
        nextAction: input.nextAction || "",
        prayer: input.prayer || "",
        nextCareDate: input.nextCareDate || null,
        source: input.source || "personal",
        visibility: input.visibility || "private",
        isArchived: false,
      }).returning();
      res.status(201).json({ ...contact, prayerCount: 0, lastActionAt: null });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid care contact", details: error.flatten() });
      }
      console.error("[create-care-contact] Request failed");
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
      if (input.nextCareDate !== undefined) updateData.nextCareDate = input.nextCareDate;
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
      console.error("[update-care-contact] Request failed");
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
      console.error("[archive-care-contact] Request failed");
      res.status(500).json({ error: "Failed to archive care contact" });
    }
  });

  app.get("/api/care/contacts/:id/actions", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const id = z.string().uuid().parse(req.params.id);
      const offset = z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
      const [contact] = await db.select({ id: careContacts.id }).from(careContacts)
        .where(and(eq(careContacts.id, id), eq(careContacts.userId, userId))).limit(1);
      if (!contact) return res.status(404).json({ error: 'Care contact not found' });
      const actions = await db.select().from(careActions)
        .where(and(eq(careActions.contactId, id), eq(careActions.userId, userId)))
        .orderBy(desc(careActions.createdAt), desc(careActions.id)).limit(31).offset(offset);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ actions: actions.slice(0, 30), hasMore: actions.length > 30 });
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ error: 'Unable to load care history' });
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
      const action = await db.transaction(async (tx) => {
        const createdAt = new Date();
        // Lock the owner row so retries cannot create duplicate actions or reschedule twice.
        const [current] = await tx.select().from(careContacts).where(and(eq(careContacts.id, contact.id), eq(careContacts.isArchived, false))).for('update');
        if (!current) throw new Error('Care action conflict');
        if (input.id) {
          const [existing] = await tx.select().from(careActions).where(eq(careActions.id, input.id));
          if (existing) {
            if (existing.userId !== userId || existing.contactId !== contact.id || existing.actionType !== input.actionType || (existing.note || '') !== (input.note || '')) throw new Error('Care action conflict');
            return existing;
          }
        }
        const [saved] = await tx.insert(careActions).values({
          ...(input.id ? { id: input.id } : {}), contactId: contact.id, userId, actionType: input.actionType, note: input.note || null, createdAt,
        }).returning();
        if (careActionTypesThatUpdateLastCared.has(input.actionType) || input.nextCareDate !== undefined || input.nextAction !== undefined) {
          await tx.update(careContacts)
            .set({ updatedAt: createdAt,
              ...(careActionTypesThatUpdateLastCared.has(input.actionType) ? { lastCaredAt: createdAt } : {}),
              ...(input.nextCareDate !== undefined ? { nextCareDate: input.nextCareDate } : {}),
              ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
            })
            .where(and(eq(careContacts.id, contact.id), eq(careContacts.userId, userId)));
        }
        return saved;
      });

      res.status(201).json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid care action", details: error.flatten() });
      }
      if (error instanceof Error && error.message === 'Care action conflict') return res.status(409).json({ error: '紀錄已送出，請重新載入。' });
      console.error("[create-care-action] Request failed");
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

  app.get("/api/potential-members", requireCrmMemberAccess, async (req, res) => {
    try {
      const churchScope = await getCrmChurchFilter(req);
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
      const parsed = z.object({ email: z.string().trim().email().max(254), name: z.string().trim().min(1).max(160),
        gender: z.string().trim().max(30).optional(), church: z.string().trim().max(120).nullable().optional(),
      }).strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid intake fields' });
      await storage.upsertPotentialMember(parsed.data);
      // Identical receipt whether the address is new or already known.
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create potential member" });
    }
  });

  const gameCreateInput = z.object({
    mode: z.enum(['standalone', 'session', 'free']).default('standalone'),
    currentLevel: z.enum(['L1', 'L2', 'L3']).default('L1'),
    bibleStudySessionId: z.string().uuid().nullable().optional(),
    groupNumber: z.coerce.number().int().positive().max(1000).nullable().optional(),
    drawerOrder: z.array(z.string().uuid()).max(100).optional(),
    currentDrawerId: z.string().uuid().nullable().optional(),
    sharedMemberIds: z.array(z.string().uuid()).max(100).optional(),
    sharingMode: z.boolean().optional(),
  }).strict();
  const gamePatchInput = z.object({
    currentLevel: z.enum(['L1', 'L2', 'L3']).optional(),
    passCount: z.number().int().min(0).max(2).optional(),
    timerDuration: z.number().int().min(1).max(3600).optional(),
    timerStartedAt: z.string().datetime().transform(value => new Date(value)).nullable().optional(),
    timerRunning: z.boolean().optional(),
    sharingMode: z.boolean().optional(),
    sharedMemberIds: z.array(z.string().uuid()).max(100).optional(),
    currentDrawerId: z.string().uuid().nullable().optional(),
    currentDrawerCardId: z.string().max(100).nullable().optional(),
    drawerOrder: z.array(z.string().uuid()).max(100).optional(),
    status: z.enum(['waiting', 'active', 'completed']).optional(),
  }).strict();
  type GameScope = { id?: string; bibleStudySessionId?: string | null; groupNumber?: number | null };
  const hostedGames = (req: express.Request): string[] => (req.session as any).hostedIcebreakerGames || [];
  async function canAccessGame(req: express.Request, game: GameScope, write = false) {
    if (game.bibleStudySessionId) {
      if (await canManageSession(req, game.bibleStudySessionId)) return true;
      const member = await studyAccess.owned(req, game.bibleStudySessionId);
      return !!member && member.groupNumber !== null && member.groupNumber === game.groupNumber;
    }
    return !write || !!game.id && hostedGames(req).includes(game.id);
  }
  async function validGameMembers(game: GameScope, value: { drawerOrder?: string[]; sharedMemberIds?: string[]; currentDrawerId?: string | null }) {
    const ids = [...(value.drawerOrder || []), ...(value.sharedMemberIds || []), ...(value.currentDrawerId ? [value.currentDrawerId] : [])];
    if (!ids.length) return true;
    if (!game.bibleStudySessionId) return false;
    const members = await storage.getParticipants(game.bibleStudySessionId);
    const allowed = new Set(members.filter(member => member.groupNumber === game.groupNumber).map(member => member.id));
    return ids.every(id => allowed.has(id));
  }

  app.get("/api/icebreaker/games/:roomCode", async (req, res) => {
    try {
      const game = await storage.getIcebreakerGameByRoomCode(req.params.roomCode);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      if (!await canAccessGame(req, game)) return res.status(403).json({ error: 'Forbidden' });
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get game" });
    }
  });

  app.post("/api/icebreaker/games", async (req, res) => {
    const parsed = gameCreateInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid game configuration' });
    req.body = parsed.data;
    if (req.body.mode === 'session') {
      if (!req.body.bibleStudySessionId || !req.body.groupNumber || !await canAccessGame(req, req.body, true)
          || !await validGameMembers(req.body, req.body)) return res.status(403).json({ error: 'Group membership required' });
    } else {
      if (req.body.bibleStudySessionId || req.body.groupNumber || !await validGameMembers({}, req.body)) return res.status(400).json({ error: 'Invalid standalone game' });
      if (hostedGames(req).length >= 20) return res.status(429).json({ error: 'Game limit reached for this browser session' });
    }
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
      if (!game.bibleStudySessionId) {
        (req.session as any).hostedIcebreakerGames = [...hostedGames(req), game.id];
        await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
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
      if (!z.string().uuid().safeParse(req.params.id).success) return res.sendStatus(400);
      const existing = await storage.getIcebreakerGame(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Game not found' });
      if (!await canAccessGame(req, existing, true)) return res.status(403).json({ error: 'Forbidden' });
      const parsed = gamePatchInput.safeParse(req.body);
      if (!parsed.success || !await validGameMembers(existing, parsed.data)
          || parsed.data.currentDrawerCardId && parsed.data.currentDrawerCardId !== existing.currentCardId) {
        return res.status(400).json({ error: 'Invalid game update' });
      }
      const game = await storage.updateIcebreakerGame(req.params.id, parsed.data);
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
      if (!z.string().uuid().safeParse(req.params.gameId).success) return res.sendStatus(400);
      const game = await storage.getIcebreakerGame(req.params.gameId);
      if (!game) return res.sendStatus(404);
      if (!await canAccessGame(req, game)) return res.sendStatus(403);
      const players = await storage.getIcebreakerPlayers(req.params.gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/players", async (req, res) => {
    try {
      if (!z.string().uuid().safeParse(req.params.gameId).success) return res.sendStatus(400);
      const game = await storage.getIcebreakerGame(req.params.gameId);
      if (!game || !await canAccessGame(req, game, true)) return res.sendStatus(403);
      const parsed = z.object({ displayName: z.string().trim().min(1).max(100), gender: z.string().max(30).optional(), participantId: z.string().uuid().optional() }).strict().safeParse(req.body);
      if (!parsed.success) return res.sendStatus(400);
      if (parsed.data.participantId && (!game.bibleStudySessionId || !await studyAccess.owned(req, game.bibleStudySessionId, parsed.data.participantId))) return res.sendStatus(403);
      if ((await storage.getIcebreakerPlayers(game.id)).length >= 100) return res.sendStatus(409);
      const player = await storage.createIcebreakerPlayer({
        ...parsed.data,
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
      if (!await canAccessGame(req, game)) return res.sendStatus(403);
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get session game" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/draw-card", async (req, res) => {
    try {
      if (!z.string().uuid().safeParse(req.params.gameId).success) return res.sendStatus(400);
      const game = await storage.getIcebreakerGame(req.params.gameId);
      if (!game || !await canAccessGame(req, game, true)) return res.sendStatus(403);
      const level = z.enum(['L1', 'L2', 'L3']).safeParse(req.body?.level || 'L1');
      if (!level.success) return res.sendStatus(400);
      const result = await storage.drawIcebreakerCard(req.params.gameId, level.data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to draw card" });
    }
  });

  app.post("/api/icebreaker/games/:gameId/reset", async (req, res) => {
    try {
      if (!z.string().uuid().safeParse(req.params.gameId).success) return res.sendStatus(400);
      const game = await storage.getIcebreakerGame(req.params.gameId);
      if (!game || !await canAccessGame(req, game, true)) return res.sendStatus(403);
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

  app.get("/api/message-card-downloads", requireAdmin, async (req, res) => {
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
    if (!setMediaHeaders(res, filename)) return res.sendStatus(404);

    const filePath = path.join(messageCardRoot, filename);

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
      const extension = rasterExtension(req.file.buffer);
      if (!extension) return res.status(400).json({ error: '請上傳 JPG、PNG、GIF 或 WebP 圖片。' });
      const imagePath = `${randomBytes(20).toString('hex')}${extension}`;
      await fs.promises.mkdir(messageCardRoot, { recursive: true });
      await fs.promises.writeFile(path.join(messageCardRoot, imagePath), req.file.buffer, { flag: 'wx' });
      res.json({ imagePath });
    } catch (error) {
      console.error("Failed to upload image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Delete message card image
  app.delete("/api/message-cards/image/:filename", requireLeader, async (req, res) => {
    try {
      const filePath = path.join(messageCardRoot, path.basename(req.params.filename));
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

  app.get("/api/message-card-downloads/by-card/:cardId", requireAdmin, async (req, res) => {
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
      const parsed = z.object({
        displayName: z.string().trim().min(1).max(160).optional(),
        avatarUrl: z.string().max(2048).nullable().optional(),
        birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        userGender: z.enum(['male', 'female', 'other']).nullable().optional(),
        address: z.string().trim().max(1000).nullable().optional(),
        church: z.string().trim().max(120).nullable().optional(),
      }).strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid profile fields' });
      if (parsed.data.church !== undefined && (req as any).userRole !== 'admin') {
        return res.status(403).json({ error: 'Only administrators may change church membership' });
      }
      const updates = { ...parsed.data };
      if (updates.church !== undefined) updates.church = normalizeChurch(updates.church);
      const updated = await storage.updateUser(req.params.id, updates);
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
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 }
      });
      await new Promise<void>((resolve, reject) => upload.single('avatar')(req, res, err => err ? reject(err) : resolve()));
      if (!req.file || rasterExtension(req.file.buffer) !== '.jpg') {
        return res.status(400).json({ error: '請使用頭像裁切工具上傳 JPG 圖片。' });
      }
      const uploadDir = path.join(uploadRoot, 'avatars');
      await fs.promises.mkdir(uploadDir, { recursive: true });
      const filename = `${req.params.id}.jpg`;
      const temporary = path.join(uploadDir, `.${filename}-${randomBytes(12).toString('hex')}`);
      const previous = await storage.getUser(req.params.id);
      try {
        await fs.promises.writeFile(temporary, req.file.buffer, { flag: 'wx' });
        await fs.promises.rename(temporary, path.join(uploadDir, filename));
      } finally { await fs.promises.rm(temporary, { force: true }); }
      const avatarUrl = `/uploads/avatars/${filename}?v=${randomBytes(8).toString('hex')}`;
      await storage.updateUser(req.params.id, { avatarUrl });
      // Only remove the old managed avatar belonging to this exact account.
      const old = previous?.avatarUrl?.match(/^\/uploads\/avatars\/([a-f0-9-]+)-(\d+)\.jpg$/i);
      if (old?.[1] === req.params.id) await fs.promises.rm(path.join(uploadDir, `${old[1]}-${old[2]}.jpg`), { force: true });
      res.json({ avatarUrl });
    } catch (error) {
      res.status(error instanceof multer.MulterError ? 400 : 500).json({ error: "Failed to upload avatar" });
    }
  });

  app.delete("/api/users/:id/avatar", requireSelfOrRole("id", "admin", "leader"), async (req, res) => {
    try {
      await storage.updateUser(req.params.id, { avatarUrl: null });
      await fs.promises.rm(path.join(uploadRoot, 'avatars', `${req.params.id}.jpg`), { force: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove avatar" });
    }
  });

  app.get("/api/users", requireCrmMemberAccess, async (req, res) => {
    try {
      const churchScope = await getCrmChurchFilter(req);
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const users = await storage.getUsers(churchScope);
      const personal = access.personalAccess;
      const privateIds = new Set(personal?.canViewPersonal ? filterUsersForCrmAccess(users, personal).map(user => user.id) : []);
      const visibleUsers = filterUsersForCrmAccess(users, access);
      const ministryRoles = await memberRoleNames(visibleUsers.map(u=>u.id));
      res.json(visibleUsers.map(user => ({...(privateIds.has(user.id) ? sanitizeUserRecord(user) : {
        id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, church: user.church,
        createdAt: user.createdAt, updatedAt: user.updatedAt,
      }), ministryRoles: ministryRoles.get(user.id) || []})));
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/user-roles", requireCrmMemberAccess, async (req, res) => {
    try {
      const churchScope = await getCrmChurchFilter(req);
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
        if (role === 'admin' || role === 'senior_pastor' || ['admin','senior_pastor'].includes(await storage.getUserRole(req.params.userId) || '') || !normalizeChurch(director?.church)) return res.status(403).json({ error: '只有系統管理員可以調整管理者權限' });
        if (!target || normalizeChurch(target.church) !== normalizeChurch(director?.church)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      await changeAccountRole(directorUserId!, req.params.userId, role);
      res.json({ success: true });
    } catch (error) {
      res.status(error instanceof GroupError ? error.status : 500).json({ error: error instanceof GroupError ? error.message : "Failed to update user role" });
    }
  });

  app.patch("/api/potential-members/:id", requireCrmMemberAccess, async (req, res) => {
    try {
      const churchScope = await getCrmChurchFilter(req);
      const careOnly = Object.keys(req.body || {}).every(key => ['status','subscribed'].includes(key));
      const access = await getCrmAccessForRequest(req, careOnly ? 'careOrMembers' : 'members');
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      {
        const existing = await pool.query("SELECT id, email, church FROM potential_members WHERE id = $1", [req.params.id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Potential member not found" });
        }
        const existingChurch = normalizeChurch(existing.rows[0].church);
        const inScope = !churchScope || (churchScope === UNASSIGNED_CHURCH_ID ? !existingChurch : existingChurch === churchScope);
        const inCrmAccess = filterPotentialMembersForCrmAccess(existing.rows, access).length > 0;
        if (!inScope || !inCrmAccess || (!access.canManageMembers && !access.canManageCare)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const updates = z.object({ status: z.enum(['pending','member','declined']).optional(), subscribed: z.boolean().optional(), name: z.string().trim().min(1).max(160).optional(), gender: z.string().max(30).nullable().optional(), church: z.string().max(120).optional() }).strict().parse(req.body);
      if (typeof updates.church === "string") {
        updates.church = normalizeChurch(updates.church) || '';
        if (access.role !== 'admin' && !access.churchScopes.includes(updates.church || '')) return res.status(403).json({ error: '目的教會不在管理範圍內' });
      }
      const updated = await storage.updatePotentialMember(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Potential member not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid member fields' });
      res.status(500).json({ error: "Failed to update potential member" });
    }
  });

  app.delete("/api/potential-members/:id", requireCrmMemberAccess, async (req, res) => {
    try {
      const churchScope = await getCrmChurchFilter(req);
      const access = await getCrmAccessForRequest(req, 'members');
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      {
        const existing = await pool.query("SELECT id, email, church FROM potential_members WHERE id = $1", [req.params.id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Potential member not found" });
        }
        const existingChurch = normalizeChurch(existing.rows[0].church);
        const inScope = !churchScope || (churchScope === UNASSIGNED_CHURCH_ID ? !existingChurch : existingChurch === churchScope);
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

  app.get("/api/sessions/:sessionId/study-responses", requireSessionManager, async (req, res) => {
    try {
      const responses = await storage.getStudyResponses(req.params.sessionId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study responses" });
    }
  });

  // Profile notification endpoint using Resend integration
  const mailLimit = boundedWindowLimiter({ max: 5, windowMs: 15 * 60_000, key: apiIdentity });
  const requireEmailStaff = requireDelegated('email.send',emailStaffRoles);
  const emailRecipientsFor = async (req: Parameters<RequestHandler>[0]) => {
    const access = await getCrmAccessForRequest(req, 'email');
    if (!access?.canEnterCrm || !access.canManageMembers) return [];
    return filterUsersForCrmAccess(await storage.getUsers(await getChurchScope(req)), access);
  };
  app.post("/api/send-profile-notification", requireEmailStaff, mailLimit, async (req, res) => {
    try {
      const parsed = profileNotificationInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: '通知內容格式不正確' });
      let redirectUrl: string;
      try { redirectUrl = escapeEmailHtml(emailAppUrl(parsed.data.redirectUrl)); }
      catch { return res.status(400).json({ error: '通知連結必須指向本站' }); }
      const { email, type } = parsed.data;
      if (!(await emailRecipientsFor(req)).some(user => user.email.toLowerCase() === email.toLowerCase())) {
        return res.status(403).json({ error: '只能寄給你管理範圍內的會員' });
      }
      const name = escapeEmailHtml(parsed.data.name);
      const status = emailProviderStatus();
      if (!status.canSend) return res.status(503).json({ error: status.message });

      const { sendEmail } = await import('./resend');

      let subject = '';
      let html = '';

      switch (type) {
        case 'welcome':
        case 'potential_member':
          subject = '歡迎加入 WeChurch';
          html = `
            <h1>歡迎 ${name}!</h1>
            <p>感謝您加入 WeChurch 社群。</p>
            <p>點擊下方連結開始您的信仰之旅：</p>
            <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 8px;">開始使用</a>
          `;
          break;
        case 'unverified_email':
        case 'incomplete_profile':
          subject = 'WeChurch 帳號資料提醒';
          html = `<h1>${name}，你好</h1><p>請登入 WeChurch，確認你的帳號與個人資料。</p><a href="${redirectUrl}">登入查看</a>`;
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
        purpose: 'staff',
        to: email,
        subject,
        html,
        ...(parsed.data.requestId ? { idempotencyKey: `profile/${parsed.data.requestId}` } : {}),
      });

      res.json({ success: true, acceptedOnly: true, message: "寄信服務已接受通知，尚非送達確認" });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: "Failed to send notification", message: error.message });
    }
  });

  app.get("/api/admin/users-for-email", requireEmailStaff, async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if ((!userRole || !['admin', 'senior_pastor', 'pastor'].includes(userRole)) && !await hasPermission(userId, 'email.send')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { role, church } = req.query;
      const churchScope = await getChurchScope(req);
      const allUsers = await emailRecipientsFor(req);
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

      const { buildSelfReminder } = await import("./emailReminders");
      const email = buildSelfReminder();
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
    dailyFollowConsentAt: null,
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

      const lastDelivery = await pool.query('SELECT status,local_day::text AS day FROM email_reminder_deliveries WHERE user_id=$1 ORDER BY local_day DESC LIMIT 1', [userId]);
      res.json({ ...(preferences || defaultEmailPreferences(userId)), lastReminderDelivery: lastDelivery.rows[0] ?? null });
    } catch (error: any) {
      console.error("Error fetching email preferences:", error);
      res.status(500).json({ error: "Failed to fetch email preferences", message: error.message });
    }
  });

  app.get("/api/email-provider-status", async (req, res) => {
    if (!await resolveUserId(req)) return res.status(401).json({ error: 'Unauthorized' });
    res.json(emailProviderStatus());
  });

  app.patch("/api/email-preferences", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsed = emailPreferencesInput.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email preferences", details: parsed.error.flatten() });
      }
      if (parsed.data.dailyFollowEnabled === true && !emailProviderStatus().remindersEnabled) {
        return res.status(409).json({ error: '提醒寄送尚未啟用，啟用後請再開啟訂閱。' });
      }

      const now = new Date();
      const consent = parsed.data.dailyFollowEnabled === true ? now : parsed.data.dailyFollowEnabled === false ? null : undefined;
      const [preferences] = await db
        .insert(userEmailPreferences)
        .values({
          userId,
          dailyFollowEnabled: parsed.data.dailyFollowEnabled ?? false,
          dailyFollowConsentAt: consent ?? null,
          dailyFollowTime: parsed.data.dailyFollowTime || "07:00",
          timezone: parsed.data.timezone || "Asia/Taipei",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userEmailPreferences.userId,
          set: {
            ...parsed.data,
            ...(consent !== undefined ? { dailyFollowConsentAt: consent } : {}),
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

  app.post("/api/daily-follow-email/send-test", mailLimit, async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(404).json({ error: "User email not found" });
      }

      const status = emailProviderStatus();
      if (!status.canSend) {
        const { buildSelfReminder } = await import('./emailReminders');
        const preview = buildSelfReminder();
        return res.status(202).json({ success: false, previewOnly: true, message: status.message, ...preview });
      }
      const { buildSelfReminder } = await import('./emailReminders');
      const { sendEmail } = await import('./resend');
      await sendEmail({ purpose: 'self', to: user.email, ...buildSelfReminder() });
      res.json({ success: true, sent: 1, acceptedOnly: true });
    } catch (error: any) {
      console.error("Daily follow test failed");
      res.status(500).json({ error: "EMAIL_TEST_FAILED", message: "無法確認測試信結果，請先檢查收件匣，稍後再試。" });
    }
  });

  app.post("/api/admin/daily-follow-email/send", requireEmailStaff, mailLimit, async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if ((!userRole || !["admin", "senior_pastor", "pastor"].includes(userRole)) && !await hasPermission(userId, 'email.send')) {
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
      if (!dryRun && !emailProviderStatus().remindersEnabled) return res.status(503).json({ error: '自動提醒尚未啟用' });
      const visibleIds = (await emailRecipientsFor(req)).map(user => user.id);
      if (userIds?.some(id => !visibleIds.includes(id))) return res.status(403).json({ error: '收件人不在你的管理範圍內' });
      const { runDailyReminders } = await import('./emailReminders');
      res.json(await runDailyReminders({ userIds: userIds ?? visibleIds, dryRun, limit }));
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

      if (!parsed.data.dryRun && !emailProviderStatus().remindersEnabled) return res.status(503).json({ error: '自動提醒尚未啟用' });
      const { runDailyReminders } = await import('./emailReminders');
      res.json(await runDailyReminders(parsed.data));
    } catch (error: any) {
      console.error("Error running daily follow email cron:", error);
      res.status(500).json({ error: "Failed to run daily follow email cron", message: error.message });
    }
  });

  app.post("/api/send-bulk-email", requireEmailStaff, mailLimit, async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRole = await storage.getUserRole(userId);
      if ((!userRole || !['admin', 'senior_pastor', 'pastor'].includes(userRole)) && !await hasPermission(userId, 'email.send')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = bulkEmailInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: '郵件格式不正確：每次最多 100 人，附件合計 2MB。' });
      const { recipients, subject, body, isHtml, attachments, requestId } = parsed.data;
      const allowedEmails = new Set((await emailRecipientsFor(req)).map(user => user.email.toLowerCase()));
      if (recipients.some(r => !allowedEmails.has(r.email.toLowerCase()))) return res.status(403).json({ error: '只能寄給你管理範圍內的會員' });
      const status = emailProviderStatus();
      if (!status.canSend) return res.status(503).json({ error: status.message });

      const { sendBulkEmail } = await import('./resend');

      const result = await sendBulkEmail(recipients, subject, body, isHtml, attachments, requestId);

      res.json(result);
    } catch (error: any) {
      console.error('Error sending bulk email:', error);
      res.status(500).json({ error: "Failed to send emails", message: error.message });
    }
  });

  // ============ Inbox / Inbound Email Routes ============
  app.post("/api/webhooks/resend/inbound", async (req, res) => {
    try {
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) return res.status(503).json({ error: 'Webhook is not configured' });
      const providedSecret = req.get('x-webhook-secret') || '';
      const provided = Buffer.from(providedSecret);
      const expected = Buffer.from(webhookSecret);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
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

      console.log('[Inbound] Received verified email');
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Inbound] Error processing inbound email:', error);
      res.status(500).json({ error: "Failed to process inbound email" });
    }
  });

  // The shared mailbox has no per-recipient assignments; family roles cannot access it.
  app.get("/api/admin/inbox", requireAdmin, async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userRole = await storage.getUserRole(userId);
      if (!userRole || !['admin', 'leader'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const archived = req.query.archived === 'true';
      const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 100));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

      const emails = await storage.getInboxEmails({ archived, limit, offset });
      res.json(emails);
    } catch (error: any) {
      console.error('Error fetching inbox:', error);
      res.status(500).json({ error: "Failed to fetch inbox" });
    }
  });

  app.get("/api/admin/inbox/unread-count", requireAdmin, async (req, res) => {
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

  app.patch("/api/admin/inbox/:id/read", requireAdmin, async (req, res) => {
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

  app.patch("/api/admin/inbox/:id/archive", requireAdmin, async (req, res) => {
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
    const parsedDate = devotionDate.safeParse(req.query.date ?? taipeiToday());
    if (!parsedDate.success) return void res.status(400).json({ error: '日期格式錯誤' });
    const date = parsedDate.data;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const managed = await getManagedChurchDevotion(date);
      return void res.json(await withDevotionScripture(managedDevotionBrief(date, managed.entry), (book, chapter) => storage.getBibleVerses(book, chapter)));
    } catch (error) {
      console.error('[church-reading] Schedule unavailable', error);
      return void res.status(503).json({ error: '暫時無法取得教會靈修課表' });
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

  app.get("/api/line-login/url", async (req: any, res) => {
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
    const linkUserId = req.query.link === '1' ? await resolveUserId(req) : null;
    if (req.query.link === '1' && (!linkUserId || req.get('sec-fetch-site') === 'cross-site')) return res.status(403).json({ error: '請從已登入的個人設定確認綁定' });
    req.session.lineLogin = {
      state,
      nonce,
      redirectPath,
      createdAt: Date.now(),
      linkUserId,
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
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60 * 1000 || typeof savedState.nonce !== 'string' || !savedState.nonce) {
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
      if (savedState.linkUserId && savedState.linkUserId !== await resolveUserId(req)) return res.status(403).send('登入帳號已變更，請重新確認綁定。');
      const linked = await ensureLineLinkedUser(profile, savedState.linkUserId || undefined);

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
          if (saveError) {
            console.error("[LINE Login] Session save error:", saveError);
            return res.status(503).send('登入狀態暫時無法儲存，請重新登入。');
          }
          res.redirect(savedState.redirectPath || "/");
        });
      });
    } catch (error) {
      if (isLineSchemaMissingError(error)) {
        return res.status(409).send("LINE schema is not ready. Run npm run db:push first.");
      }
      console.error("[LINE Login] Callback failed:", error);
      if (error instanceof Error && error.message === 'LINE_ACCOUNT_LINK_REQUIRED') return res.status(409).send('這個 Email 已有帳號。為保護原有資料，請先使用原本方式登入，再由本人確認帳號綁定。');
      if (error instanceof Error && error.message === 'LINE_ACCOUNT_ALREADY_LINKED') return res.status(409).send('這個 LINE 或系統帳號已經綁定，原有連結未變更。');
      res.status(500).send("LINE Login failed.");
    }
  });

  app.post("/api/pastoral/journey-templates/love-journey-28/seed", requireCrmDirector, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
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

  app.get("/api/pastoral/framework", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getCrmChurchFilter(req);
      const overview = await getPastoralFrameworkOverview(churchScope, access);
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

  app.post("/api/pastoral/framework/seed-153", requireCrmDirector, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
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

  app.patch("/api/pastoral/persons/:personId/stage", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = personStagePatchSchema.parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
      const allowedPerson = await getPastoralPersonDetail(req.params.personId, churchScope, { canViewPersonal: false, access });
      if (!allowedPerson) {
        return res.status(404).json({ error: "Person or pastoral stage not found" });
      }
      const result = await updatePersonPastoralStage({ personId: allowedPerson.person.id, ...input }, churchScope);
      if (!result) return res.status(404).json({ error: "Person or pastoral stage not found" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid person stage", details: error.flatten() });
      if (isPastoralFrameworkSchemaMissingError(error)) return res.status(409).json({ schemaReady: false, error: "Pastoral framework schema is not ready" });
      console.error("Error updating person pastoral stage:", error);
      res.status(500).json({ error: "Failed to update person pastoral stage" });
    }
  });

  app.get("/api/pastoral/persons", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getCrmChurchFilter(req);
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

  app.post("/api/pastoral/reconcile", requireCrmDirector, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
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

  app.get("/api/pastoral/persons/:personId", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req);
      if (!access || !access.canEnterCrm) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getCrmChurchFilter(req);
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

  app.post("/api/pastoral/persons/:personId/love-journey/start", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || (!access.canManageCare && !access.canManageMembers)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getCrmChurchFilter(req);
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
      if ((error as {code?:string}).code === 'JOURNEY_OWNER_REQUIRED') {
        return res.status(409).json({error:'請先確認唯一的學員帳號，再開啟個人課程。'});
      }
      console.error("Error starting love journey:", error);
      res.status(500).json({ error: "Failed to start love journey" });
    }
  });

  app.patch("/api/pastoral/journey-progress/:progressId", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = journeyProgressPatchSchema.omit({ responseText: true }).extend({ version: z.number().int().positive() }).strict().parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
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

  app.patch("/api/pastoral/journey-milestones/:milestoneId", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = journeyMilestonePatchSchema.parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
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

  app.get("/api/pastoral/persons/:personId/tasks", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getCrmChurchFilter(req);
      res.json({ schemaReady: true, tasks: await listPastoralTasks(req.params.personId, churchScope, access) });
    } catch (error) {
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error listing pastoral tasks:", error);
      res.status(500).json({ error: "Failed to list pastoral tasks" });
    }
  });

  app.post("/api/pastoral/persons/:personId/tasks", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = pastoralTaskBodySchema.parse(req.body);
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getCrmChurchFilter(req);
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

  app.post("/api/pastoral/persons/:personId/tasks/next-step", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const userId = (req as any).legacyUserId || await resolveUserId(req);
      const churchScope = await getCrmChurchFilter(req);
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

  app.patch("/api/pastoral/tasks/:taskId", requireCrmMemberAccess, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'care');
      if (!access || !access.canManageCare) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = pastoralTaskPatchSchema.parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
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
      const access = await getCrmAccessForRequest(req, 'members');
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const churchScope = await getCrmChurchFilter(req);
      res.json({ schemaReady: true, suggestions: await listPersonMergeSuggestions(churchScope, access) });
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
      const access = await getCrmAccessForRequest(req, 'members');
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = mergeSuggestionBodySchema.parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
      for (const id of [input.primaryPersonId, input.duplicatePersonId]) {
        if (!await getPastoralPersonDetail(id, churchScope, { canViewPersonal: false, access })) return res.status(404).json({ error: 'Merge candidate not found' });
      }
      const result = await dismissPersonMergeSuggestion(input.primaryPersonId, input.duplicatePersonId, churchScope);
      if (!result) return res.status(404).json({ error: 'Merge candidate not found' });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid merge suggestion", details: error.flatten() });
      console.error("Error dismissing merge suggestion:", error);
      res.status(500).json({ error: "Failed to dismiss merge suggestion" });
    }
  });

  app.post("/api/pastoral/merge-suggestions/merge", requireLeader, async (req, res) => {
    try {
      const access = await getCrmAccessForRequest(req, 'members');
      if (!access || !access.canManageMembers) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const input = mergeSuggestionBodySchema.parse(req.body);
      const churchScope = await getCrmChurchFilter(req);
      const result = await mergePersons(pool, { ...input, churchScope, access, actorUserId: await resolveUserId(req) });
      if (!result) return res.status(404).json({ error: "Merge candidate not found" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid merge suggestion", details: error.flatten() });
      if (isPastoralSchemaMissingError(error)) {
        return res.status(409).json({ schemaReady: false, error: "Pastoral schema is not ready" });
      }
      console.error("Error merging pastoral persons:", error);
      if (error instanceof PersonMergeError) return res.status(error.status).json({ error: error.message });
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

  app.patch("/api/me/love-journey/:journeyId/status", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = z.string().uuid().parse(req.params.journeyId);
      const input = z.object({ expectedStatus: z.enum(['active','paused']), status: z.enum(['active','paused']) }).strict().parse(req.body);
      const result = await changeSelfJourneyStatus(userId,id,input.expectedStatus,input.status);
      if (!result) return res.status(409).json({ error: "旅程狀態已變更或無法存取，請重新載入" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid journey status" });
      console.error('Error changing self journey status:', error);
      res.status(500).json({ error: "Failed to change journey status" });
    }
  });

  app.patch("/api/me/love-journey/progress/:progressId", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const input = journeyProgressPatchSchema.pick({ status: true, responseText: true }).extend({ version: z.number().int().positive(), visibility: z.enum(['private','pastoral','mentor']).optional(), mentorContractId:z.string().uuid().optional() }).strict().refine(value=>value.visibility!=='mentor'||!!value.mentorContractId).parse(req.body);
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

  app.use('/api/user-reading-plans/:id', readingPlanAccess(resolveUserId, (id, userId) => storage.getUserReadingPlan(id, userId)));

  app.get("/api/user-reading-plans/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const plan = await storage.getUserReadingPlan(req.params.id, res.locals.readingOwnerId);
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

      const parsed = readingPlanBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid reading plan', details: parsed.error.issues });
      const { name, description, startDate, bookSelections, chaptersPerDay, reminderEnabled, reminderMorning, reminderNoon, reminderEvening, templateId } = parsed.data;
      const plan = await createReadingPlan(db, userId, parsed.data);

      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating user reading plan:', error);
      if (error instanceof ReadingPlanError) return res.status(error.status).json({ error: error.message });
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

      const plan = await storage.updateUserReadingPlan(req.params.id, res.locals.readingOwnerId, updates);
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
      await storage.deleteUserReadingPlan(req.params.id, res.locals.readingOwnerId);
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
      const plan = await storage.getUserReadingPlan(req.params.id, res.locals.readingOwnerId);
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
      const updated = await storage.markReadingComplete(dayProgress.id, res.locals.readingOwnerId);
      res.json(updated);
    } catch (error) {
      console.error('Error marking reading complete:', error);
      res.status(500).json({ error: "Failed to mark reading as complete" });
    }
  });

  // ============ Devotional Notes API Routes ============
  app.get('/api/im-reading-history', async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      res.setHeader('Cache-Control', 'private, no-store');
      const result = await pool.query(`SELECT p.id,p.reading_date::text AS date,p.scripture_reference AS reference,
        p.is_completed AS completed FROM im_source_records r
        JOIN user_reading_progress p ON p.id=r.progress_id AND p.user_id=r.user_id
        WHERE r.user_id=$1 AND r.kind='read-day' ORDER BY p.reading_date DESC,p.id`, [userId]);
      res.json(result.rows);
    } catch {
      res.status(500).json({ error: '讀經紀錄暫時無法載入，請稍後重試。' });
    }
  });
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
        return res.status(400).json({ error: "Invalid devotional note data", details: parsed.error.issues });
      }
      if (parsed.data.readingPlanId && !await storage.getUserReadingPlan(parsed.data.readingPlanId, userId)) {
        return res.status(404).json({ error: 'Reading plan not found' });
      }
      const mutationId = z.string().uuid().optional().safeParse(req.body.clientMutationId);
      if (!mutationId.success) return res.status(400).json({ error: 'Invalid save identifier' });
      const note = await storage.createDevotionalNote(parsed.data, mutationId.data);
      if (!note) return res.status(409).json({ error: 'Save identifier conflict' });
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
      if (parsed.data.readingPlanId && !await storage.getUserReadingPlan(parsed.data.readingPlanId, userId)) {
        return res.status(404).json({ error: 'Reading plan not found' });
      }
      const version = z.number().int().positive().safeParse(req.body.version);
      if (!version.success) return res.status(428).json({ error: '請重新載入筆記後再儲存；目前輸入請先保留。' });
      const note = await storage.updateDevotionalNoteForUser(req.params.id, userId, parsed.data, version.data);
      if (!note) {
        return res.status(409).json({ error: '筆記已變更或無法存取，尚未覆蓋；請保留草稿並重新確認。' });
      }
      res.json(note);
    } catch (error) {
      console.error('Error updating devotional note:', error);
      res.status(500).json({ error: "Failed to update devotional note" });
    }
  });

  app.delete('/api/devotional-notes/:id', async (req, res) => {
    try {
      const actor = await resolveUserId(req);
      if (!actor) return res.status(401).json({ error: '請先登入。' });
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ error: '筆記編號不正確。' });
      const version = z.number().int().positive().safeParse(req.body?.version);
      if (!version.success) return res.status(428).json({ error: '請重新載入筆記後再刪除。' });
      const { deleteDevotionalNote } = await import('./deleteDevotionalNote');
      const result = await deleteDevotionalNote(id.data, actor, version.data);
      if (result === 'missing') return res.status(404).json({ error: '找不到這則筆記。' });
      if (result === 'conflict') return res.status(409).json({ error: '這則筆記剛有更新，請重新載入並確認內容後再刪除。' });
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ error: '筆記尚未刪除，請稍後重試。' });
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
      const existing = await storage.getStudyResponseWithOwner(req.params.id);
      if (!existing || !await studyAccess.owned(req, existing.sessionId, existing.userId)) {
        return res.status(404).json({ error: "Entry not found" });
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

  // ============ Saved Verses API Routes ============
  app.get("/api/saved-verses", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const verses = await storage.getSavedVerses(userId);
      res.json(verses);
    } catch (error) {
      console.error('Error fetching saved verses:', error);
      res.status(500).json({ error: "Failed to get saved verses" });
    }
  });

  app.get("/api/saved-verses/check", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { bookName, chapter, verse } = req.query;
      if (!bookName || !chapter || !verse) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      const saved = await storage.getSavedVerse(userId, bookName as string, parseInt(chapter as string), parseInt(verse as string));
      res.json({ saved: !!saved, id: saved?.id });
    } catch (error) {
      console.error('Error checking saved verse:', error);
      res.status(500).json({ error: "Failed to check saved verse" });
    }
  });

  app.post("/api/saved-verses", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const data = insertSavedVerseSchema.parse({ ...req.body, userId });
      const saved = await storage.createSavedVerse(data);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Error saving verse:', error);
      res.status(500).json({ error: "Failed to save verse" });
    }
  });

  app.delete("/api/saved-verses/:id", async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.deleteSavedVerse(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting saved verse:', error);
      res.status(500).json({ error: "Failed to delete saved verse" });
    }
  });
}
