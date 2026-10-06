import type { Express, RequestHandler } from 'express';
import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), getUser: vi.fn(), session: vi.fn(), store: vi.fn(), compare: vi.fn(), hash: vi.fn(),
  authenticate:vi.fn(), serialize: vi.fn(), deserialize: vi.fn(), consumeReset: vi.fn(),
}));
vi.mock('../../db', () => ({ pool: { query: mocks.query } }));
vi.mock('./storage', () => ({ authStorage: { getUser: mocks.getUser } }));
vi.mock('../../resend', () => ({ sendEmail: vi.fn() }));
vi.mock('../../authPasswordReset', () => ({ consumePasswordResetToken: mocks.consumeReset, issuePasswordResetToken: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
vi.mock('express-session', () => ({ default: mocks.session }));
vi.mock('connect-pg-simple', () => ({ default: () => function Store(options: unknown) { mocks.store(options); } }));
vi.mock('passport', () => ({ default: {
  use:vi.fn(), authenticate:mocks.authenticate, initialize: () => vi.fn(), session: () => vi.fn(), serializeUser: mocks.serialize, deserializeUser: mocks.deserialize,
} }));

import { registerAuthRoutes } from './routes';
import { getSession, setupAuth } from './replitAuth';
import { pool } from '../../db';

type Callback = (error: unknown, user?: unknown) => void;
type PassportHook = (user: unknown, callback: Callback) => void;

function appFixture() {
  const posts = new Map<string, RequestHandler[]>(), gets=new Map<string,RequestHandler>();
  const app = { get:vi.fn((path:string,handler:RequestHandler)=>gets.set(path,handler)), use: vi.fn(), set: vi.fn(), post: (path: string, ...handlers: RequestHandler[]) => posts.set(path, handlers) };
  return { app: app as unknown as Express, posts, gets, set: app.set };
}

async function invokePost(handlers: RequestHandler[], body: unknown, headers: Record<string, string> = {}) {
  let status = 200;
  let result: unknown;
  const serialize = mocks.serialize.mock.calls.at(-1)?.[0] as PassportHook;
  const req = {
    body, query: body, socket: { remoteAddress: '192.0.2.1' },
    get: (key: string) => ({ origin: 'https://b.example.test', ...headers })[key],
    is: () => (headers['content-type'] || 'application/json') === 'application/json',
    login: vi.fn((user: unknown, cb: Callback) => serialize(user, cb)),
    session: { save: (cb: Callback) => cb(null) },
  };
  const res = Object.assign(new EventEmitter(), { statusCode: 200,
    status: (code: number) => { status = code; res.statusCode = code; return res; },
    json: (value: unknown) => { result = value; res.emit('finish'); }, setHeader: vi.fn(), set: () => res,
  });
  for (const handler of handlers) {
    let proceed = false;
    await handler(req as never, res as never, () => { proceed = true; });
    if (!proceed) break;
  }
  // req.login uses the async Passport serializer.
  await vi.waitFor(() => expect(result).toBeDefined());
  return { status, req, result };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('PUBLIC_BASE_URL', 'https://b.example.test');
  vi.stubEnv('RAILWAY_ENVIRONMENT_ID', ''); vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', '');
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  vi.stubEnv('AUTH_REGISTRATION_MODE', '');
  mocks.getUser.mockResolvedValue({ legacyUserId: 'member-id' });
  mocks.compare.mockResolvedValue(true); mocks.hash.mockResolvedValue('hash');
  mocks.consumeReset.mockResolvedValue(true);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('uses the shared pool, seven-day seconds with rolling persistence for store TTL and milliseconds for cookies', () => {
  getSession();
  expect(mocks.store).toHaveBeenCalledWith({ pool, createTableIfMissing: false, ttl: 604800, tableName: 'auth_sessions' });
  expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ rolling: true, cookie: expect.objectContaining({ maxAge: 604800000, httpOnly: true, sameSite: 'lax' }) }));
});

it.each(['RAILWAY_ENVIRONMENT_ID', 'RAILWAY_ENVIRONMENT_NAME'])('bounds proxy trust to one hop on %s only', async name => {
  const local = appFixture(); await setupAuth(local.app);
  expect(local.set).toHaveBeenCalledWith('trust proxy', false);
  vi.stubEnv(name, 'synthetic-railway');
  const railway = appFixture(); await setupAuth(railway.app);
  expect(railway.set).toHaveBeenCalledWith('trust proxy', 1);
});

it('checks the database on every Passport deserialize and fails closed on lookup failure', async () => {
  const { app } = appFixture(); await setupAuth(app);
  const deserialize = mocks.deserialize.mock.calls[0][0] as PassportHook;
  const user = { claims: { sub: 'line_subject' }, sessionVersion: 0, sessionUserId: 'member-id' };
  const decode = () => new Promise<{ error: unknown; user: unknown }>(resolve => deserialize(user, (error, value) => resolve({ error, user: value })));
  mocks.query.mockResolvedValueOnce({ rows: [{ session_version: 0 }] });
  expect((await decode()).user).toMatchObject({ sessionVersion: 0 });
  mocks.query.mockResolvedValueOnce({ rows: [{ session_version: 1 }] });
  expect((await decode()).user).toBe(false);
  mocks.query.mockRejectedValueOnce(new Error('offline'));
  expect((await decode()).error).toBeInstanceOf(Error);
  expect(mocks.query).toHaveBeenCalledTimes(3);
});

it.each(['/api/auth/register', '/api/auth/email-login'])('rejects CSRF at %s before database work', async path => {
  const { app, posts } = appFixture(); await setupAuth(app); registerAuthRoutes(app);
  expect((await invokePost(posts.get(path)!, { email: 'fixture@example.test', password: 'synthetic-password' }, { origin: 'https://evil.test' })).status).toBe(403);
  expect((await invokePost(posts.get(path)!, {}, { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
  expect(mocks.query).not.toHaveBeenCalled();
});

it.each([false, true])('captures the credential version before bcrypt; reset racing verification=%s', async race => {
  let version = 0;
  const hash = '$2' + 'x'.repeat(58);
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id, email, password')) return { rows: [{ id: 'member-id', email: 'fixture@example.test', password: hash, display_name: 'Fixture', session_version: version }] };
    if (sql.includes('SELECT id FROM auth_users')) return { rows: [{ id: 'local_member-id' }] };
    if (sql.includes('SELECT session_version')) return { rows: [{ session_version: version }] };
    throw new Error('Unexpected SQL in fixture');
  });
  mocks.compare.mockImplementation(async () => { if (race) version++; return true; });
  const { app, posts } = appFixture(); await setupAuth(app); registerAuthRoutes(app);
  const response = await invokePost(posts.get('/api/auth/email-login')!, { email: 'fixture@example.test', password: 'synthetic-password' });
  expect(response.status).toBe(race ? 500 : 200);
  expect(mocks.query.mock.calls[0][0]).toContain('password, display_name, session_version');
  expect(response.req.login).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 0, sessionUserId: 'member-id' }), expect.any(Function));
  expect(mocks.compare).toHaveBeenCalledWith('synthetic-password', hash);
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('fixture@example.test');
});

