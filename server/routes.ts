import type { Express } from "express";
import { storage } from "./storage";
import { insertSessionSchema, insertParticipantSchema, insertSubmissionSchema, insertPrayerSchema, insertStudyResponseSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(app: Express) {
  await setupAuth(app);
  registerAuthRoutes(app);
  app.get("/api/sessions/:shortCode", async (req, res) => {
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

  app.get("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const participants = await storage.getParticipants(req.params.sessionId);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get participants" });
    }
  });

  app.post("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const parsed = insertParticipantSchema.safeParse({ ...req.body, sessionId: req.params.sessionId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid participant data", details: parsed.error.errors });
      }
      const participant = await storage.createParticipant(parsed.data);
      res.status(201).json(participant);
    } catch (error) {
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
        return res.status(400).json({ error: "Invalid submission data", details: parsed.error.errors });
      }
      const submission = await storage.createSubmission(parsed.data);
      res.status(201).json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to create submission" });
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
      const parsed = insertPrayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prayer data", details: parsed.error.errors });
      }
      const prayer = await storage.createPrayer(parsed.data);
      res.status(201).json(prayer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create prayer" });
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

  app.get("/api/message-cards", async (req, res) => {
    try {
      const cards = await storage.getMessageCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message cards" });
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

  app.post("/api/message-cards", async (req, res) => {
    try {
      const card = await storage.createMessageCard(req.body);
      res.status(201).json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to create message card" });
    }
  });

  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}
