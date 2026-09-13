import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import type { Participant } from '@shared/schema';

interface AccessDependencies {
  pool: Pool;
  resolveUserId: (req: Request) => Promise<string | null | undefined>;
  canManageSession: (req: Request) => Promise<boolean>;
}
export function browserIdentity(req: Request): string {
  if (!req.sessionID || !process.env.SESSION_SECRET) throw new Error('Session identity unavailable');
  return createHmac('sha256', process.env.SESSION_SECRET).update(req.sessionID).digest('hex');
}

export function soulGymAccess(deps: AccessDependencies) {
  const { pool, resolveUserId, canManageSession } = deps;
  async function owned(req: Request, sessionId: string, participantId?: string) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(sessionId) || (participantId !== undefined && !uuid.test(participantId))) return null;
    const userId = await resolveUserId(req);
    const rows = await pool.query<{ id: string; groupNumber: number | null }>(
      `SELECT p.id, p.group_number AS "groupNumber" FROM participants p JOIN participant_access a ON a.participant_id=p.id
       WHERE p.session_id=$1 AND ((a.user_id IS NULL AND a.browser_hash=$2) OR a.user_id=$3)
       AND ($4::uuid IS NULL OR p.id=$4) ORDER BY p.joined_at DESC LIMIT 1`,
      [sessionId, browserIdentity(req), userId || null, participantId || null]);
    return rows.rows[0] || null;
  }
  async function canOwn(req: Request, participant: Pick<Participant, 'id' | 'sessionId'>) {
    return !!await owned(req, participant.sessionId, participant.id);
  }
  async function grant(req: Request) {
    const userId = await resolveUserId(req);
    // Persist the signed session cookie before granting a guest browser access.
    Object.assign(req.session, { soulGymJoined: true });
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return { userId: userId || null, browserHash: browserIdentity(req) };
  }
  const router = Router();
  const groupRead = async (req: Request, res: Response, next: () => void) => {
    if (await canManageSession(req)) { res.locals.soulGymManager = true; return next(); }
    const member = await owned(req, String(req.params.sessionId || req.params.id));
    if (!member) return res.status(403).json({ error: '請先以原瀏覽器或已綁定的帳號加入這場查經' });
    res.locals.soulGymParticipant = member;
    next();
  };
  router.get('/sessions/:id/poll', groupRead);
  router.get('/sessions/:sessionId/submissions', groupRead);
  router.get('/sessions/:sessionId/reports', groupRead);
  router.get('/sessions/:sessionId/participants', groupRead);
  router.post('/participants/:id/late-join', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid participant' });
    const participant = await pool.query('SELECT session_id FROM participants WHERE id=$1', [id.data]);
    const sessionId = participant.rows[0]?.session_id;
    if (!sessionId || !await owned(req, sessionId, id.data)) return res.status(403).json({ error: 'Participant identity required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const session = await client.query('SELECT allow_latecomers,status FROM sessions WHERE id=$1 FOR UPDATE', [sessionId]);
      if (!session.rows[0]?.allow_latecomers || session.rows[0].status === 'completed') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: '本場查經尚未開放晚到加入' });
      }
      const result = await client.query(`UPDATE participants SET group_number=(SELECT group_number FROM participants
        WHERE session_id=$2 AND location=(SELECT location FROM participants WHERE id=$1)
        AND group_number IS NOT NULL GROUP BY group_number ORDER BY count(*),group_number LIMIT 1),ready_confirmed=false
        WHERE id=$1 AND group_number IS NULL RETURNING id,group_number`, [id.data, sessionId]);
      await client.query('COMMIT');
      res.json({ success: true, participant: result.rows[0] || await owned(req, sessionId, id.data) });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
  router.post('/admin/participants/:id/restore-access', async (req, res) => {
    if (!await canManageSession(req)) return res.status(403).json({ error: 'Forbidden' });
    const body = z.object({ email: z.string().email(), reason: z.string().trim().min(5).max(500), confirmed: z.literal(true) }).safeParse(req.body);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!body.success || !id.success) return res.status(400).json({ error: '請確認本人身份、填寫登入帳號及確認依據' });
    const account = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [body.data.email]);
    if (!account.rows[0]) return res.status(404).json({ error: '請對方先建立登入帳號，再恢復舊紀錄' });
    const actorId = await resolveUserId(req);
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await pool.query(`INSERT INTO participant_access(participant_id,user_id,browser_hash,recovered_by,recovery_reason)
      SELECT id,$2,$3,$4,$5 FROM participants WHERE id=$1 ON CONFLICT(participant_id) DO NOTHING RETURNING participant_id`,
    [id.data, account.rows[0].id, randomUUID(), actorId, body.data.reason]);
    if (!result.rows[0]) return res.status(409).json({ error: '紀錄不存在或已有身份綁定，不會覆蓋原本權限' });
    res.json({ success: true });
  });

  return { router, owned, canOwn, grant };
}

export function visibleSubmissions<T extends { participantId: string; groupNumber: number | null; email?: string }>(
  submissions: T[], member?: { id: string; groupNumber: number | null }, manager = false,
) {
  if (manager) return submissions;
  if (!member) return [];
  return submissions.filter(item => item.participantId === member.id || (member.groupNumber !== null && item.groupNumber === member.groupNumber))
    .map(({ email: _email, ...item }) => item);
}
