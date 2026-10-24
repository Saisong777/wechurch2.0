import { Router, type Request, type RequestHandler, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { castleEmptySchema, castleJoinSchema, castleMoveSchema } from '../shared/castlePresence';
import { normalizeChurch } from '../shared/churches';
import { CastlePresenceError, CastlePresenceStore, castleSingleWorkerAvailable, type CastleActor, type CastleLeaseVerifier } from './castlePresenceStore';
import { churchContext } from './churchContext';
import { boundedWindowLimiter } from './requestLimits';
// Only three bounded, read-only queries per roster; never stores presence in auth/session tables.
export function castleLeaseVerifier(query: {
    query: (text: string, values: unknown[]) => Promise<{
        rows: any[];
    }>;
}): CastleLeaseVerifier {
    return async (candidates) => {
        if (!candidates.length)
            return new Set();
        const users = (await query.query("SELECT u.id,u.church,u.session_version,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') AS admin FROM users u WHERE u.id=ANY($1::uuid[])", [[...new Set(candidates.map(c => c.actorId))]])).rows;
        const sessions = (await query.query('SELECT sid,sess,expire FROM auth_sessions WHERE sid=ANY($1::text[])', [[...new Set(candidates.map(c => c.sid))]])).rows;
        const mappings = (await query.query('SELECT a.id,CASE WHEN g.auth_user_id IS NOT NULL THEN g.user_id ELSE u.id END AS actor_id FROM auth_users a LEFT JOIN google_account_links g ON g.auth_user_id=a.id LEFT JOIN users u ON u.email=a.email WHERE a.id=ANY($1::text[])', [[...new Set(candidates.map(c => c.authSub))]])).rows;
        const byMapping = new Map(mappings.map(m => [m.id, m.actor_id]));
        const byUser = new Map(users.map(u => [u.id, u])), bySession = new Map(sessions.map(s => [s.sid, s]));
        const valid = new Set<string>(), now = Date.now();
        for (const candidate of candidates) {
            const user = byUser.get(candidate.actorId), session = bySession.get(candidate.sid);
            let saved = session?.sess;
            if (typeof saved === 'string') {
                try {
                    saved = JSON.parse(saved);
                }
                catch {
                    continue;
                }
            }
            const identity = saved?.passport?.user;
            if (byMapping.get(candidate.authSub) !== candidate.actorId || !user || user.session_version !== candidate.sessionVersion || (!user.admin && normalizeChurch(user.church) !== candidate.church) || !session || !Number.isFinite(new Date(session.expire).getTime()) || new Date(session.expire).getTime() <= now || !identity || identity.sessionUserId !== candidate.actorId || identity.sessionVersion !== candidate.sessionVersion || identity.claims?.sub !== candidate.authSub || !Number.isSafeInteger(identity.expires_at) || identity.expires_at * 1000 <= now)
                continue;
            valid.add(candidate.token);
        }
        return valid;
    };
}
export function castlePresenceRoutes(store: CastlePresenceStore, authenticate: RequestHandler, context = churchContext, available = castleSingleWorkerAvailable()) {
    const router = Router();
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); if (!available)
        return void res.status(503).json({ error: '城堡連線尚未開放，仍可探索建築。' }); next(); });
    router.use(authenticate);
    router.use((req, res, next) => {
        const user = req.user as any, c = context();
        if (!user?.sessionUserId || !req.sessionID || !Number.isSafeInteger(user.sessionVersion) || !user.claims?.sub)
            return void res.status(401).json({ error: '請先登入。' });
        if (!c?.selectedChurch || c.actorId !== user.sessionUserId)
            return void res.status(403).json({ error: '請先確認所屬教會。' });
        res.locals.castleActor = { actorId: user.sessionUserId, church: c.selectedChurch, sid: req.sessionID, sessionVersion: user.sessionVersion, authSub: user.claims.sub } satisfies CastleActor;
        if (Object.keys(req.query).some(key => key !== 'church'))
            return void res.status(400).json({ error: '城堡請求格式不正確。' });
        if (!['GET', 'HEAD'].includes(req.method)) {
            let invalid = req.get('sec-fetch-site') === 'cross-site';
            try {
                if (req.get('origin'))
                    invalid ||= new URL(req.get('origin')!).host !== req.get('host');
            }
            catch {
                invalid = true;
            }
            if (invalid)
                return void res.status(403).json({ error: '不接受跨網站寫入。' });
        }
        next();
    });
    // Shared actor limiter includes all tabs, preserving space for other application writes.
    const moves = boundedWindowLimiter({ max: 40, key: req => (req.user as any).sessionUserId });
    const writes = boundedWindowLimiter({ max: 60, key: req => (req.user as any).sessionUserId });
    const lease = (req: Request) => { const value = req.get('X-Castle-Lease'); return value ? z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(value) : undefined; };
    router.get('/', async (_req, res) => { res.json(await store.roster(res.locals.castleActor)); });
    router.post('/join', writes, async (req, res) => { const input = castleJoinSchema.parse(req.body); const joined = store.join(res.locals.castleActor, input, lease(req)); try {
        res.json({ ...await store.roster(res.locals.castleActor), ...joined });
    }
    catch (error) {
        store.leave(res.locals.castleActor, joined.leaseToken);
        throw error;
    } });
    router.post('/heartbeat', writes, async (req, res) => { castleEmptySchema.parse(req.body); store.heartbeat(res.locals.castleActor, lease(req)); res.json(await store.roster(res.locals.castleActor)); });
    router.post('/move', writes, moves, async (req, res) => { const input = castleMoveSchema.parse(req.body), command = req.get('X-Castle-Command-ID'); if (command)
        z.string().uuid().parse(command); store.move(res.locals.castleActor, lease(req), input.targetNode, command); res.json(await store.roster(res.locals.castleActor)); });
    router.delete('/leave', writes, (req, res) => { if (req.body !== undefined)
        throw new CastlePresenceError(400, '離開城堡不需其他資料'); store.leave(res.locals.castleActor, lease(req)); res.json({ ok: true }); });
    const errors: ErrorRequestHandler = (error, _req, res, _next) => { if (error instanceof z.ZodError)
        return void res.status(400).json({ error: '城堡請求格式不正確。' }); if (error instanceof CastlePresenceError) {
        if (error.retryAfter)
            res.setHeader('Retry-After', error.retryAfter);
        return void res.status(error.status).json({ error: error.message });
    } res.status(503).json({ error: '城堡暫時無法連線，請重試。' }); };
    router.use(errors);
    return router;
}
