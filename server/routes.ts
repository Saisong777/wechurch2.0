import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { insertSessionSchema, insertParticipantSchema, insertSubmissionSchema, insertPrayerSchema, insertStudyResponseSchema, insertSavedVerseSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { pool, getPoolStats } from "./db";
import { bibleCache, timelineCache, apiCache } from "./cache";

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
  // Register health check FIRST - before any auth setup that might fail
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB"
      }
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
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      await storage.deleteSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.get("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const participants = await storage.getParticipants(req.params.sessionId);
      res.json(participants);
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
        const insights = responses.map(r => r.coreInsightNote).filter(Boolean);
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
        
        if (insights.length > 0) {
          content += `**💡 獨特亮光（Unique Insights）：**\n`;
          insights.slice(0, 5).forEach(i => { content += `• ${i}\n`; });
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

  app.get("/api/study-responses/:sessionId/:participantId", async (req, res) => {
    try {
      const response = await storage.getStudyResponse(req.params.sessionId, req.params.participantId);
      res.json(response || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study response" });
    }
  });

  app.post("/api/study-responses", async (req, res) => {
    try {
      const response = await storage.upsertStudyResponse(req.body);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to save study response" });
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
      const prayers = await storage.getPrayers();
      res.json(prayers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prayers" });
    }
  });

  app.post("/api/prayers", async (req, res) => {
    try {
      const prayer = await storage.createPrayer(req.body);
      res.status(201).json(prayer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create prayer" });
    }
  });

  app.patch("/api/prayers/:id", async (req, res) => {
    try {
      const prayer = await storage.updatePrayer(req.params.id, req.body);
      if (!prayer) {
        return res.status(404).json({ error: "Prayer not found" });
      }
      res.json(prayer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update prayer" });
    }
  });

  app.delete("/api/prayers/:id", async (req, res) => {
    try {
      await storage.deletePrayer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete prayer" });
    }
  });

  app.post("/api/prayers/:id/amen", async (req, res) => {
    try {
      const amen = await storage.createPrayerAmen(req.params.id, req.body.userId);
      res.status(201).json(amen);
    } catch (error) {
      console.error("[create-prayer-amen] Error:", error);
      res.status(500).json({ error: "Failed to add amen" });
    }
  });

  app.get("/api/feature-toggles", async (req, res) => {
    try {
      const toggles = await storage.getFeatureToggles();
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
    try {
      const game = await storage.createIcebreakerGame(req.body);
      res.status(201).json(game);
    } catch (error) {
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
      const shortCode = req.body.shortCode || Math.random().toString(36).substring(2, 8).toUpperCase();
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

  // Bulk email endpoint using Resend integration
  app.post("/api/send-bulk-email", async (req, res) => {
    try {
      const { recipients, subject, body, isHtml } = req.body;
      
      const { sendBulkEmail } = await import('./resend');
      
      const result = await sendBulkEmail(recipients, subject, body, isHtml !== false);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error sending bulk email:', error);
      res.status(500).json({ error: "Failed to send emails", message: error.message });
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
