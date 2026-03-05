import type { Express } from "express";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertSessionSchema, insertParticipantSchema, insertSubmissionSchema, insertPrayerSchema, insertStudyResponseSchema, insertSavedVerseSchema, insertGroupingActivitySchema, insertGroupingParticipantSchema, insertDevotionalNoteSchema, prayerMeetings, prayerMeetingParticipants } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { pool, getPoolStats } from "./db";
import { bibleCache, timelineCache, apiCache, sessionCache, prayerCache, cacheKeys } from "./cache";
import compression from "compression";

const gameCreationLocks = new Map<string, Promise<any>>();

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

export async function registerRoutes(app: Express) {
  app.use('/assets', express.static(path.join(process.cwd(), 'dist/public/assets'), {
    maxAge: '30d',
    immutable: true,
  }));

  app.use(compression());

  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60000;
  const RATE_LIMIT_MAX_REQUESTS = 200;

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 30000);

  app.use('/api/', (req, res, next) => {
    const clientId = (req as any).user?.id || req.ip || 'unknown';
    const now = Date.now();

    let entry = rateLimitMap.get(clientId);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitMap.set(clientId, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count).toString());

    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
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

  // Register health check FIRST - before any auth setup that might fail
  app.get("/api/health", async (req, res) => {
    const poolStats = getPoolStats();
    const memUsage = process.memoryUsage();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        pool: poolStats,
        healthy: poolStats.waitingCount < 10,
      },
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      cache: {
        bible: bibleCache.getStats(),
        timeline: timelineCache.getStats(),
        api: apiCache.getStats(),
      },
    });
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
  app.get("/api/health/detailed", async (req, res) => {
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

  // Database connection check endpoint
  app.get("/api/health/db", async (req, res) => {
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
  app.get("/api/debug/db-counts", async (req, res) => {
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
  app.post("/api/cache/clear", async (req, res) => {
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

  app.get("/api/sessions", async (req, res) => {
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

  app.post("/api/sessions", async (req, res) => {
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

  app.patch("/api/sessions/:id", async (req, res) => {
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

  app.delete("/api/sessions/:id", async (req, res) => {
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

  app.get("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const groupNumber = req.query.groupNumber ? parseInt(req.query.groupNumber as string) : undefined;
      const result = await storage.getParticipants(req.params.sessionId, { groupNumber });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get participants" });
    }
  });

  // Get participant by email for session restore
  app.get("/api/sessions/:sessionId/participants/by-email/:email", async (req, res) => {
    try {
      const participants = await storage.getParticipants(req.params.sessionId);
      const participant = participants.find(p => p.email === decodeURIComponent(req.params.email));
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.json(participant);
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
      const participant = await storage.updateParticipant(req.params.id, req.body);
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

  app.post("/api/participants/batch-assign-groups", async (req, res) => {
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

      for (const { participantIds, groupNumber } of assignments) {
        for (const participantId of participantIds) {
          await storage.updateParticipant(participantId, { groupNumber, readyConfirmed: false });
        }
      }

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
      const parsed = insertSubmissionSchema.safeParse({ ...req.body, sessionId: req.params.sessionId });
      if (!parsed.success) {
        console.error("[create-submission] Validation error:", (parsed as any).error.errors);
        return res.status(400).json({ error: "Invalid submission data", details: (parsed as any).error.errors });
      }
      // Ensure all fields are present or default to empty string to satisfy DB schema
      const submissionData = {
        sessionId: req.params.sessionId,
        participantId: req.body.userId || req.body.participantId,
        groupNumber: req.body.groupNumber,
        name: req.body.name,
        email: req.body.email,
        bibleVerse: req.body.bibleVerse,
        theme: req.body.theme || "",
        movingVerse: req.body.movingVerse || "",
        factsDiscovered: req.body.factsDiscovered || "",
        traditionalExegesis: req.body.traditionalExegesis || "",
        inspirationFromGod: req.body.inspirationFromGod || "",
        applicationInLife: req.body.applicationInLife || "",
        others: req.body.others || "",
      };
      const submission = await storage.createSubmission(submissionData as any);
      sessionCache.invalidate(`poll:${req.params.sessionId}`);
      res.status(201).json(submission);
    } catch (error) {
      console.error("[create-submission] Error:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  app.delete("/api/sessions/:sessionId/submissions", async (req, res) => {
    try {
      await storage.deleteSubmissionsBySession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete submissions" });
    }
  });

  app.delete("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      await storage.deleteParticipantsBySession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete participants" });
    }
  });

  // Force verify all participants (set ready_confirmed = true)
  app.post("/api/sessions/:sessionId/force-verify-all", async (req, res) => {
    try {
      const count = await storage.forceVerifyAllParticipants(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[force-verify-all] Error:", error);
      res.status(500).json({ error: "Failed to force verify participants", success: false });
    }
  });

  // Reset all participants' ready_confirmed status to false
  app.post("/api/sessions/:sessionId/reset-ready-status", async (req, res) => {
    try {
      const count = await storage.resetAllReadyStatus(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[reset-ready-status] Error:", error);
      res.status(500).json({ error: "Failed to reset ready status", success: false });
    }
  });

  // Clear all group assignments (set group_number to null)
  app.post("/api/sessions/:sessionId/clear-groups", async (req, res) => {
    try {
      const count = await storage.clearAllGroupAssignments(req.params.sessionId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("[clear-groups] Error:", error);
      res.status(500).json({ error: "Failed to clear group assignments", success: false });
    }
  });

  app.get("/api/sessions/:sessionId/reports", async (req, res) => {
    try {
      const reports = await storage.getAiReports(req.params.sessionId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reports" });
    }
  });

  app.delete("/api/reports/:id", async (req, res) => {
    try {
      await storage.deleteAiReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.post("/api/sessions/:sessionId/reports", async (req, res) => {
    try {
      const { reportType, groupNumber, fastMode, filledOnly } = req.body;
      const studyResponses = await storage.getStudyResponses(req.params.sessionId);

      let filteredResponses = studyResponses;
      if (groupNumber !== undefined && groupNumber !== null) {
        filteredResponses = studyResponses.filter(r => r.groupNumber === groupNumber);
      }
      if (filledOnly) {
        filteredResponses = filteredResponses.filter(r =>
          r.observation || r.coreInsightNote || r.actionPlan
        );
      }

      // Generate markdown-formatted report content
      const generateMarkdownReport = (responses: typeof filteredResponses, grpNum?: number) => {
        const members = responses.map(r => r.participantName || '匿名').join('、');
        const titlePhrases = [...new Set(responses.map(r => r.titlePhrase).filter(Boolean))];
        const observations = responses.map(r => r.observation).filter(Boolean);
        const categoryLabels: Record<string, string> = {
          'PROMISE': '應許', 'COMMAND': '命令', 'WARNING': '警戒', 'GOD_ATTRIBUTE': '認識神'
        };
        const insightsWithNames: { name: string; insight: string }[] = [];
        responses.forEach(r => {
          if (!r.coreInsightNote) return;
          const name = r.participantName || '匿名';
          let noteObj: Record<string, string> | null = null;
          try { noteObj = JSON.parse(r.coreInsightNote); } catch { }
          if (noteObj && typeof noteObj === 'object' && !Array.isArray(noteObj)) {
            Object.entries(noteObj).forEach(([cat, text]) => {
              if (text && text.trim()) {
                const label = categoryLabels[cat] || cat;
                insightsWithNames.push({ name, insight: `【${label}】${text}` });
              }
            });
          } else if (r.coreInsightNote.trim()) {
            insightsWithNames.push({ name, insight: r.coreInsightNote });
          }
        });
        const applications = responses.map(r => r.actionPlan).filter(Boolean);

        let content = '';
        if (grpNum) {
          content += `**組別：** 第 ${grpNum} 組\n`;
        } else {
          content += `**📊 全會眾綜合分析**\n`;
        }
        content += `**組員：** ${members}\n\n`;

        if (titlePhrases.length > 0) {
          content += `**📖 主題（Themes）：**\n`;
          titlePhrases.forEach(t => { content += `• ${t}\n`; });
          content += '\n';
        }

        if (observations.length > 0) {
          content += `**🔍 事實發現（Observations）：**\n`;
          observations.slice(0, 5).forEach(o => { content += `• ${o}\n`; });
          content += '\n';
        }

        if (insightsWithNames.length > 0) {
          content += `**💡 獨特亮光（Unique Insights）：**\n`;
          insightsWithNames.slice(0, 5).forEach(({ name, insight }) => { content += `• **${name}**：${insight}\n`; });
          content += '\n';
        }

        if (applications.length > 0) {
          content += `**🎯 如何應用（Applications）：**\n`;
          applications.slice(0, 5).forEach(a => { content += `• ${a}\n`; });
          content += '\n';
        }

        content += `**👤 個人貢獻摘要：**\n`;
        responses.forEach(r => {
          content += `• **${r.participantName || '匿名'}**：${r.titlePhrase || ''}${r.heartbeatVerse ? ' - ' + r.heartbeatVerse : ''}\n`;
        });

        return content;
      };

      let content: string;
      if (reportType === 'group' && groupNumber) {
        content = generateMarkdownReport(filteredResponses, groupNumber);
      } else {
        // Overall report - first add combined summary, then group-by-group sections
        const sections: string[] = [];

        // Add overall combined summary (全會眾綜合分析) first
        sections.push(generateMarkdownReport(filteredResponses, undefined));

        // Then add individual group sections
        const groupedResponses = new Map<number, typeof filteredResponses>();
        filteredResponses.forEach(r => {
          const grp = r.groupNumber || 0;
          if (grp > 0) { // Only include actual groups, not ungrouped responses
            if (!groupedResponses.has(grp)) groupedResponses.set(grp, []);
            groupedResponses.get(grp)!.push(r);
          }
        });

        const sortedGroups = [...groupedResponses.keys()].sort((a, b) => a - b);
        sortedGroups.forEach(grp => {
          const grpResponses = groupedResponses.get(grp)!;
          if (grpResponses.length > 0) {
            sections.push(generateMarkdownReport(grpResponses, grp));
          }
        });
        content = sections.join('\n========================================\n\n');
      }

      const report = await storage.createAiReport({
        sessionId: req.params.sessionId,
        reportType,
        groupNumber,
        content,
        status: "COMPLETED"
      });

      res.status(201).json(report);
    } catch (error) {
      console.error("[report-generation] Failed for session", req.params.sessionId, ":", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.post("/api/sessions/:sessionId/reports/generate", async (req, res) => {
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

  app.delete("/api/study-responses/:id", async (req, res) => {
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
      const prayer = await storage.createPrayer(req.body);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(prayer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create prayer" });
    }
  });

  app.patch("/api/prayers/:id", async (req, res) => {
    try {
      const updateData: Record<string, any> = {};
      if (req.body.isPinned !== undefined) updateData.isPinned = req.body.isPinned;
      if (req.body.isAnswered !== undefined) {
        updateData.isAnswered = req.body.isAnswered;
        updateData.answeredAt = req.body.isAnswered ? new Date() : null;
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
      await storage.deletePrayer(req.params.id);
      prayerCache.invalidatePattern('prayers:');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete prayer" });
    }
  });

  app.post("/api/prayers/:id/amen", async (req, res) => {
    try {
      const amen = await storage.createPrayerAmen(req.params.id, req.body.userId);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(amen);
    } catch (error) {
      console.error("[create-prayer-amen] Error:", error);
      res.status(500).json({ error: "Failed to add amen" });
    }
  });

  app.get("/api/prayers/:id/comments", async (req, res) => {
    try {
      const currentUserId = req.query.userId as string | undefined;
      const comments = await storage.getPrayerComments(req.params.id, currentUserId);
      res.json(comments);
    } catch (error) {
      console.error("[get-prayer-comments] Error:", error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  app.post("/api/prayers/:id/comments", async (req, res) => {
    try {
      const { userId, content } = req.body;
      if (!userId || !content) {
        return res.status(400).json({ error: "userId and content are required" });
      }
      const comment = await storage.createPrayerComment(req.params.id, userId, content);
      prayerCache.invalidatePattern('prayers:');
      res.status(201).json(comment);
    } catch (error) {
      console.error("[create-prayer-comment] Error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/prayers/:id/comments/:commentId", async (req, res) => {
    try {
      await storage.deletePrayerComment(req.params.commentId);
      prayerCache.invalidatePattern('prayers:');
      res.json({ success: true });
    } catch (error) {
      console.error("[delete-prayer-comment] Error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
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

  app.patch("/api/feature-toggles/:id", async (req, res) => {
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

  app.get("/api/potential-members", async (req, res) => {
    try {
      const members = await storage.getPotentialMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to get potential members" });
    }
  });

  app.post("/api/potential-members", async (req, res) => {
    try {
      const member = await storage.upsertPotentialMember(req.body);
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

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

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

      const response = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prayerInputText }
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      });

      console.log("[PrayerMeeting] AI response received");
      const content = response.choices[0]?.message?.content;
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

  app.post("/api/card-questions", async (req, res) => {
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

  app.patch("/api/card-questions/:id", async (req, res) => {
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

  app.delete("/api/card-questions/:id", async (req, res) => {
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

  app.get("/api/message-cards/all", async (req, res) => {
    try {
      const cards = await storage.getAllMessageCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all message cards" });
    }
  });

  app.get("/api/message-card-downloads", async (req, res) => {
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
    const filename = req.params.filename;

    // Check if filename is a full URL (to handle redirected requests or database entries with full URLs)
    if (filename.startsWith('http')) {
      return res.redirect(filename);
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
  app.post("/api/message-cards/upload", uploadMessageCard.single('image'), async (req, res) => {
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
  app.delete("/api/message-cards/image/:filename", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'message-cards', req.params.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  app.post("/api/message-cards", async (req, res) => {
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

  app.patch("/api/message-cards/:id", async (req, res) => {
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

  app.delete("/api/message-cards/:id", async (req, res) => {
    try {
      await storage.deleteMessageCard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message card:", error);
      res.status(500).json({ error: "Failed to delete message card" });
    }
  });

  app.get("/api/message-card-downloads/by-card/:cardId", async (req, res) => {
    try {
      const downloads = await storage.getMessageCardDownloadsByCardId(req.params.cardId);
      res.json(downloads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get downloads" });
    }
  });

  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
        church: user.church,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  app.patch("/api/users/:id/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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
        church: church ? String(church).trim() : null,
      });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.post("/api/users/:id/avatar", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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

  app.delete("/api/users/:id/avatar", async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.updateUser(req.params.id, { avatarUrl: null });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove avatar" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/user-roles", async (req, res) => {
    try {
      const roles = await storage.getUserRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user roles" });
    }
  });

  app.put("/api/user-roles/:userId", async (req, res) => {
    try {
      const { role } = req.body;
      await storage.upsertUserRole(req.params.userId, role);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.patch("/api/potential-members/:id", async (req, res) => {
    try {
      const updated = await storage.updatePotentialMember(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Potential member not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update potential member" });
    }
  });

  app.delete("/api/potential-members/:id", async (req, res) => {
    try {
      await storage.deletePotentialMember(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete potential member" });
    }
  });

  app.get("/api/sessions/:sessionId/study-responses", async (req, res) => {
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
  app.post("/api/send-profile-notification", async (req, res) => {
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
      const allUsers = await storage.getUsers();
      const allRoles = await storage.getUserRoles();

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
          church: (u as any).church || null,
          role: roleMap.get(u.id) || 'member',
        }));

      if (role && typeof role === 'string') {
        result = result.filter(u => u.role === role);
      }
      if (church && typeof church === 'string') {
        result = result.filter(u => u.church === church);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching users for email:', error);
      res.status(500).json({ error: "Failed to fetch users" });
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
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const note = await storage.getDevotionalNote(req.params.id);
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
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const dayNumber = parseInt(req.params.dayNumber);
      const note = await storage.getDevotionalNoteByPlanDay(req.params.planId, dayNumber);
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
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const note = await storage.updateDevotionalNote(req.params.id, req.body);
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
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { hidden } = req.body;
      if (typeof hidden !== 'boolean') {
        return res.status(400).json({ error: "hidden must be a boolean" });
      }
      const note = await storage.toggleDevotionalNoteHidden(req.params.id, hidden);
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

      const { SINGLE_NOTE_SYSTEM_PROMPT, formatSingleNoteInput } = await import("./prompts/devotional-analysis");
      const userContent = formatSingleNoteInput(note);

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: SINGLE_NOTE_SYSTEM_PROMPT },
          { role: "user", content: `請整理以下靈修筆記：\n\n${userContent}` }
        ],
        max_tokens: 4000,
      });

      const result = response.choices[0]?.message?.content;
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
        const { SINGLE_NOTE_SYSTEM_PROMPT, formatSingleNoteInput } = await import("./prompts/devotional-analysis");
        const userContent = formatSingleNoteInput(notes[0]);

        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });

        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: SINGLE_NOTE_SYSTEM_PROMPT },
            { role: "user", content: `請整理以下靈修筆記：\n\n${userContent}` }
          ],
          max_tokens: 4000,
        });

        const result = response.choices[0]?.message?.content;
        return res.json({ analysis: result || '', noteCount: 1 });
      }

      const { MULTI_NOTE_SYSTEM_PROMPT, formatMultiNoteInput } = await import("./prompts/devotional-analysis");
      const userContent = formatMultiNoteInput(notes);

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: MULTI_NOTE_SYSTEM_PROMPT },
          { role: "user", content: `請整合分析以下 ${notes.length} 篇靈修筆記：\n\n${userContent}` }
        ],
        max_tokens: 8000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        return res.status(500).json({ error: "AI response empty" });
      }
      res.json({ analysis: result, noteCount: notes.length });
    } catch (error) {
      console.error('Error batch analyzing devotional notes:', error);
      res.status(500).json({ error: "Failed to batch analyze devotional notes" });
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
