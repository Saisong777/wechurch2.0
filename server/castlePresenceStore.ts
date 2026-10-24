import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CASTLE_MAX_RESIDENTS, CASTLE_TTL_MS, type CastleJoin } from '../shared/castlePresence';
import { WALK_NODES, planCastleMotion, type CastleMotion } from '../shared/castleNavigation';
export type CastleActor = {
    actorId: string;
    church: string;
    sid: string;
    sessionVersion: number;
    authSub: string;
};
export type CastleLeaseCandidate = CastleActor & {
    token: string;
};
export type CastleLeaseVerifier = (candidates: readonly CastleLeaseCandidate[]) => Promise<ReadonlySet<string>>;
type Lease = CastleLeaseCandidate & {
    expires: number;
};
type Entry = {
    actorId: string;
    church: string;
    avatarId: string;
    alias: string;
    preset: CastleJoin['preset'];
    motion: CastleMotion;
    leases: Map<string, Lease>;
    lastMove: number;
    commands: Map<string, number>;
};
export class CastlePresenceError extends Error {
    constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}
export function castleSingleWorkerAvailable(env: NodeJS.ProcessEnv = process.env) { return ![env.WEB_CONCURRENCY, env.PM2_INSTANCES, env.RAILWAY_REPLICA_COUNT].some(value => value !== undefined && (!/^\d+$/.test(value) || Number(value) !== 1)) && (!env.NODE_APP_INSTANCE || env.NODE_APP_INSTANCE === '0'); }
export class CastlePresenceStore {
    readonly instanceEpoch = randomUUID();
    private entries = new Map<string, Entry>();
    private readonly origin: number;
    constructor(private verify: CastleLeaseVerifier, private clock = () => performance.now(), wall = () => Date.now()) { this.origin = wall() - clock(); }
    private now() { return this.origin + this.clock(); }
    private prune() { const now = this.clock(); for (const [id, entry] of this.entries) {
        for (const [token, lease] of entry.leases)
            if (lease.expires <= now)
                entry.leases.delete(token);
        if (!entry.leases.size)
            this.entries.delete(id);
        for (const [id, expires] of entry.commands)
            if (expires <= now)
                entry.commands.delete(id);
    } }
    private owned(actor: CastleActor, token: string | undefined) { this.prune(); const entry = this.entries.get(actor.actorId), lease = token ? entry?.leases.get(token) : undefined; if (!entry || !lease || entry.church !== actor.church || lease.sid !== actor.sid || lease.sessionVersion !== actor.sessionVersion || lease.authSub !== actor.authSub)
        throw new CastlePresenceError(409, '請重新加入城堡'); return { entry, lease }; }
    join(actor: CastleActor, input: CastleJoin, previous?: string) {
        this.prune();
        let entry = this.entries.get(actor.actorId);
        if (entry?.church !== actor.church) {
            this.entries.delete(actor.actorId);
            entry = undefined;
        }
        if (!entry) {
            if (this.entries.size >= 256 || [...this.entries.values()].filter(e => e.church === actor.church).length >= CASTLE_MAX_RESIDENTS)
                throw new CastlePresenceError(503, '城堡目前已滿，請稍後再試');
            entry = { actorId: actor.actorId, church: actor.church, avatarId: randomUUID(), alias: input.alias, preset: input.preset, motion: { sequence: 0, path: [WALK_NODES[0]], startedAt: this.now(), durationMs: 0 }, leases: new Map(), lastMove: -Infinity, commands: new Map() };
            this.entries.set(actor.actorId, entry);
        }
        const old = previous ? entry.leases.get(previous) : undefined;
        if (old && old.sid === actor.sid && old.authSub === actor.authSub && old.sessionVersion === actor.sessionVersion) {
            old.expires = this.clock() + CASTLE_TTL_MS;
            return { avatarId: entry.avatarId, leaseToken: old.token };
        }
        if (entry.leases.size >= 4)
            throw new CastlePresenceError(429, '此帳號已開啟多個城堡分頁，請先關閉其中一個', 25);
        entry.alias = input.alias;
        entry.preset = input.preset;
        const token = randomBytes(32).toString('base64url');
        entry.leases.set(token, { ...actor, token, expires: this.clock() + CASTLE_TTL_MS });
        return { avatarId: entry.avatarId, leaseToken: token };
    }
    heartbeat(actor: CastleActor, token?: string) { const { lease } = this.owned(actor, token); lease.expires = this.clock() + CASTLE_TTL_MS; }
    move(actor: CastleActor, token: string | undefined, targetNode: number, command?: string) { const { entry } = this.owned(actor, token); if (command && entry.commands.has(command))
        return; if (this.clock() - entry.lastMove < 1100)
        throw new CastlePresenceError(429, '請稍候再移動', 2); entry.motion = planCastleMotion(entry.motion, targetNode, this.now()); entry.lastMove = this.clock(); if (command) {
        if (entry.commands.size >= 24)
            entry.commands.delete(entry.commands.keys().next().value!);
        entry.commands.set(command, this.clock() + CASTLE_TTL_MS);
    } }
    leave(actor: CastleActor, token?: string) { try {
        const { entry } = this.owned(actor, token);
        entry.leases.delete(token!);
        if (!entry.leases.size)
            this.entries.delete(actor.actorId);
    }
    catch (error) {
        if (!(error instanceof CastlePresenceError))
            throw error;
    } }
    async roster(actor: CastleActor) {
        this.prune();
        const candidates = [...this.entries.values()].filter(e => e.church === actor.church).flatMap(entry => [...entry.leases.values()].map(lease => ({ entry, lease })));
        let valid: ReadonlySet<string>;
        const viewer = { ...actor, token: `viewer:${randomUUID()}` };
        try {
            valid = await this.verify([...candidates.map(({ lease }) => lease), viewer]);
        }
        catch {
            throw new CastlePresenceError(503, '暫時無法確認城堡連線，請稍後重試');
        }
        if (!valid.has(viewer.token))
            throw new CastlePresenceError(401, '登入或教會資料已改變，請重新確認');
        // Re-check object identity and TTL after awaiting DB: a leave/scope change must never be resurrected.
        const now = this.clock();
        const checked = new Set<Entry>();
        for (const { entry, lease } of candidates) {
            if (this.entries.get(entry.actorId) !== entry || entry.leases.get(lease.token) !== lease)
                continue;
            if (lease.expires <= now || !valid.has(lease.token))
                entry.leases.delete(lease.token);
            else
                checked.add(entry);
            if (!entry.leases.size)
                this.entries.delete(entry.actorId);
        }
        const avatars = [...checked].filter(entry => this.entries.get(entry.actorId) === entry && entry.church === actor.church && [...entry.leases.values()].some(lease => lease.expires > now && valid.has(lease.token))).map(entry => ({ avatarId: entry.avatarId, alias: entry.alias, preset: entry.preset, isSelf: entry.actorId === actor.actorId, motion: entry.motion }));
        return { instanceEpoch: this.instanceEpoch, serverNow: this.now(), ttlMs: CASTLE_TTL_MS as 25000, avatars };
    }
    clear() { this.entries.clear(); }
}
