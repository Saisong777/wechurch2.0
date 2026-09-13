import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

type Env = NodeJS.ProcessEnv;
export function isTestDeployment(env: Env = process.env) {
  return env.APP_ENV === 'staging' || Boolean(env.RAILWAY_ENVIRONMENT_NAME && env.RAILWAY_ENVIRONMENT_NAME !== 'production');
}

export function assertDeploymentSafety(env: Env = process.env) {
  if (!isTestDeployment(env)) return;
  if (env.NODE_ENV !== 'production') throw new Error('Staging requires production runtime; dev login must stay disabled.');
  if (!env.STAGING_ACCESS_CODE || env.STAGING_ACCESS_CODE.length < 16) throw new Error('Staging requires an invitation code of at least 16 characters.');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Staging requires an independent session secret.');
  if (env.LOCAL_INSECURE_COOKIES === '1') throw new Error('Insecure local cookies are forbidden on staging.');
  const origin = new URL(env.PUBLIC_BASE_URL || '');
  if (origin.protocol !== 'https:' || ['wechurch.online', 'www.wechurch.online'].includes(origin.hostname)) throw new Error('Staging requires its own HTTPS origin.');
  if (env.RAILWAY_ENVIRONMENT_NAME === 'production') throw new Error('Staging cannot run in the production environment.');
  if (env.RAILWAY_ENVIRONMENT_ID && env.RAILWAY_ENVIRONMENT_ID !== env.STAGING_EXPECTED_ENVIRONMENT_ID) throw new Error('Staging environment identity mismatch.');
  const database = new URL(env.DATABASE_URL || '');
  if (!env.STAGING_EXPECTED_DB_HOST || database.hostname !== env.STAGING_EXPECTED_DB_HOST) throw new Error('Staging database host mismatch.');
  if (env.RAILWAY_ENVIRONMENT_ID && (!env.UPLOAD_ROOT || env.UPLOAD_ROOT !== env.RAILWAY_VOLUME_MOUNT_PATH)) throw new Error('Staging uploads require a dedicated mounted volume.');
}

export function assertOutboundEmailAllowed() {
  if (isTestDeployment() || process.env.DISABLE_OUTBOUND_EMAIL === '1') throw new Error('EMAIL_DISABLED_IN_TEST_ENVIRONMENT');
}

const digest = (value: string) => createHash('sha256').update(value).digest();
const equal = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
export function stagingTicket(code: string, now = Date.now()) {
  const expiry = String(now + 30 * 86400_000);
  return `${expiry}.${createHmac('sha256', code).update(`staging:${expiry}`).digest('hex')}`;
}
export function validStagingTicket(ticket: string, code: string, now = Date.now()) {
  const [expiry, signature, extra] = ticket.split('.');
  if (extra || !/^\d{13}$/.test(expiry || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  if (+expiry <= now || +expiry > now + 30 * 86400_000) return false;
  return equal(signature, createHmac('sha256', code).update(`staging:${expiry}`).digest('hex'));
}

function invitationPage(error = '') {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>WeChurch B 測試站</title><style>body{margin:0;background:#f4f7f8;color:#203638;font:16px system-ui;letter-spacing:0}main{max-width:380px;margin:15vh auto;padding:24px}h1{font-size:26px}label{display:block;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;border-radius:6px}input{border:1px solid #7b9196;background:white}button{margin-top:16px;border:0;background:#176c60;color:white;cursor:pointer}p{line-height:1.7}small{color:#536668}.error{color:#b42336}</style></head><body><main><small>WECHURCH / B 測試站</small><h1>歡迎一起測試</h1><p>這裡使用獨立測試資料。<br>請勿填寫真實的牧養隱私或個人代禱。</p><form method="post" action="/__staging/access"><label for="code">測試邀請碼</label><input id="code" name="code" type="password" autocomplete="current-password" required maxlength="256"><p class="error" role="alert">${error}</p><button type="submit">進入測試站</button></form></main></body></html>`;
}

export function stagingAccessGate(env: Env = process.env): RequestHandler {
  const attempts = new Map<string, { count: number; until: number }>();
  let globalAttempts = { count: 0, until: 0 };
  return (req, res, next) => {
    if (!isTestDeployment(env)) return next();
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.set('Cache-Control', 'private, no-store');
    if (req.path === '/__healthcheck' && req.method === 'GET') return next();
    if (req.path === '/robots.txt' && req.method === 'GET') return res.type('text').send('User-agent: *\nDisallow: /\n');
    const code = env.STAGING_ACCESS_CODE;
    if (!code || code.length < 16) return res.status(503).send('測試站尚未開放。');
    if (req.path === '/__staging/access' && req.method === 'POST') {
      if (req.get('origin') !== new URL(env.PUBLIC_BASE_URL!).origin) return res.status(403).send('請從測試站輸入邀請碼。');
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      const ip = req.ip || 'unknown';
      const attempt = attempts.get(ip) || { count: 0, until: now + 15 * 60_000 };
      if (globalAttempts.until <= now) globalAttempts = { count: 0, until: now + 15 * 60_000 };
      if (++attempt.count > 10 || ++globalAttempts.count > 300) return res.status(429).type('html').send(invitationPage('嘗試次數過多，請稍後再試。'));
      attempts.set(ip, attempt);
      if (typeof req.body?.code !== 'string' || !equal(req.body.code, code)) return res.status(401).type('html').send(invitationPage('邀請碼不正確，請再確認。'));
      attempts.delete(ip);
      res.cookie('__Host-wechurch-staging', stagingTicket(code), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400_000 });
      return res.redirect(303, '/');
    }
    const ticket = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('__Host-wechurch-staging='))?.slice('__Host-wechurch-staging='.length) || '';
    if (!validStagingTicket(ticket, code)) {
      if (req.path.startsWith('/api/') || req.method !== 'GET') return res.status(401).json({ error: '請先輸入測試邀請碼。', code: 'STAGING_ACCESS_REQUIRED' });
      return res.status(401).type('html').send(invitationPage());
    }
    if (req.path === '/api/dev-login' || req.path === '/api/login' || req.path === '/api/callback' || req.path.startsWith('/api/line-login') || req.path.startsWith('/api/cron/') || req.path.includes('webhook')) return res.status(403).json({ error: '測試站未開放此整合。' });
    next();
  };
}
