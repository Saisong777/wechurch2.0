import crypto from "node:crypto";
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { appErrorEvents, appEvents } from "@shared/schema";
import { scrubTelemetryText, telemetryMetadata, telemetryPath } from '@shared/telemetryPrivacy';

type JsonRecord = Record<string, unknown>;

export async function getPlatformSummary() {
  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
  const events = await db.execute(sql`
    SELECT event_name, COUNT(*)::int AS count,
           SUM(COUNT(*)) OVER ()::int AS total_count
    FROM app_events
    WHERE created_at >= ${since} AND created_at < ${until}
    GROUP BY event_name
    ORDER BY count DESC, event_name
    LIMIT 20
  `);
  const errors = await db.execute(sql`
    SELECT source, COALESCE(status_code, 0) AS status_code, path,
           COUNT(*)::int AS count, MAX(created_at) AS last_seen,
           SUM(COUNT(*)) OVER ()::int AS total_count
    FROM app_error_events
    WHERE created_at >= ${since} AND created_at < ${until}
    GROUP BY source, status_code, path
    ORDER BY last_seen DESC, source, status_code, path
    LIMIT 20
  `);
  return {
    since: since.toISOString(), until: until.toISOString(),
    totalEvents: Number(events.rows[0]?.total_count || 0),
    totalErrors: Number(errors.rows[0]?.total_count || 0),
    events: events.rows.map(({ total_count, ...row }) => row),
    errors: errors.rows.map(({ total_count, ...row }) => row),
  };
}

function hashIp(ip?: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(`${ip}:${process.env.SESSION_SECRET || "local"}`).digest("hex").slice(0, 24);
}

export function requestContext(req: Request) {
  const body = req.body || {};
  const query = req.query || {};
  const user = req.user as { claims?: { email?: string; sub?: string } } | undefined;
  return {
    path: telemetryPath(req.originalUrl || req.path),
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
      eventName: scrubTelemetryText(input.eventName, 100),
      source: scrubTelemetryText(input.source || "server", 100),
      path: telemetryPath(input.path),
      sessionId: input.sessionId || null,
      participantId: input.participantId || null,
      userEmail: input.userEmail || null,
      metadata: telemetryMetadata(input.metadata),
      userAgent: scrubTelemetryText(input.userAgent, 500) || null,
      ipHash: input.ipHash || null,
    });
  } catch (error) {
    console.error("[observability] failed to record app event");
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
      source: scrubTelemetryText(input.source || "server", 100),
      level: scrubTelemetryText(input.level || "error", 100),
      message: scrubTelemetryText(input.message),
      stack: scrubTelemetryText(input.stack, 6000) || null,
      path: telemetryPath(input.path),
      method: scrubTelemetryText(input.method, 20) || null,
      statusCode: input.statusCode || null,
      sessionId: input.sessionId || null,
      participantId: input.participantId || null,
      metadata: telemetryMetadata(input.metadata),
      userAgent: scrubTelemetryText(input.userAgent, 500) || null,
      ipHash: input.ipHash || null,
    });
  } catch (error) {
    console.error("[observability] failed to record error event");
  }
}
