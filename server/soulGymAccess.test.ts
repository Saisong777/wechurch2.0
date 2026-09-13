import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { browserIdentity, soulGymAccess, visibleSubmissions } from './soulGymAccess';

afterEach(() => vi.unstubAllEnvs());
const sessionId = '00000000-0000-4000-8000-000000000001';
const participantId = '00000000-0000-4000-8000-000000000002';
const request = (sessionID = 'signed-session') => ({ sessionID, query: { email: 'victim@example.test' }, body: { userId: participantId } }) as unknown as Request;

describe('Soul Gym trusted identity', () => {
  it('requires a server secret and session identity', () => {
    vi.stubEnv('SESSION_SECRET', '');
    expect(() => browserIdentity(request())).toThrow();
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    expect(browserIdentity(request())).toMatch(/^[a-f0-9]{64}$/);
    expect(browserIdentity(request('other-session'))).not.toBe(browserIdentity(request()));
  });
  it('binds lookup to server session/account, never request email or body userId', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const access = soulGymAccess({ pool: { query } as unknown as Pool, resolveUserId: async () => 'verified-account', canManageSession: async () => false });
    expect(await access.owned(request(), sessionId, participantId)).toBeNull();
    expect(query.mock.calls[0][1]).toEqual([sessionId, browserIdentity(request()), 'verified-account', participantId]);
  });
  it('rejects malformed identities before reaching the database', async () => {
    const query = vi.fn();
    const access = soulGymAccess({ pool: { query } as unknown as Pool, resolveUserId: async () => null, canManageSession: async () => false });
    expect(await access.owned(request(), 'not-a-uuid')).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
  it('does not grant any data when database identity lookup fails', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const access = soulGymAccess({ pool: { query: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Pool, resolveUserId: async () => null, canManageSession: async () => false });
    await expect(access.owned(request(), sessionId)).rejects.toThrow('offline');
  });
  it('requires successful session persistence before granting a browser identity', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const access = soulGymAccess({ pool: {} as Pool, resolveUserId: async () => null, canManageSession: async () => false });
    const req = request();
    Object.assign(req, { session: { save: (callback: (error: Error) => void) => callback(new Error('session offline')) } });
    await expect(access.grant(req)).rejects.toThrow('session offline');
  });
  it('removes emails and foreign group submissions including ungrouped peers', () => {
    const rows = [{ participantId: 'own', groupNumber: null, email: 'private' }, { participantId: 'other', groupNumber: null, email: 'private' }];
    expect(visibleSubmissions(rows)).toEqual([]);
    expect(visibleSubmissions(rows, { id: 'own', groupNumber: null })).toEqual([{ participantId: 'own', groupNumber: null }]);
    expect(visibleSubmissions(rows, undefined, true)).toEqual(rows);
  });
  it('keeps report/hidden/group-change sibling routes on trusted ownership', () => {
    const source = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
    const report = source.slice(source.indexOf('app.get("/api/sessions/:sessionId/reports"'), source.indexOf('app.delete("/api/reports/:id"'));
    expect(report).toContain('res.locals.soulGymParticipant');
    expect(report).not.toContain('req.query.email');
    const hidden = source.slice(source.indexOf('app.patch("/api/notebook/:id/hidden"'), source.indexOf('// ============ Devotional Notes AI Analysis'));
    expect(hidden).toContain('studyAccess.owned(req, existing.sessionId, existing.userId)');
    expect(source).toContain('parsed.data.groupNumber !== existing.groupNumber');
  });
});
