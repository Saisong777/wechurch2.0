import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiIdentity, boundedWindowLimiter, clientAddress } from './requestLimits';
import type { Request, Response } from 'express';

const request = (headers: Record<string, string> = {}) => ({ socket: { remoteAddress: '::ffff:192.0.2.1' }, get: (key: string) => headers[key], originalUrl: '/api/participants/forged', sessionID: 'unpersisted-random' }) as Request;
function response() {
  const result = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  result.status.mockReturnValue(result); return result as unknown as Response;
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('bounded request identities', () => {
  it('ignores caller supplied participant ids, emails, forwarding headers and unpersisted cookies', () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', ''); vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', '');
    expect(apiIdentity(request({ 'x-participant-id': 'fake', 'x-forwarded-for': '203.0.113.3', 'x-real-ip': '203.0.113.4' }))).toBe('address:192.0.2.1');
  });
  it('uses validated Railway ingress address only in Railway', () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', 'test');
    expect(clientAddress(request({ 'x-real-ip': '203.0.113.4' }))).toBe('203.0.113.4');
    expect(clientAddress(request({ 'x-real-ip': 'evil, 203.0.113.4' }))).toBe('192.0.2.1');
  });
  it('blocks alternate forged headers, bounds storage and allows a new window', () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', ''); vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', '');
    const limiter = boundedWindowLimiter({ max: 2, windowMs: 1000, maxKeys: 1, key: clientAddress });
    const next = vi.fn(); const res = response();
    limiter(request(), res, next); limiter(request({ 'x-participant-id': '1' }), res, next);
    limiter(request({ 'x-participant-id': '2' }), res, next);
    expect(next).toHaveBeenCalledTimes(2); expect(res.status).toHaveBeenCalledWith(429);
    const other = request(); Object.assign(other.socket, { remoteAddress: '192.0.2.2' });
    limiter(other, res, next); expect(next).toHaveBeenCalledTimes(2);
    vi.setSystemTime(2001); limiter(other, res, next); expect(next).toHaveBeenCalledTimes(3);
  });
});
