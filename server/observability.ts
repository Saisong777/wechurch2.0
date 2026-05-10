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

function toNumber(value: unknown) {
  return Number(value || 0);
}

function scoreStatus(score: number) {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "needs_work";
}

export async function getProductGrowthBrief() {
  const [funnel, soulgym, wholeApp, reliability, aiUsage] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int AS events_7d,
        COUNT(DISTINCT COALESCE(ip_hash, user_email, session_id::text, participant_id::text))::int AS visitors_7d,
        COUNT(*) FILTER (WHERE event_name = 'page_view' AND path = '/')::int AS home_views_7d,
        COUNT(*) FILTER (WHERE event_name = 'page_view' AND path LIKE '/user%')::int AS soulgym_views_7d,
        COUNT(*) FILTER (WHERE event_name = 'page_view' AND path LIKE '/learn%')::int AS learn_views_7d,
        COUNT(*) FILTER (WHERE event_name = 'page_view' AND path LIKE '/pray%')::int AS prayer_views_7d,
        COUNT(*) FILTER (WHERE event_name = 'page_view' AND path LIKE '/admin%')::int AS admin_views_7d
      FROM app_events
      WHERE created_at > NOW() - INTERVAL '7 days'
    `),
    db.execute(sql`
      WITH recent_sessions AS (
        SELECT id, status, created_at
        FROM sessions
        WHERE created_at > NOW() - INTERVAL '30 days'
      ),
      recent_participants AS (
        SELECT p.*
        FROM participants p
        INNER JOIN recent_sessions s ON s.id = p.session_id
      ),
      meaningful_study AS (
        SELECT sr.*
        FROM study_responses sr
        INNER JOIN recent_sessions s ON s.id = sr.session_id
        WHERE COALESCE(NULLIF(TRIM(sr.observation), ''), NULLIF(TRIM(sr.core_insight_note), ''), NULLIF(TRIM(sr.action_plan), '')) IS NOT NULL
          AND sr.hidden = FALSE
      )
      SELECT
        (SELECT COUNT(*)::int FROM recent_sessions) AS sessions_30d,
        (SELECT COUNT(*)::int FROM recent_sessions WHERE status = 'completed') AS completed_sessions_30d,
        (SELECT COUNT(*)::int FROM recent_participants) AS participants_30d,
        (SELECT COUNT(*)::int FROM recent_participants WHERE group_number IS NOT NULL) AS grouped_participants_30d,
        (SELECT COUNT(*)::int FROM recent_participants WHERE ready_confirmed = TRUE) AS ready_participants_30d,
        (SELECT COUNT(*)::int FROM meaningful_study) AS meaningful_study_30d,
        (SELECT COUNT(*)::int FROM ai_reports ar INNER JOIN recent_sessions s ON s.id = ar.session_id) AS ai_reports_30d
    `),
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM prayers WHERE created_at > NOW() - INTERVAL '30 days') AS prayers_30d,
        (SELECT COUNT(*)::int FROM prayer_amens WHERE created_at > NOW() - INTERVAL '30 days') AS prayer_amens_30d,
        (SELECT COUNT(*)::int FROM devotional_notes WHERE created_at > NOW() - INTERVAL '30 days') AS devotional_notes_30d,
        (SELECT COUNT(*)::int FROM saved_verses WHERE created_at > NOW() - INTERVAL '30 days') AS saved_verses_30d,
        (SELECT COUNT(*)::int FROM user_reading_plans WHERE created_at > NOW() - INTERVAL '30 days') AS reading_plans_30d
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS errors_7d,
        COUNT(*) FILTER (WHERE status_code >= 500)::int AS server_errors_7d,
        COUNT(*) FILTER (WHERE source = 'client')::int AS client_errors_7d
      FROM app_error_events
      WHERE created_at > NOW() - INTERVAL '7 days'
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS ai_runs_30d,
        COUNT(*) FILTER (WHERE status <> 'COMPLETED')::int AS ai_failures_30d,
        COALESCE(ROUND(AVG(quality_score)), 0)::int AS avg_quality_30d,
        COALESCE(SUM(estimated_cost_units), 0)::int AS cost_units_30d,
        COALESCE(ROUND(AVG(latency_ms)), 0)::int AS avg_latency_ms_30d
      FROM ai_usage_events
      WHERE created_at > NOW() - INTERVAL '30 days'
    `),
  ]);

  const funnelRow = funnel.rows[0] || {};
  const soulgymRow = soulgym.rows[0] || {};
  const wholeAppRow = wholeApp.rows[0] || {};
  const reliabilityRow = reliability.rows[0] || {};
  const aiRow = aiUsage.rows[0] || {};

  const participants30d = toNumber(soulgymRow.participants_30d);
  const meaningfulStudy30d = toNumber(soulgymRow.meaningful_study_30d);
  const groupedParticipants30d = toNumber(soulgymRow.grouped_participants_30d);
  const readyParticipants30d = toNumber(soulgymRow.ready_participants_30d);
  const sessions30d = toNumber(soulgymRow.sessions_30d);
  const aiRuns30d = toNumber(aiRow.ai_runs_30d);
  const aiFailures30d = toNumber(aiRow.ai_failures_30d);
  const errors7d = toNumber(reliabilityRow.errors_7d);
  const studyCompletionRate = participants30d > 0 ? Math.round((meaningfulStudy30d / participants30d) * 100) : 0;
  const groupingRate = participants30d > 0 ? Math.round((groupedParticipants30d / participants30d) * 100) : 0;
  const readyRate = participants30d > 0 ? Math.round((readyParticipants30d / participants30d) * 100) : 0;
  const avgParticipantsPerSession = sessions30d > 0 ? Math.round((participants30d / sessions30d) * 10) / 10 : 0;
  const aiFailureRate = aiRuns30d > 0 ? Math.round((aiFailures30d / aiRuns30d) * 100) : 0;
  const aiQuality = toNumber(aiRow.avg_quality_30d);
  const engagementActions = toNumber(wholeAppRow.prayers_30d)
    + toNumber(wholeAppRow.prayer_amens_30d)
    + toNumber(wholeAppRow.devotional_notes_30d)
    + toNumber(wholeAppRow.saved_verses_30d)
    + toNumber(wholeAppRow.reading_plans_30d);

  const activationScore = Math.min(100, Math.round(studyCompletionRate * 0.45 + groupingRate * 0.25 + readyRate * 0.2 + Math.min(avgParticipantsPerSession * 2, 10)));
  const engagementScore = Math.min(100, Math.round(Math.min(engagementActions, 120) / 1.2));
  const aiScore = aiRuns30d === 0 ? 45 : Math.max(0, Math.min(100, aiQuality - aiFailureRate * 2));
  const reliabilityScore = Math.max(0, Math.min(100, 100 - errors7d * 8));
  const productScore = Math.round(activationScore * 0.35 + engagementScore * 0.2 + aiScore * 0.25 + reliabilityScore * 0.2);

  const recommendations: Array<{
    priority: "high" | "medium" | "low";
    area: string;
    title: string;
    reason: string;
    nextStep: string;
  }> = [];

  if (sessions30d === 0) {
    recommendations.push({
      priority: "high",
      area: "SoulGym",
      title: "先累積一場真實查經資料",
      reason: "目前 30 天內沒有 SoulGym 場次，產品無法從真實流程學習。",
      nextStep: "用下次週三查經跑完整流程，會後看完成率、AI 品質和錯誤紀錄。",
    });
  } else if (studyCompletionRate < 65) {
    recommendations.push({
      priority: "high",
      area: "SoulGym",
      title: "降低三步驟查經完成門檻",
      reason: `近 30 天有效查經完成率約 ${studyCompletionRate}%，代表有人進到流程但沒有留下可用內容。`,
      nextStep: "把每一步提示改成更短、更像手機填答，並在主持台標示哪些小組需要協助。",
    });
  }

  if (engagementActions < 20) {
    recommendations.push({
      priority: "medium",
      area: "週間留存",
      title: "建立聚會後的下一步",
      reason: "讀經、禱告、收藏與靈修筆記的 30 天互動量偏低，使用者可能只在活動當晚打開。",
      nextStep: "在 AI 報告結尾產生 3 個本週行動，連到禱告牆、讀經和個人筆記。",
    });
  }

  if (aiRuns30d === 0 || aiQuality < 70 || aiFailureRate > 0) {
    recommendations.push({
      priority: aiFailureRate > 0 ? "high" : "medium",
      area: "AI 成果",
      title: "讓 AI 報告更像可帶走的牧養成果",
      reason: aiRuns30d === 0
        ? "目前還沒有近 30 天 AI 生成紀錄，無法量化品質與成本。"
        : `AI 平均品質 ${aiQuality || 0}，失敗率 ${aiFailureRate}%。`,
      nextStep: "持續保存輸入量、輸出量、重試次數與品質分，讓每次生成都能被比較和調整。",
    });
  }

  if (errors7d > 0) {
    recommendations.push({
      priority: "high",
      area: "穩定度",
      title: "先處理近期錯誤",
      reason: `最近 7 天紀錄到 ${errors7d} 筆錯誤，真實聚會時會直接影響信任感。`,
      nextStep: "每次聚會前打開平台成熟度面板，確認錯誤量是否歸零或可解釋。",
    });
  }

  recommendations.push({
    priority: "low",
    area: "成長策略",
    title: "把 WeChurch 定位成查經後的屬靈健身紀錄",
    reason: "市場上的教會工具多半是管理系統，差異化應放在一起查經、AI 整理、個人持續操練。",
    nextStep: "首頁與報告頁要持續強化一句話定位：一起查經，留下成果，週間繼續操練。",
  });

  return {
    productScore,
    status: scoreStatus(productScore),
    metrics: {
      funnel: funnelRow,
      soulgym: {
        ...soulgymRow,
        study_completion_rate: studyCompletionRate,
        grouping_rate: groupingRate,
        ready_rate: readyRate,
        avg_participants_per_session: avgParticipantsPerSession,
      },
      wholeApp: {
        ...wholeAppRow,
        engagement_actions_30d: engagementActions,
      },
      reliability: {
        ...reliabilityRow,
        reliability_score: reliabilityScore,
      },
      ai: {
        ...aiRow,
        ai_failure_rate: aiFailureRate,
      },
      scores: {
        activation: activationScore,
        engagement: engagementScore,
        ai: aiScore,
        reliability: reliabilityScore,
      },
    },
    marketSignals: [
      "手機優先：教會網站與活動入口要以手機掃碼、少教學、少輸入為核心。",
      "領袖省時間：系統要減少主持人切頁、重複整理和會後手動追蹤。",
      "AI 可交付：AI 不只是聊天，而是把查經內容整理成小組可讀、全體可帶走的成果。",
      "週間延伸：使用者不會因為有 App 就回來，必須連到讀經、禱告、筆記和下一步操練。",
    ],
    recommendations: recommendations.slice(0, 5),
  };
}
