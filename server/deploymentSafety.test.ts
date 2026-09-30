import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { assertDeploymentSafety, assertOutboundEmailAllowed, isTestDeployment, stagingAccessGate, stagingTicket, validStagingTicket } from './deploymentSafety';

const env = { APP_ENV: 'staging', NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://test.example.com', STAGING_ACCESS_CODE: 'invited-testing-only-123456', SESSION_SECRET: 'a'.repeat(64), DATABASE_URL: 'postgresql://user:pass@test-db.railway.internal/railway', STAGING_EXPECTED_DB_HOST: 'test-db.railway.internal' };
afterEach(() => vi.unstubAllEnvs());

describe('deployment safety', () => {
  it('opens only Google routes for invited B users when separately configured', async () => {
    const googleEnv = { ...env, GOOGLE_CLIENT_ID: 'b-client', GOOGLE_CLIENT_SECRET: 'b-secret',
      STAGING_GOOGLE_CLIENT_ID: 'b-client', STAGING_GOOGLE_LOGIN_ENABLED: '1', AUTH_REGISTRATION_MODE: 'google-only' };
    expect(() => assertDeploymentSafety(googleEnv)).not.toThrow();
    expect(() => assertDeploymentSafety({ ...googleEnv, GOOGLE_CLIENT_SECRET: '' })).toThrow(/Google/);
    const app = express();
    app.use(stagingAccessGate(googleEnv));
    app.use((_req, res) => res.json({ allowed: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const headers = { Cookie: `__Host-wechurch-staging=${stagingTicket(env.STAGING_ACCESS_CODE)}` };
      for (const path of ['/api/login', '/api/callback', '/api/auth/options']) {
        expect((await fetch(base + path)).status).toBe(401);
        expect((await fetch(base + path, { headers })).status).toBe(200);
      }
      for (const path of ['/api/dev-login', '/api/cron/daily-follow-email', '/api/webhooks/resend']) {
        expect((await fetch(base + path, { headers })).status).toBe(403);
      }
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('fails closed on insecure staging or production targets', () => {
    expect(() => assertDeploymentSafety(env)).not.toThrow();
    for (const patch of [{ NODE_ENV: 'development' }, { LOCAL_INSECURE_COOKIES: '1' }, { STAGING_ACCESS_CODE: '' }, { SESSION_SECRET: '' }, { PUBLIC_BASE_URL: 'https://wechurch.online' }, { STAGING_EXPECTED_DB_HOST: 'production-db' }, { RAILWAY_ENVIRONMENT_NAME: 'production' }, { RAILWAY_ENVIRONMENT_ID: 'wrong' }]) expect(() => assertDeploymentSafety({ ...env, ...patch })).toThrow();
    expect(isTestDeployment({ RAILWAY_ENVIRONMENT_NAME: 'development' })).toBe(true);
    expect(isTestDeployment({ RAILWAY_ENVIRONMENT_NAME: 'production' })).toBe(false);
  });
  it('requires isolated persistent uploads in Railway', () => {
    const cloud = { ...env, RAILWAY_ENVIRONMENT_ID: 'stage', STAGING_EXPECTED_ENVIRONMENT_ID: 'stage' };
    expect(() => assertDeploymentSafety(cloud)).toThrow(/volume/);
    expect(() => assertDeploymentSafety({ ...cloud, UPLOAD_ROOT: '/data', RAILWAY_VOLUME_MOUNT_PATH: '/data' })).not.toThrow();
  });
  it('rejects forged, expired and revoked invitation cookies', () => {
    const now = 1789140000000;
    const ticket = stagingTicket(env.STAGING_ACCESS_CODE, now);
    expect(validStagingTicket(ticket, env.STAGING_ACCESS_CODE, now)).toBe(true);
    expect(validStagingTicket(ticket, 'rotated-code', now)).toBe(false);
    expect(validStagingTicket(ticket, env.STAGING_ACCESS_CODE, now + 31 * 86400_000)).toBe(false);
    expect(validStagingTicket(ticket + '.extra', env.STAGING_ACCESS_CODE, now)).toBe(false);
  });
  it('blocks email even if a provider key was mistakenly copied', () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('RESEND_API_KEY', 'test-not-a-real-key');
    expect(() => assertOutboundEmailAllowed()).toThrow('EMAIL_DISABLED_IN_TEST_ENVIRONMENT');
  });
  it('protects HTML, assets and APIs while leaving health and robots safe', async () => {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(stagingAccessGate(env));
    app.get('/__healthcheck', (_req, res) => res.send('ok'));
    app.use((_req, res) => res.json({ allowed: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    try {
      for (const path of ['/', '/assets/app.js', '/uploads/avatars/file.png', '/api/auth/register', '/api/prayers']) expect((await fetch(base + path)).status).toBe(401);
      expect((await fetch(base + '/__healthcheck')).status).toBe(200);
      expect(await (await fetch(base + '/robots.txt')).text()).toContain('Disallow: /');
      const request = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: env.PUBLIC_BASE_URL }, body: new URLSearchParams({ code: env.STAGING_ACCESS_CODE }), redirect: 'manual' as const };
      expect((await fetch(base + '/__staging/access', { ...request, headers: { ...request.headers, Origin: 'https://evil.example' } })).status).toBe(403);
      const login = await fetch(base + '/__staging/access', request);
      expect(login.status).toBe(303);
      const cookie = login.headers.get('set-cookie')!;
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      const invitation = stagingTicket(env.STAGING_ACCESS_CODE, Date.now(), 7);
      const group = 'a'.repeat(48);
      const accepted = await fetch(base + '/__staging/access', { ...request, body: new URLSearchParams({ ticket: invitation, group, next: 'https://evil.example' }) });
      expect(accepted.status).toBe(303);
      expect(accepted.headers.get('location')).toBe(`/groups#invite=${group}`);
      expect(accepted.headers.get('set-cookie')).toContain(invitation);
      expect(validStagingTicket(invitation, env.STAGING_ACCESS_CODE, Date.now() + 8 * 86400_000)).toBe(false);
      const invitationPageResponse = await fetch(base + '/__staging/invite');
      expect(invitationPageResponse.status).toBe(200);
      expect(invitationPageResponse.headers.get('referrer-policy')).toBe('same-origin');
      const landing = await (await fetch(base + '/__staging/invite')).text();
      expect(landing).not.toContain(env.STAGING_ACCESS_CODE);
      expect(landing).toContain('/__staging/invite.js');
      const forged = await fetch(base + '/__staging/access', { ...request, body: new URLSearchParams({ ticket: invitation + 'x' }) });
      expect(forged.status).toBe(401);
      const headers = { Cookie: cookie.split(';')[0] };
      expect((await fetch(base + '/', { headers })).status).toBe(200);
      for (const path of ['/api/dev-login', '/api/login', '/api/line-login/url', '/api/cron/daily-follow-email', '/api/webhooks/resend']) expect((await fetch(base + path, { headers })).status).toBe(403);
      for (let n = 1; n < 11; n++) {
        const response = await fetch(base + '/__staging/access', { ...request, body: new URLSearchParams({ code: 'wrong' }) });
        expect(response.status).toBe(n < 10 ? 401 : 429);
      }
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
