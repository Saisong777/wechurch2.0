import type { RequestHandler } from 'express';

const thresholds = { loginFailures: 30, forbidden: 30, rateLimited: 20, serverErrors: 10 } as const;
type Signal = keyof typeof thresholds;
export type SecuritySummary = { windowStartedAt: string; windowSeconds: number; counts: Record<Signal, number>; triggered: Signal[] };
const empty = (): Record<Signal, number> => ({ loginFailures: 0, forbidden: 0, rateLimited: 0, serverErrors: 0 });

/** Fixed-size, per-process counters: no IP/email/body/query storage and no per-request DB writes. */
export function createSecuritySignals(emit: (summary: SecuritySummary) => void, now = Date.now) {
  let started = now();
  let counts = empty();
  function flush() {
    const time = now();
    if (time - started < 60000) return;
    const snapshot = counts;
    const previousStart = started;
    counts = empty();
    started = time;
    const triggered = (Object.keys(thresholds) as Signal[]).filter(key => snapshot[key] >= thresholds[key]);
    if (triggered.length) emit({ windowStartedAt: new Date(previousStart).toISOString(), windowSeconds: Math.round((time - previousStart) / 1000), counts: snapshot, triggered });
  }
  function observe(method: string, pathname: string, status: number) {
    flush();
    let signal: Signal | undefined;
    if (status >= 500) signal = 'serverErrors';
    else if (status === 429) signal = 'rateLimited';
    else if (status === 403) signal = 'forbidden';
    else if (status === 401 && method === 'POST' && ['/api/auth/email-login', '/__staging/access'].includes(pathname)) signal = 'loginFailures';
    if (signal) counts[signal] = Math.min(counts[signal] + 1, Number.MAX_SAFE_INTEGER);
  }
  const middleware: RequestHandler = (req, res, next) => {
    res.once('finish', () => observe(req.method, req.path, res.statusCode));
    next();
  };
  return { observe, flush, middleware };
}

export function securitySummaryMessage(summary: SecuritySummary): string {
  const names: Record<Signal, string> = { loginFailures: '登入失敗', forbidden: '權限拒絕', rateLimited: '流量限制', serverErrors: '伺服器錯誤' };
  return `安全監測（${summary.windowSeconds} 秒）：${summary.triggered.map(key => `${names[key]} ${summary.counts[key]} 次`).join('、')}。這是異常訊號，不代表已被入侵。`;
}