it.each([true, false])('uses database expiry, not a timezone-shifted driver Date, for reset: unexpired=%s', async unexpired => {
  mocks.query.mockResolvedValue({ rows: [{ id: 'token-id', email: 'fixture@example.test', used: false, unexpired,
    expires_at: new Date(unexpired ? '2000-01-01' : '2099-01-01') }] });
  const { app, posts } = appFixture(); registerAuthRoutes(app);
  const response = await invokePost(posts.get('/api/auth/reset-password')!, { token: 'a'.repeat(64), password: 'synthetic-password' });
  expect(response.status).toBe(unexpired ? 200 : 400);
  expect(mocks.query.mock.calls[0][0]).toContain('AS unexpired');
  expect(mocks.query.mock.calls[0][0]).toContain("created_at > clock_timestamp() - INTERVAL '1 hour'");
  expect(mocks.consumeReset).toHaveBeenCalledTimes(unexpired ? 1 : 0);
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('fixture@example.test');
});

it('logs safe driver diagnostics rather than email or credential-bearing error objects', async () => {
  mocks.query.mockRejectedValue(Object.assign(new Error('fixture@example.test password=synthetic-secret'), { code: '23505', detail: 'synthetic-token' }));
  const { app, posts } = appFixture(); registerAuthRoutes(app);
  expect((await invokePost(posts.get('/api/auth/email-login')!, { email: 'fixture@example.test', password: 'synthetic-secret' })).status).toBe(500);
  expect(console.error).toHaveBeenCalledWith('[Auth] Email login error', { name: 'Error', code: '23505' });
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/fixture@example|synthetic-secret|synthetic-token/);
});

