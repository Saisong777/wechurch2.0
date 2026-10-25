import { randomUUID } from 'node:crypto';
import { castleAvatarProfileSchema, castleProfileResponseSchema, castleProfileSaveSchema, defaultCastleProfile, type CastleProfileResponse, type CastleProfileSave } from '../shared/castleAvatar';
import { lockChurchContext } from './churchContext';
import { CastlePresenceError, type CastleActor, type CastleLeaseVerifier } from './castlePresenceStore';
export type CastleProfileQuery = {
    query: (text: string, values?: unknown[]) => Promise<{
        rows: Record<string, unknown>[];
    }>;
};
export type CastleProfilePool = CastleProfileQuery & {
    connect: () => Promise<CastleProfileQuery & {
        release: () => void;
    }>;
};
export class CastleAvatarRepository {
    private queues = new Map<string, {
        tail: Promise<void>;
        pending: number;
    }>();
    async run<T>(actor: CastleActor, work: () => Promise<T>): Promise<T> {
        let queue = this.queues.get(actor.actorId);
        if (!queue) {
            if (this.queues.size >= 256)
                throw new CastlePresenceError(503, '造型服務忙碌，請稍後重試。');
            queue = { tail: Promise.resolve(), pending: 0 };
            this.queues.set(actor.actorId, queue);
        }
        if (queue.pending >= 8)
            throw new CastlePresenceError(429, '造型操作稍快，請稍後重試。', 2);
        const previous = queue.tail;
        let unlock!: () => void;
        queue.tail = new Promise<void>(resolve => {
            unlock = resolve;
        });
        queue.pending++;
        await previous;
        try {
            return await work();
        }
        finally {
            queue.pending--;
            unlock();
            if (!queue.pending)
                this.queues.delete(actor.actorId);
        }
    }
    constructor(private db: CastleProfilePool, private verifier: (query: CastleProfileQuery) => CastleLeaseVerifier) {
    }
    private async authorized(actor: CastleActor, query: CastleProfileQuery) {
        const candidate = { ...actor, token: `profile:${randomUUID()}` };
        if (!(await this.verifier(query)([candidate])).has(candidate.token))
            throw new CastlePresenceError(401, '登入或教會資料已改變，請重新確認造型儲存狀態。');
    }
    async read(actor: CastleActor): Promise<CastleProfileResponse> {
        await this.authorized(actor, this.db);
        const row = (await this.db.query('SELECT u.display_name,p.profile,p.revision FROM users u LEFT JOIN castle_avatar_profiles p ON p.user_id=u.id WHERE u.id=$1', [actor.actorId])).rows[0];
        if (!row)
            throw new CastlePresenceError(401, '請重新登入。');
        const result = castleProfileResponseSchema.parse({ profile: row.profile ? castleAvatarProfileSchema.parse(row.profile) : defaultCastleProfile(typeof row.display_name === 'string' ? row.display_name : null), revision: row.profile ? row.revision : 0 });
        await this.authorized(actor, this.db);
        return result;
    }
    async save(actor: CastleActor, body: CastleProfileSave): Promise<CastleProfileResponse> {
        const input = castleProfileSaveSchema.parse(body), client = await this.db.connect();
        let committed = false;
        let result: CastleProfileResponse;
        try {
            await client.query('BEGIN');
            await lockChurchContext(client);
            await this.authorized(actor, client);
            const rows = input.expectedRevision === 0 ? (await client.query('INSERT INTO castle_avatar_profiles(user_id,profile) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO NOTHING RETURNING profile,revision', [actor.actorId, JSON.stringify(input.profile)])).rows : (await client.query('UPDATE castle_avatar_profiles SET profile=$2::jsonb,revision=revision+1,updated_at=now() WHERE user_id=$1 AND revision=$3 RETURNING profile,revision', [actor.actorId, JSON.stringify(input.profile), input.expectedRevision])).rows;
            if (!rows.length)
                throw new CastlePresenceError(409, '造型已在另一個視窗更新，請重新載入後再儲存。');
            result = castleProfileResponseSchema.parse(rows[0]);
            await client.query('COMMIT');
            committed = true;
        }
        catch (error) {
            if (!committed)
                await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        // A response/auth failure after COMMIT is not a rollback: the next legal GET reconciles it.
        await this.authorized(actor, this.db);
        return result!;
    }
}
