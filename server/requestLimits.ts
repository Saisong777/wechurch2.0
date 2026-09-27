import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';

export function clientAddress(req: Request): string {
  const railway = process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
  const ingress = railway ? req.get('x-real-ip')?.trim() : undefined;
  const value = ingress && isIP(ingress) ? ingress : req.socket.remoteAddress || 'unknown';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

export function boundedWindowLimiter(options: {
  max: number; windowMs?: number; maxKeys?: number; key: (req: Request) => string;
}): RequestHandler {
  const windowMs = options.windowMs || 60_000;
  const maxKeys = options.maxKeys || 20_000;
  const max = Number.isFinite(options.max) && options.max > 0 ? Math.floor(options.max) : 200;
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
    if (!entry && entries.size >= maxKeys) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    if (!entry) { entry = { count: 0, until: now + windowMs }; entries.set(key, entry); }
    entry.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entry.until - now) / 1000)));
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

export function apiIdentity(req: Request): string {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  if (user?.claims?.sub) return `account:${user.claims.sub}`;
  if ((req.session as unknown as { soulGymJoined?: boolean })?.soulGymJoined) return `guest:${req.sessionID}`;
  return `address:${clientAddress(req)}`;
}