it.each([true, false])('uses the same database expiry for verify-token: unexpired=%s', async unexpired => {
  mocks.query.mockResolvedValue({ rows: [{ id: 'token-id', email: 'fixture@example.test', used: false, unexpired,
    expires_at: new Date(unexpired ? '2000-01-01' : '2099-01-01') }] });
  const { app } = appFixture(); registerAuthRoutes(app);
  const registration = vi.mocked(app.get).mock.calls.find(call => call[0] === '/api/auth/verify-reset-token')!;
  const handler = registration.at(-1) as RequestHandler;
  expect((await invokePost([handler], { token: 'a'.repeat(64) })).status).toBe(unexpired ? 200 : 400);
});

it('shares a bounded bcrypt budget across login, registration and reset, and permits recovery', async () => {
  const releases: Array<(value: boolean) => void> = [];
  mocks.compare.mockImplementation(() => new Promise<boolean>(resolve => releases.push(resolve)));
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id, email, password')) return { rows: [{ id: 'member-id', password: '$2' + 'x'.repeat(58), session_version: 0 }] };
    if (sql.includes('SELECT id FROM auth_users')) return { rows: [{ id: 'local_member-id' }] };
    if (sql.includes('SELECT session_version')) return { rows: [{ session_version: 0 }] };
    if (sql.includes('FROM password_reset_tokens')) return { rows: [{ id: 'token-id', email: 'fixture@example.test', used: false, unexpired: true }] };
    if (sql.includes('SELECT id FROM users')) return { rows: [] };
    throw new Error('Unexpected SQL in fixture');
  });
  const { app, posts } = appFixture(); await setupAuth(app); registerAuthRoutes(app);
  const login = posts.get('/api/auth/email-login')!;
  const pending = Array.from({ length: 4 }, (_, i) => invokePost(login, { email: `member${i}@example.test`, password: 'synthetic-password' }));
  await vi.waitFor(() => expect(releases).toHaveLength(4));
  expect((await invokePost(login, { email: 'next@example.test', password: 'synthetic-password' })).status).toBe(503);
  expect((await invokePost(posts.get('/api/auth/register')!, { email: 'new@example.test', password: 'synthetic-password' })).status).toBe(503);
  expect((await invokePost(posts.get('/api/auth/reset-password')!, { token: 'synthetic-token', password: 'synthetic-password' })).status).toBe(503);
  expect(mocks.hash).not.toHaveBeenCalled();
  expect(mocks.consumeReset).not.toHaveBeenCalled();
  releases.forEach(release => release(true));
  expect((await Promise.all(pending)).map(response => response.status)).toEqual([200, 200, 200, 200]);
  mocks.compare.mockResolvedValue(true);
  expect((await invokePost(login, { email: 'next@example.test', password: 'synthetic-password' })).status).toBe(200);
});

for(const phase of ['login','save'] as const)it(`Google callback fails closed with safe diagnostics when ${phase} session persistence fails`,async()=>{
 vi.stubEnv('GOOGLE_CLIENT_ID','synthetic-client');vi.stubEnv('GOOGLE_CLIENT_SECRET','synthetic-secret');
 mocks.authenticate.mockImplementation((_strategy,options)=> (req,res,next)=>typeof options==='function'?options(null,{claims:{sub:'synthetic-auth'}}):next());
 const {app,gets}=appFixture();await setupAuth(app);const handler=gets.get('/api/callback')!;expect(handler).toBeDefined();
 const error=Object.assign(new Error('private@example.test synthetic-secret'),{code:'P0001'});let status=200,sent=false;
 const req={login:vi.fn((_u,cb)=>cb(phase==='login'?error:null)),session:{save:vi.fn(cb=>cb(error))}};
 const res={status:vi.fn(n=>{status=n;return res;}),send:vi.fn(()=>{sent=true;}),redirect:vi.fn()};
 handler(req as never,res as never,vi.fn());await vi.waitFor(()=>expect(sent).toBe(true));expect(status).toBe(503);expect(res.redirect).not.toHaveBeenCalled();expect(mocks.query).not.toHaveBeenCalled();
 expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private@example|synthetic-secret/);
});
