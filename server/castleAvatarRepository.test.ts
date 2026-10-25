import { describe, it, expect, vi } from 'vitest';
vi.mock('./churchContext', () => ({ lockChurchContext: vi.fn(async () => {
    }) }));
import { CastleAvatarRepository } from './castleAvatarRepository';
import type { CastleLeaseCandidate } from './castlePresenceStore';
import { defaultCastleProfile, type CastleAvatarProfile } from '../shared/castleAvatar';
const actor = { actorId: 'a', sid: 's', sessionVersion: 1, church: 'IM 行動教會', authSub: 'auth' };
function fixture() {
    let profile: CastleAvatarProfile | null = null, revision = 0, valid = true;
    const calls: string[] = [];
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
        calls.push(sql);
        if (sql.startsWith('SELECT u.display_name'))
            return { rows: [{ display_name: 'private@example.test', profile, revision }] };
        if (sql.startsWith('INSERT')) {
            if (profile)
                return { rows: [] };
            profile = JSON.parse(values![1] as string);
            revision = 1;
            return { rows: [{ profile, revision }] };
        }
        if (sql.startsWith('UPDATE')) {
            if (values![2] !== revision)
                return { rows: [] };
            profile = JSON.parse(values![1] as string);
            revision++;
            return { rows: [{ profile, revision }] };
        }
        return { rows: [] };
    });
    const release = vi.fn(), db = { query, connect: async () => ({ query, release }) };
    const verifier = () => async (c: readonly CastleLeaseCandidate[]) => new Set<string>(valid ? c.map(x => x.token) : []);
    return { repo: new CastleAvatarRepository(db, verifier), calls, query, release, setValid: (value: boolean) => valid = value };
}
describe('durable owner profile and bounded serialization', () => {
    it('GET defaults without writing and CAS rejects lost updates', async () => {
        const f = fixture();
        expect(await f.repo.read(actor)).toMatchObject({ revision: 0, profile: { alias: '同行者' } });
        expect(f.calls.some(c => c.startsWith('INSERT'))).toBe(false);
        const saved = await f.repo.save(actor, { expectedRevision: 0, profile: defaultCastleProfile('A') });
        expect(saved.revision).toBe(1);
        await expect(f.repo.save(actor, { expectedRevision: 0, profile: defaultCastleProfile('B') })).rejects.toMatchObject({ status: 409 });
        expect(f.calls.at(-1)).toBe('ROLLBACK');
        expect((await f.repo.read(actor)).profile.alias).toBe('A');
        expect((await f.repo.save(actor, { expectedRevision: 1, profile: defaultCastleProfile('B') })).revision).toBe(2);
        expect(f.release).toHaveBeenCalledTimes(3);
    });
    it('verifies inside the transaction and after COMMIT without claiming a committed save rolled back', async () => {
        const f = fixture();
        const original = f.query.getMockImplementation()!;
        f.query.mockImplementation(async (sql, values) => {
            const value = await original(sql, values);
            if (sql === 'COMMIT')
                f.setValid(false);
            return value;
        });
        await expect(f.repo.save(actor, { expectedRevision: 0, profile: defaultCastleProfile() })).rejects.toMatchObject({ status: 401 });
        expect(f.calls).toContain('COMMIT');
        expect(f.calls).not.toContain('ROLLBACK');
    });
    it('serializes a first join before a newer save across sessions/churches, recovers from rejection and bounds pending work', async () => {
        const f = fixture();
        let finish!: () => void;
        const events: string[] = [];
        const first = f.repo.run(actor, async () => {
            events.push('join:read1');
            await new Promise<void>(r => finish = r);
            events.push('join:sync1');
        });
        await Promise.resolve();
        const second = f.repo.run({ ...actor, sid: 'new', church: 'other' }, async () => {
            events.push('save:sync2');
            return 2;
        });
        const pending = Array.from({ length: 6 }, () => f.repo.run(actor, async () => 1));
        await expect(f.repo.run(actor, async () => 0)).rejects.toMatchObject({ status: 429 });
        expect(events).toEqual(['join:read1']);
        finish();
        await Promise.all([first, second, ...pending]);
        expect(events).toEqual(['join:read1', 'join:sync1', 'save:sync2']);
        await expect(f.repo.run(actor, async () => {
            throw Error('failed');
        })).rejects.toThrow('failed');
        expect(await f.repo.run(actor, async () => 3)).toBe(3);
    });
});
it('does not let a first join of revision 1 overwrite revision 2 saved while join was awaiting', async () => {
    const f = fixture();
    await f.repo.save(actor, { expectedRevision: 0, profile: defaultCastleProfile('one') });
    const { CastlePresenceStore } = await import('./castlePresenceStore');
    const store = new CastlePresenceStore(async (c) => new Set(c.map(c => c.token)));
    let resume!: () => void, read!: () => void;
    const didRead = new Promise<void>(r => read = r);
    const join = f.repo.run(actor, async () => {
        const saved = await f.repo.read(actor);
        read();
        await new Promise<void>(r => resume = r);
        return store.join(actor, { alias: saved.profile.alias, preset: saved.profile.outfitColor }, undefined, saved);
    });
    await didRead;
    const save = f.repo.run({ ...actor, sid: 'new-tab' }, async () => {
        const result = await f.repo.save(actor, { expectedRevision: 1, profile: defaultCastleProfile('two') });
        store.updateProfile(actor, result.profile, result.revision);
    });
    resume();
    const joined = await join;
    await save;
    const visible = (await store.roster(actor)).avatars[0];
    expect(visible.alias).toBe('two');
    expect(visible.avatarId).toBe(joined.avatarId);
});
it('bounds global waiting accounts, cleans every completed key, and rejects a revoked queued actor', async () => {
    const f = fixture();
    let release!: () => void;
    const wait = new Promise<void>(r => release = r);
    const pending = Array.from({ length: 256 }, (_, i) => f.repo.run({ ...actor, actorId: String(i) }, () => wait));
    await expect(f.repo.run({ ...actor, actorId: 'overflow' }, async () => 0)).rejects.toMatchObject({ status: 503 });
    release();
    await Promise.all(pending);
    expect(await f.repo.run({ ...actor, actorId: 'overflow' }, async () => 7)).toBe(7);
    f.setValid(false);
    await expect(f.repo.run({ ...actor, sid: 'revoked', church: 'changed' }, () => f.repo.read({ ...actor, sid: 'revoked', church: 'changed' }))).rejects.toMatchObject({ status: 401 });
    f.setValid(true);
    expect((await f.repo.run(actor, () => f.repo.read(actor))).revision).toBe(0);
});
