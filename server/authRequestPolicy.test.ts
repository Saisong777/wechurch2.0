import type { Request, RequestHandler, Response } from 'express';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authAttemptLimits, authLoginLimits, boundedFailedAuthLimiter, trustedAuthJson } from './authRequestPolicy';

function request(headers: Record<string, string> = {}, body: object = {}, remoteAddress = '192.0.2.1'): Request {
  return {
    get: (name: string) => headers[name.toLowerCase()],
    is: (type: string) => headers['content-type']?.split(';')[0] === type,
    socket: { remoteAddress, localPort: 5001 }, body, query: {}, ip: 'spoofable-ip',
  } as unknown as Request;
}

function invoke(handlers: RequestHandler[], req: Request) {
  const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json: vi.fn() });
  let passed = false;
  const dispatch = (index: number) => {
    if (index === handlers.length) { passed = true; return; }
    handlers[index](req, response as unknown as Response, () => dispatch(index + 1));
  };
  dispatch(0);
  return { passed, status: response.statusCode,
    finish: (status = 200) => { response.statusCode = status; response.emit('finish'); },
    close: () => response.emit('close'),
  };
}

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('login and registration CSRF policy', () => {
  const env = { NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://b.example.test' };
  it('accepts same-origin JSON, including charset', () => {
    expect(invoke([trustedAuthJson(env)], request({ origin: env.PUBLIC_BASE_URL, 'content-type': 'application/json; charset=utf-8', 'sec-fetch-site': 'same-origin' })).passed).toBe(true);
  });
  it.each(['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', ''])('rejects form/simple content type %s', contentType => {
    expect(invoke([trustedAuthJson(env)], request({ origin: env.PUBLIC_BASE_URL, 'content-type': contentType })).status).toBe(415);
  });
  it.each(['https://evil.test', 'https://sibling.example.test', 'https://b.example.test.evil.test', 'https://b.example.test:444', 'http://b.example.test', 'null', '', 'https://user@b.example.test', 'https://b.example.test/path', 'https://b.example.test/'])('rejects hostile, missing or non-origin value %s', origin => {
    expect(invoke([trustedAuthJson(env)], request({ origin, 'content-type': 'application/json', host: 'evil.test', 'x-forwarded-host': 'b.example.test' })).status).toBe(403);
  });
  it('rejects contradictory cross-site fetch metadata and invalid configuration', () => {
    const req = request({ origin: env.PUBLIC_BASE_URL, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' });
    expect(invoke([trustedAuthJson(env)], req).status).toBe(403);
    expect(invoke([trustedAuthJson({ ...env, PUBLIC_BASE_URL: 'invalid' })], req).status).toBe(403);
  });
  it('supports the production default and same-server loopback development without a broad host exemption', () => {
    expect(invoke([trustedAuthJson({ NODE_ENV: 'production' })], request({ origin: 'https://www.wechurch.online', 'content-type': 'application/json' })).passed).toBe(true);
    const local = request({ origin: 'http://localhost:5001', host: 'localhost:5001', 'content-type': 'application/json' });
    expect(invoke([trustedAuthJson({ NODE_ENV: 'development' })], local).passed).toBe(true);
    expect(invoke([trustedAuthJson({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT_ID: 'test' })], local).status).toBe(403);
    expect(invoke([trustedAuthJson({ NODE_ENV: 'development' })], request({ origin: 'http://evil.test:5001', host: 'evil.test:5001', 'content-type': 'application/json' })).status).toBe(403);
  });
});

describe('shared-NAT login budgets', () => {
  it('allows 101 distinct successful logins and repeated successful logins without consuming failed-attempt budgets', () => {
    const limits = authLoginLimits();
    for (let i = 0; i < 101; i++) {
      const result = invoke(limits, request({}, { email: `member${i}@example.test` }));
      expect(result.passed).toBe(true); result.finish(200);
    }
    for (let i = 0; i < 20; i++) {
      const result = invoke(limits, request({}, { email: 'member0@example.test' }));
      expect(result.passed).toBe(true); result.finish(200);
    }
  });
  it('retains account failures across IP rotation and does not erase failures on success', () => {
    const limits = authLoginLimits();
    for (let i = 0; i < 9; i++) {
      const result = invoke(limits, request({}, { email: ' MEMBER@EXAMPLE.TEST ' }, `192.0.2.${i + 1}`));
      expect(result.passed).toBe(true); result.finish(401);
    }
    const success = invoke(limits, request({}, { email: 'member@example.test' }, '192.0.2.20'));
    expect(success.passed).toBe(true); success.finish(200);
    const failure = invoke(limits, request({}, { email: 'member@example.test' }, '192.0.2.21'));
    expect(failure.passed).toBe(true); failure.finish(401);
    expect(invoke(limits, request({}, { email: 'member@example.test' }, '192.0.2.22')).status).toBe(429);
  });
  it('blocks password spraying across accounts despite forged forwarding headers', () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', ''); vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', '');
    const limits = authLoginLimits();
    for (let i = 0; i < 100; i++) {
      const result = invoke(limits, request({ 'x-forwarded-for': `198.51.100.${i}`, 'x-real-ip': `198.51.100.${i}`, 'x-participant-id': String(i) }, { email: `member${i}@example.test` }));
      expect(result.passed).toBe(true); result.finish(401);
    }
    expect(invoke(limits, request({}, { email: 'another@example.test' })).status).toBe(429);
  });
  it('reserves pending attempts, charges aborted requests, and refunds server overload', () => {
    const limits = [boundedFailedAuthLimiter({ max: 1, key: () => 'address' })];
    const pending = invoke(limits, request());
    expect(invoke(limits, request()).status).toBe(429);
    pending.finish(503);
    const aborted = invoke(limits, request());
    expect(aborted.passed).toBe(true); aborted.close();
    expect(invoke(limits, request()).status).toBe(429);
  });
  it('bounds identity storage and frees successful entries without evicting failed identities', () => {
    const limits = [boundedFailedAuthLimiter({ max: 2, maxKeys: 2, key: req => req.body.email })];
    const first = invoke(limits, request({}, { email: 'a' })); first.finish(401);
    const second = invoke(limits, request({}, { email: 'b' }));
    expect(invoke(limits, request({}, { email: 'c' })).status).toBe(429);
    second.finish(200);
    expect(invoke(limits, request({}, { email: 'c' })).passed).toBe(true);
    const lastA = invoke(limits, request({}, { email: 'a' })); lastA.finish(401);
    expect(invoke(limits, request({}, { email: 'a' })).status).toBe(429);
  });
  it('does not refund a newer window when an old successful response finishes late', () => {
    vi.useFakeTimers();
    const limits = [boundedFailedAuthLimiter({ max: 1, windowMs: 1000, key: () => 'address' })];
    const old = invoke(limits, request());
    vi.advanceTimersByTime(1000);
    const current = invoke(limits, request()); expect(current.passed).toBe(true);
    old.finish(200);
    expect(invoke(limits, request()).status).toBe(429);
    current.finish(200);
    expect(invoke(limits, request()).passed).toBe(true);
  });
  it('retains a higher coarse IP ceiling even for continuously successful accounts', () => {
    const limits = authLoginLimits();
    for (let i = 0; i < 1000; i++) {
      const result = invoke(limits, request({}, { email: 'member@example.test' }));
      expect(result.passed).toBe(true); result.finish(200);
    }
    expect(invoke(limits, request({}, { email: 'member@example.test' })).status).toBe(429);
  });
});

describe('independent bounded auth budgets', () => {
  it('blocks rotating source IPs for the same normalized account', () => {
    const limits = authAttemptLimits(2);
    expect(invoke(limits, request({}, { email: 'member@example.test' }, '192.0.2.1')).passed).toBe(true);
    expect(invoke(limits, request({}, { email: ' MEMBER@EXAMPLE.TEST ' }, '192.0.2.2')).passed).toBe(true);
    expect(invoke(limits, request({}, { email: 'member@example.test' }, '192.0.2.3')).status).toBe(429);
  });
  it('blocks rotating emails and forwarding/participant headers on the same socket', () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', ''); vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', '');
    const limits = authAttemptLimits();
    for (let i = 0; i < 100; i++) {
      expect(invoke(limits, request({ 'x-forwarded-for': `198.51.100.${i}`, 'x-real-ip': `198.51.100.${i}`, 'x-participant-id': String(i) }, { email: `user${i}@example.test` })).passed).toBe(true);
    }
    expect(invoke(limits, request({ 'x-forwarded-for': '198.51.100.101' }, { email: 'new@example.test' })).status).toBe(429);
  });
  it('keeps peers behind one NAT on distinct account budgets', () => {
    const limits = authAttemptLimits(2);
    for (let i = 0; i < 2; i++) expect(invoke(limits, request({}, { email: 'a@example.test' })).passed).toBe(true);
    expect(invoke(limits, request({}, { email: 'a@example.test' })).status).toBe(429);
    expect(invoke(limits, request({}, { email: 'b@example.test' })).passed).toBe(true);
  });
  it('does not let extra email fields override the reset-token budget', () => {
    const limits = authAttemptLimits(1, 'token');
    expect(invoke(limits, request({}, { token: 'synthetic-token', email: 'a@example.test' })).passed).toBe(true);
    expect(invoke(limits, request({}, { token: 'synthetic-token', email: 'b@example.test' }, '192.0.2.2')).status).toBe(429);
  });
  it('does not let a GET body override the verified query token', () => {
    const limits = authAttemptLimits(1, 'token');
    const first = request({}, { token: 'irrelevant-body-token' });
    first.method = 'GET'; first.query = { token: 'synthetic-token' };
    expect(invoke(limits, first).passed).toBe(true);
    first.body.token = 'different-body-token';
    expect(invoke(limits, first).status).toBe(429);
  });
  it('allows explicitly configured loopback test origins, but not HTTP production or Railway origins', () => {
    const req = request({ origin: 'http://127.0.0.1:5001', 'content-type': 'application/json' });
    const env = { NODE_ENV: 'test', PUBLIC_BASE_URL: 'http://127.0.0.1:5001' };
    expect(invoke([trustedAuthJson(env)], req).passed).toBe(true);
    expect(invoke([trustedAuthJson({ ...env, NODE_ENV: 'production' })], req).status).toBe(403);
    expect(invoke([trustedAuthJson({ ...env, RAILWAY_ENVIRONMENT_ID: 'test' })], req).status).toBe(403);
    expect(invoke([trustedAuthJson({ NODE_ENV: 'test' })], req).status).toBe(403);
  });
  it('expires both budgets after fifteen minutes', () => {
    vi.useFakeTimers();
    const limits = authAttemptLimits(1);
    const req = request({}, { email: 'a@example.test' });
    expect(invoke(limits, req).passed).toBe(true);
    expect(invoke(limits, req).status).toBe(429);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(invoke(limits, req).passed).toBe(true);
  });
});
