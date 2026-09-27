import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { boundedWindowLimiter, clientAddress } from './requestLimits';

type Env = Record<string, string | undefined>;

export function trustedAuthJson(env: Env = process.env): RequestHandler {
  return (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ message: 'JSON required' });
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    let trusted = false;
    try {
      const configured = env.PUBLIC_BASE_URL || (env.NODE_ENV === 'production' ? 'https://www.wechurch.online' : undefined);
      if (origin && origin !== 'null' && (!fetchSite || fetchSite === 'same-origin')) {
        const url = new URL(origin);
        if (url.origin === origin && !url.username && !url.password) {
          if (configured) {
            const base = new URL(configured);
            const localTest = ['development', 'test'].includes(env.NODE_ENV || '')
              && !env.RAILWAY_ENVIRONMENT_ID && !env.RAILWAY_ENVIRONMENT_NAME
              && base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
            trusted = base.origin === origin && !base.username && !base.password
              && (base.protocol === 'https:' || localTest);
          } else if (env.NODE_ENV === 'development' && !env.RAILWAY_ENVIRONMENT_ID && !env.RAILWAY_ENVIRONMENT_NAME) {
            // Local development remains usable without trusting arbitrary Host/forwarding headers.
            trusted = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
              && url.host === req.get('host')
              && Number(url.port || 80) === req.socket.localPort;
          }
        }
      }
    } catch { /* Invalid configuration or Origin fails closed. */ }
    if (!trusted) return res.status(403).json({ message: 'Untrusted request origin' });
    next();
  };
}

export function authAttemptLimits(maxAccountAttempts = 10, identityKind: 'email' | 'token' = 'email'): RequestHandler[] {
  return [
    boundedWindowLimiter({ max: 100, windowMs: 15 * 60 * 1000, maxKeys: 10_000, key: clientAddress }),
    boundedWindowLimiter({
      max: maxAccountAttempts, windowMs: 15 * 60 * 1000, maxKeys: 10_000,
      key: req => {
        const email = req.body?.email;
        const token = req.method === 'GET' ? req.query?.token : req.body?.token;
        const identity = identityKind === 'email' && typeof email === 'string' ? `email:${email.trim().toLowerCase()}`
          : identityKind === 'token' && typeof token === 'string' ? `token:${token}` : 'invalid';
        return createHash('sha256').update(identity).digest('hex');
      },
    }),
  ];
}

export function boundedFailedAuthLimiter(options: {
  max: number; key: (req: Request) => string; windowMs?: number; maxKeys?: number;
}): RequestHandler {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxKeys = options.maxKeys ?? 10_000;
  const entries = new Map<string, { count: number; until: number }>();
  let nextSweep = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
      nextSweep = now + windowMs;
    }
    const key = options.key(req);
    let entry = entries.get(key);
    if (entry && entry.until <= now) { entries.delete(key); entry = undefined; }
    if ((!entry && entries.size >= maxKeys) || (entry && entry.count >= options.max)) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(((entry?.until ?? now + windowMs) - now) / 1000)));
      res.status(429).json({ message: 'Too many failed authentication attempts. Please try again later.' });
      return;
    }
    if (!entry) { entry = { count: 0, until: now + windowMs }; entries.set(key, entry); }
    const reservation = entry;
    reservation.count++;
    // Reserve before work to prevent parallel bypass. Aborted requests do not earn a refund.
    res.once('finish', () => {
      if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode >= 500) {
        reservation.count--;
        // A late response must never delete or decrement a newer window's entry.
        if (reservation.count === 0 && entries.get(key) === reservation) entries.delete(key);
      }
    });
    next();
  };
}

export function authLoginLimits(): RequestHandler[] {
  return [
    boundedWindowLimiter({ max: 1000, windowMs: 60_000, maxKeys: 10_000, key: clientAddress }),
    boundedFailedAuthLimiter({ max: 100, key: clientAddress }),
    boundedFailedAuthLimiter({
      max: 10,
      key: req => createHash('sha256').update(typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase() : 'invalid').digest('hex'),
    }),
  ];
}
