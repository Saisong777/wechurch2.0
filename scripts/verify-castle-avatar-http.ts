import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { defaultCastleProfile, castleProfileResponseSchema } from '../shared/castleAvatar';
import { castleJoinResponseSchema, castleJoinV2ResponseSchema, castleRosterV2Schema } from '../shared/castlePresence';
type Client = (path: string, method?: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
/** Synthetic local verification only, run by the default original integrity stage (the second stage covers church onboarding); never a test-login endpoint. */
export async function verifyCastleAvatarHttp(pool: Pool, makeClient: () => Client) {
    const owner = makeClient(), other = makeClient(), guest = makeClient(), header = { 'X-Castle-Protocol': '2' }, ids: string[] = [];
    for (const client of [owner, other]) {
        const email = `castle-look-${randomUUID()}@example.test`;
        assert.equal((await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: client === owner ? 'person@example.test' : 'Other' })).status, 200);
        ids.push((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id);
    }
    const endpoint = '/api/castle-presence/profile';
    assert.equal((await guest(endpoint)).status, 401);
    const initial = castleProfileResponseSchema.parse(await (await owner(endpoint, 'GET', undefined, header)).json());
    assert.equal(initial.revision, 0);
    assert.equal(initial.profile.alias, '同行者');
    assert.equal((await pool.query('SELECT count(*)::int n FROM castle_avatar_profiles WHERE user_id=$1', [ids[0]])).rows[0].n, 0);
    const input = { expectedRevision: 0, profile: { ...defaultCastleProfile('城堡A'), genderPresentation: 'female', skinTone: 'deep', hairStyle: 'long', hairColor: 'silver', outfit: 'jacket', outfitColor: 'violet' } };
    assert.equal((await owner(endpoint, 'PUT', { ...input, userId: ids[1] }, header)).status, 400);
    assert.equal((await owner(endpoint, 'PUT', input, { ...header, Origin: 'https://foreign.test' })).status, 403);
    const saved = await owner(endpoint, 'PUT', input, header);
    assert.equal(saved.status, 200);
    assert.equal(castleProfileResponseSchema.parse(await saved.json()).revision, 1);
    assert.equal((await owner(endpoint, 'PUT', input, header)).status, 409);
    assert.equal(castleProfileResponseSchema.parse(await (await other(endpoint)).json()).revision, 0);
    const joined = castleJoinV2ResponseSchema.parse(await (await owner('/api/castle-presence/join', 'POST', {}, header)).json()), lease = { ...header, 'X-Castle-Lease': joined.leaseToken };
    assert.equal(joined.avatars.find(a => a.isSelf)!.appearance.outfit, 'jacket');
    const moved = castleRosterV2Schema.parse(await (await owner('/api/castle-presence/move', 'POST', { targetNode: 8 }, lease)).json()).avatars.find(a => a.isSelf)!;
    const update = { expectedRevision: 1, profile: { ...input.profile, alias: '新衣服', outfit: 'skirt' } };
    assert.equal((await owner(endpoint, 'PUT', update, header)).status, 200);
    const current = castleRosterV2Schema.parse(await (await owner('/api/castle-presence', 'GET', undefined, header)).json()).avatars.find(a => a.isSelf)!;
    assert.equal(current.avatarId, moved.avatarId);
    assert.deepEqual(current.motion, moved.motion);
    assert.equal(current.appearance.outfit, 'skirt');
    const legacy = castleJoinResponseSchema.parse(await (await owner('/api/castle-presence/join', 'POST', { alias: 'Old client', preset: 'coral' }, { 'X-Castle-Lease': joined.leaseToken })).json());
    assert.equal(legacy.avatarId, joined.avatarId);
    assert.equal(legacy.avatars.find(a => a.isSelf)!.alias, '新衣服');
    assert.equal(legacy.avatars.find(a => a.isSelf)!.preset, 'violet');
    assert.equal(castleProfileResponseSchema.parse(await (await owner(endpoint)).json()).revision, 2);
    assert.equal((await owner('/api/castle-presence', 'GET', undefined, { 'X-Castle-Protocol': '3' })).status, 400);
    await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [ids[0]]);
    assert.equal((await owner(endpoint, 'PUT', { ...update, expectedRevision: 2 }, header)).status, 401);
    await other('/api/castle-presence/leave', 'DELETE');
    console.log('castle avatar synthetic HTTP: owner durable CAS, strict protocols, default privacy, legacy compatibility and motion preservation passed');
}
