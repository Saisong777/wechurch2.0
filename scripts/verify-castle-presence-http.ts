import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { castleJoinResponseSchema, castleRosterSchema } from '../shared/castlePresence';
type Client = (path: string, method?: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
export async function verifyCastlePresenceHttp(pool: Pool, makeClient: () => Client) {
    const a = makeClient(), b = makeClient(), other = makeClient(), guest = makeClient(), ids: string[] = [];
    for (const client of [a, b, other]) {
        const email = `castle-${randomUUID()}@example.test`;
        assert.equal((await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Private account name' })).status, 200);
        ids.push((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id);
    }
    await pool.query("UPDATE users SET church='火樂' WHERE id=$1", [ids[2]]);
    assert.equal((await guest('/api/castle-presence')).status, 401);
    assert.equal((await a('/api/castle-presence/join', 'POST', { alias: 'A', preset: 'jade', actorId: ids[1] })).status, 400);
    assert.equal((await a('/api/castle-presence/join', 'POST', { alias: 'A', preset: 'jade' }, { Origin: 'https://foreign.test' })).status, 403);
    const join = await a('/api/castle-presence/join', 'POST', { alias: 'Castle A', preset: 'jade' });
    assert.equal(join.status, 200);
    const aj = castleJoinResponseSchema.parse(await join.json()), lease = { 'X-Castle-Lease': aj.leaseToken };
    assert.equal(aj.avatars.length, 1);
    const bj = castleJoinResponseSchema.parse(await (await b('/api/castle-presence/join', 'POST', { alias: 'Castle B', preset: 'coral' })).json());
    assert.equal(bj.avatars.length, 2);
    const roster = castleRosterSchema.parse(await (await a('/api/castle-presence')).json());
    assert.equal(roster.avatars.length, 2);
    assert(!JSON.stringify(roster).includes(ids[0]));
    assert(!JSON.stringify(roster).includes('Private account'));
    assert(!JSON.stringify(roster).includes('leaseToken'));
    assert.equal(castleRosterSchema.parse(await (await other('/api/castle-presence')).json()).avatars.length, 0);
    assert.equal((await other('/api/castle-presence', 'GET', undefined, { 'X-WeChurch-Church': encodeURIComponent('IM 行動教會') })).status, 403);
    assert.equal((await b('/api/castle-presence/move', 'POST', { targetNode: 2 }, lease)).status, 409);
    assert.equal((await a('/api/castle-presence/move', 'POST', { targetNode: 2, x: 99 }, lease)).status, 400);
    assert.equal((await a('/api/castle-presence/move', 'POST', { targetNode: 2 }, lease)).status, 200);
    assert.equal((await a('/api/castle-presence/leave', 'DELETE', undefined, lease)).status, 200);
    assert.equal(castleRosterSchema.parse(await (await b('/api/castle-presence')).json()).avatars.length, 1);
    await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [ids[1]]);
    assert.equal(castleRosterSchema.parse(await (await a('/api/castle-presence')).json()).avatars.length, 0);
    console.log('castle presence synthetic HTTP: consent, scope, forgery, movement, leave and revocation passed');
}
