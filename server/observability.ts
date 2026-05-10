import crypto from "node:crypto";
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { aiUsageEvents, appErrorEvents, appEvents } from "@shared/schema";

type JsonRecord = Record<string, unknown>;

function hashIp(ip?: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(`${ip}:${process.env.SESSION_SECRET || "local"}`).digest("hex").slice(0, 24);
}

function compactMetadata(value?: JsonRecord | null): JsonRecord | null {
  if (!value) return null;
  const json = JSON.stringify(value);
  if (json.length <= 3000) return value;
  return { truncated: true, preview: json.slice(0, 3000) };
}

export function requestContext(req: Request) {
  const body = req.body || {};
  const query = req.query || {};
  const user = req.user as { claims?: { email?: string; sub?: string } } | undefined;
  return {
    path: req.originalUrl?.split("?")[0] || req.path,
    method: req.method,
    userAgent: req.get("user-agent") || null,
    ipHash: hashIp(req.ip),
    userEmail: typeof body.email === "string"
      ? body.email
      : typeof query.email === "string"
        ? query.email
        : user?.claims?.email || null,
    sessionId: typeof body.sessionId === "string"
      ? body.sessionId
      : typeof req.params?.sessionId === "string"
        ? req.params.sessionId
        : typeof query.sessionId === "string"
          ? query.sessionId
          : null,
    participantId: typeof body.participantId === "string"
      ? body.participantId
      : typeof query.participantId === "string"
        ? query.participantId
        : null,
  };
}

export async function recordAppEvent(input: {
  eventName: string;
  source?: string;
  path?: string | null;
  sessionId?: string | null;
  participantId?: string | null;
  userEmail?: string | null;
  metadata?: JsonRecord | null;
  userAgent?: string | null;
  ipHash?: string | null;
}) {
  try {
    await db.insert(appEvents).values({
      eventName: input.eventName,
      source: input.source || "server",
      path: input.path || null,
      sessionId: input.sessionId || null,
      participantId: input.participantId || null,
      userEmail: input.userEmail || null,
      metadata: compactMetadata(input.metadata),
      userAgent: input.userAgent || null,
      ipHash: input.ipHash || null,
    });
  } catch (error) {
    console.error("[observability] failed to record app event:", error);
  }
}

export async function recordErrorEvent(input: {
  source?: string;
  level?: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  sessionId?: string | null;
  participantId?: string | null;
  metadata?: JsonRecord | null;
  userAgent?: string | null;
  ipHash?: string | null;
}) {
  try {
    await db.insert(appErrorEvents).values({
      source: input.source || "server",
      level: input.level || "error",
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 6000) || null,
      path: input.path || null,
      method: input.method || null,
      statusCode: input.statusCode || null,
      sessionId: input.sessionId || null,
      participantId: input.participantId || null,
      metadata: compactMetadata(input.metadata),
      userAgent: input.userAgent || null,
      ipHash: input.ipHash || null,
    });
  } catch (error) {
    console.error("[observability] failed to record error event:", error);
  }
}

export async function recordAiUsage(input: {
  provider: string;
  model: string;
  feature: string;
  reportType?: string | null;
  sessionId?: string | null;
  reportId?: string | null;
  groupNumber?: number | null;
  inputChars?: number;
  outputChars?: number;
  latencyMs?: number;
  status: string;
  finishReason?: string | null;
  qualityScore?: number | null;
  retryCount?: number;
  errorMessage?: string | null;
}) {
  try {
    const inputChars = input.inputChars || 0;
    const outputChars = input.outputChars || 0;
    await db.insert(aiUsageEvents).values({
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      reportType: input.reportType || null,
      sessionId: input.sessionId || null,
      reportId: input.reportId || null,
      groupNumber: input.groupNumber ?? null,
      inputChars,
      outputChars,
      latencyMs: input.latencyMs || 0,
      status: input.status,
      finishReason: input.finishReason || null,
      qualityScore: input.qualityScore ?? null,
      retryCount: input.retryCount || 0,
      estimatedCostUnits: Math.ceil(inputChars / 1000) + Math.ceil(outputChars / 1000),
      errorMessage: input.errorMessage?.slice(0, 1000) || null,
    });
  } catch (error) {
    console.error("[observability] failed to record ai usage:", error);
  }
}

export function scoreAiReportQuality(content: string) {
  let score = 0;
  if (content.length > 400) score += 20;
  if (content.length > 1200) score += 15;
  if (/共同觀察|全體觀察|經文觀察/.test(content)) score += 15;
  if (/神學|亮光|領受/.test(content)) score += 15;
  if (/行動|操練|應用/.test(content)) score += 15;
  if (/一句話|總結|帶走/.test(content)) score += 10;
  if (/第\s*\d+\s*組|全體|全會眾/.test(content)) score += 10;
  return Math.min(100, score);
}

export async function getPlatformSummary() {
  const [events, errors, aiUsage] = await Promise.all([
    db.execute(sql`
      SELECT event_name, COUNT(*)::int AS count
      FROM app_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_name
      ORDER BY count DESC
      LIMIT 20
    `),
    db.execute(sql`
      SELECT source, COALESCE(status_code, 0) AS status_code, COUNT(*)::int AS count
      FROM app_error_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY source, status_code
      ORDER BY count DESC
      LIMIT 20
    `),
    db.execute(sql`
      SELECT feature, model, status, COUNT(*)::int AS count,
             COALESCE(ROUND(AVG(quality_score)), 0)::int AS avg_quality,
             COALESCE(SUM(estimated_cost_units), 0)::int AS cost_units
      FROM ai_usage_events
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY feature, model, status
      ORDER BY count DESC
      LIMIT 20
    `),
  ]);

  return {
    events: events.rows,
    errors: errors.rows,
    aiUsage: aiUsage.rows,
  };
}
