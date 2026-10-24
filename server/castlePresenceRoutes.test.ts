import express from 'express';
import { castleJoinResponseSchema } from '../shared/castlePresence';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
vi.mock('./churchContext', () => ({ churchContext: () => undefined }));
import { castleLeaseVerifier, castlePresenceRoutes } from './castlePresenceRoutes';
import { CastlePresenceStore, type CastleActor } from './castlePresenceStore';
const actor: CastleActor = { actorId: '11111111-1111-4111-8111-111111111111', church: 'IM 行動教會', sid: 'private-session', sessionVersion: 1, authSub: 'auth-sub' };
let server: Server | undefined;
afterEach(async () => { if (server)
    await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });
describe('presence API boundary', () => {
    it('authenticates, rejects forged strict bodies and cross-site writes, and never exposes actor/session IDs', async () => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => { Object.assign(req, { user: { sessionUserId: actor.actorId, sessionVersion: 1, claims: { sub: actor.authSub } }, sessionID: actor.sid }); next(); });
        const store = new CastlePresenceStore(async (c) => new Set(c.map(c => c.token)));
        app.use('/api/castle-presence', castlePresenceRoutes(store, (req, res, next) => req.get('X-Test-Guest') ? void res.status(401).end() : next(), () => ({ actorId: actor.actorId, actorChurch: actor.church, selectedChurch: actor.church, isSystemAdmin: false }), true));
        server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        const port = (server.address() as any).port, url = `http://127.0.0.1:${port}/api/castle-presence`;
        const send = (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
        expect((await send('', undefined, { 'X-Test-Guest': '1' })).status).toBe(401);
        for (const body of [{ alias: 'A', preset: 'jade', actorId: actor.actorId }, { alias: '\u0000', preset: 'jade' }, { alias: 'A', preset: 'photo' }])
            expect((await send('/join', body)).status).toBe(400);
        expect((await send('/join', { alias: 'A', preset: 'jade' }, { Origin: 'https://foreign.test' })).status).toBe(403);
        const joinedResponse = await send('/join', { alias: '<b>A</b>', preset: 'jade' });
        expect(joinedResponse.headers.get('cache-control')).toBe('private, no-store');
        const joined = castleJoinResponseSchema.parse(await joinedResponse.json());
        expect(joined.avatars).toHaveLength(1);
        const roster = await (await send('')).json();
        expect(JSON.stringify(roster)).not.toContain(actor.actorId);
        expect(JSON.stringify(roster)).not.toContain(actor.sid);
        expect(JSON.stringify(roster)).not.toContain('leaseToken');
        expect((await send('/move', { targetNode: 2, from: [0, 0] }, { 'X-Castle-Lease': joined.leaseToken })).status).toBe(400);
        expect((await send('/move', { targetNode: 2 }, { 'X-Castle-Lease': joined.leaseToken })).status).toBe(200);
    });
    it('batch-checks canonical identity, session expiry, scope and version without private fields in output', async () => {
        let mapping = actor.actorId, expire: any = new Date(Date.now() + 60000), version = 1;
        let missingAuth = false;
        const query = { query: vi.fn(async (sql: string) => ({ rows: sql.includes('FROM auth_users') ? (missingAuth ? [] : [{ id: actor.authSub, actor_id: mapping }]) : sql.includes('FROM auth_sessions') ? [{ sid: actor.sid, expire, sess: { passport: { user: { claims: { sub: actor.authSub }, sessionUserId: actor.actorId, sessionVersion: 1, expires_at: Math.floor(Date.now() / 1000) + 60 } } } }] : [{ id: actor.actorId, church: actor.church, session_version: version, admin: false }] })) };
        const verify = castleLeaseVerifier(query), candidate = { ...actor, token: 'opaque' };
        expect((await verify([candidate])).has('opaque')).toBe(true);
        expect(query.query).toHaveBeenCalledTimes(3);
        mapping = 'other';
        expect((await verify([candidate])).size).toBe(0);
        mapping = actor.actorId;
        missingAuth = true;
        expect((await verify([candidate])).size).toBe(0);
        missingAuth = false;
        expire = 'invalid-date';
        expect((await verify([candidate])).size).toBe(0);
        expire = new Date(Date.now() + 60000);
        version = 2;
        expect((await verify([candidate])).size).toBe(0);
    });
});
