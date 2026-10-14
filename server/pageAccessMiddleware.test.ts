import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import express from 'express';
import { expect, it } from 'vitest';
import { pageAccessMiddleware } from './pageAccessMiddleware';
import { persistAuthenticatedSession } from './authSessionPersistence';

async function request(url: string, options: { method?: string; identity?: 'valid' | 'expired' | 'mismatch' | 'missing'; accept?: string } = {}) {
  const app = express();
  let touched = false;
  app.use((req, _res, next) => {
    const expires_at = Math.floor(Date.now() / 1000) + (options.identity === 'expired' ? -1 : 100);
    const user = { claims: { sub: 'synthetic-user' }, expires_at };
    req.isAuthenticated = (() => !!options.identity) as typeof req.isAuthenticated;
    req.user = options.identity ? user : undefined;
    req.session = { passport: options.identity === 'missing' ? undefined : { user: { ...user, claims: { sub: options.identity === 'mismatch' ? 'another-user' : 'synthetic-user' } } }, cookie: {}, touch() { touched = true; } } as never;
    next();
  });
  app.use(pageAccessMiddleware);
  app.get('/api/private', persistAuthenticatedSession, (_req, res) => res.json({ ok: true }));
  app.get('/api/staff', (_req, res) => res.status(403).json({ error: 'Forbidden' }));
  app.use((_req, res) => res.type('html').send('<main>SPA</main>'));
  const chunks: Buffer[] = [];
  class Socket extends Duplex { _read() {} _write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } }
  const socket = new Socket();
  const req = new IncomingMessage(socket as never); req.method = options.method || 'GET'; req.url = url;
  req.headers = { host: 'synthetic.example.test', accept: options.accept || '*/*' }; req.httpVersionMajor = 1; req.httpVersionMinor = 1;
  const res = new ServerResponse(req); res.assignSocket(socket as never);
  await new Promise<void>((resolve, reject) => { res.on('finish', resolve); res.on('error', reject); (app as unknown as { handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => void }).handle(req, res, () => res.end()); });
  const body = Buffer.concat(chunks).toString().split('\r\n\r\n').slice(1).join('\r\n\r\n'); socket.destroy();
  return { status: res.statusCode, location: res.getHeader('location'), cache: res.getHeader('cache-control'), vary: res.getHeader('vary'), body, touched };
}

it.each(['/me', '/ME', '/%6de', '/me/', '/me//', '/me/activity?tab=notes', '/admin/access', '/user/notebook', '/learn/%6dy-notes', '/work/settings', '/share'])('redirects anonymous direct HTML before the SPA fallback: %s', async url => {
  const result = await request(url);
  expect(result.status).toBe(302); expect(result.cache).toBe('private, no-store'); expect(String(result.vary).split(/,\s*/)).toContain('Cookie');
  expect(new URL(String(result.location), 'https://example.test').searchParams.get('returnTo')).toBe(url); expect(result.body).not.toContain('<main>SPA'); expect(result.touched).toBe(false);
});
it('protects HEAD and requests regardless of Accept header', async () => {
  expect((await request('/me', { method: 'HEAD' })).status).toBe(302);
  expect((await request('/me', { accept: 'application/json' })).status).toBe(302);
});
it.each(['expired', 'mismatch', 'missing'] as const)('does not accept a Passport identity with %s session', async identity => expect((await request('/me', { identity })).status).toBe(302));
it('allows verified HTML without touching or rewriting authentication records', async () => {
  const result = await request('/me', { identity: 'valid' }); expect(result.status).toBe(200); expect(result.touched).toBe(false); expect(result.cache).toBe('private, no-store');
});
it.each(['/sitemap', '/help', '/login', '/reset-password', '/groups', '/groups/sample', '/feedback', '/bible', '/play', '/uploads/sample.png', '/assets/index.js'])('preserves public routes and assets: %s', async path => expect((await request(path)).status).toBe(200));
it('keeps API authentication and authorization JSON statuses instead of redirecting to HTML login', async () => {
  const anonymous = await request('/api/private'); expect(anonymous.status).toBe(401); expect(anonymous.location).toBeUndefined(); expect(JSON.parse(anonymous.body).message).toBe('Unauthorized');
  expect((await request('/api/staff', { identity: 'valid' })).status).toBe(403);
});
it.each(['/me%2factivity', '/me%5cactivity', '/%256de', '/me%00', '/me%'])('rejects ambiguous path before the HTML fallback: %s', async path => expect((await request(path)).status).toBe(400));
