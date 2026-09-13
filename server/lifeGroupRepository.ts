import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { pool } from './db';
import { careInput, careUpdateInput, shareInput, shareEditInput } from '../shared/lifeGroup';

export class GroupError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const missing = () => new GroupError(404, '找不到內容，或你已不在這個小組。');
const conflict = () => new GroupError(409, '內容已更新，請重新載入後再試；你的輸入尚未送出。');
const activeMember = `(g.leader_user_id=$2 OR g.pastor_user_id=$2 OR EXISTS (SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$2 AND m.is_active))`;
const nameSql = (alias: string) => `COALESCE(NULLIF(${alias}.display_name,''),'小組成員')`;

async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
export async function groupAccess(c: PoolClient, groupId: string, actor: string, managerOnly = false) {
  // Locks protect against membership removal during a read or mutation, including CRM changes.
  const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 AND is_active FOR SHARE', [groupId])).rows[0];
  if (!g) throw missing();
  const manager = g.leader_user_id === actor || g.pastor_user_id === actor;
  const membership = await c.query('SELECT id FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active FOR SHARE', [groupId, actor]);
  if (!manager && (!membership.rowCount || managerOnly)) throw missing();
  return { id: g.id, name: g.name, church: g.church, manager };
}
function withGroup<T>(groupId: string, actor: string, work: (c: PoolClient, group: Awaited<ReturnType<typeof groupAccess>>) => Promise<T>, managerOnly = false) {
  return transaction(async c => work(c, await groupAccess(c, groupId, actor, managerOnly)));
}
export async function canCreateGroup(actor: string) {
  return Boolean((await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN ('admin','senior_pastor','pastor','minister','group_leader','leader') LIMIT 1", [actor])).rowCount);
}
export async function myGroups(actor: string) {
  const groups = (await pool.query(`SELECT g.id,g.name,g.church,(g.leader_user_id=$1 OR g.pastor_user_id=$1) IS TRUE AS manager,
    (SELECT count(DISTINCT uid)::int FROM (SELECT user_id AS uid FROM small_group_members WHERE group_id=g.id AND is_active UNION SELECT g.leader_user_id UNION SELECT g.pastor_user_id) a WHERE uid IS NOT NULL) AS "memberCount"
    FROM small_groups g WHERE g.is_active AND ${activeMember.replaceAll('$2', '$1')} ORDER BY g.name`, [actor])).rows;
  const requests = (await pool.query("SELECT r.group_id AS id,g.name,r.status FROM life_group_requests r JOIN small_groups g ON g.id=r.group_id WHERE r.user_id=$1 AND g.is_active AND r.status!='approved' ORDER BY r.created_at DESC", [actor])).rows;
  return { groups, requests, canCreate: await canCreateGroup(actor) };
}
export async function createGroup(actor: string, name: string) {
  if (!await canCreateGroup(actor)) throw new GroupError(403, '請由小組長或同工建立小組。');
  return (await pool.query("INSERT INTO small_groups(name,church,leader_user_id) SELECT $2,COALESCE(NULLIF(church,''),'未分配教會'),id FROM users WHERE id=$1 RETURNING id,name", [actor, name])).rows[0];
}
async function members(c: PoolClient, id: string) {
  return (await c.query(`SELECT u.id,${nameSql('u')} AS name,(u.id=g.leader_user_id OR u.id=g.pastor_user_id) IS TRUE AS manager
    FROM small_groups g JOIN users u ON u.id=g.leader_user_id OR u.id=g.pastor_user_id OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=u.id AND m.is_active)
    WHERE g.id=$1 ORDER BY manager DESC,name,u.id`, [id])).rows;
}
export function groupInfo(id: string, actor: string) {
  return withGroup(id, actor, async (c, group) => ({ ...group, members: await members(c, id), requests: group.manager ? (await c.query(`SELECT r.user_id AS id,${nameSql('u')} AS name FROM life_group_requests r JOIN users u ON u.id=r.user_id WHERE r.group_id=$1 AND r.status='pending' ORDER BY r.created_at`, [id])).rows : [] }));
}
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function rotateInvite(id: string, actor: string) {
  return withGroup(id, actor, async c => {
    const token = randomBytes(24).toString('hex');
    const result = await c.query("INSERT INTO life_group_invites(group_id,token_hash,expires_at,created_by) VALUES($1,$2,now()+interval '7 days',$3) ON CONFLICT(group_id) DO UPDATE SET token_hash=$2,expires_at=now()+interval '7 days',created_by=$3 RETURNING expires_at AS \"expiresAt\"", [id, hashToken(token), actor]);
    return { token, expiresAt: result.rows[0].expiresAt };
  }, true);
}
export function requestJoin(actor: string, token: string) {
  return transaction(async c => {
    const invitation = (await c.query('SELECT i.group_id,g.name FROM life_group_invites i JOIN small_groups g ON g.id=i.group_id WHERE i.token_hash=$1 AND i.expires_at>now() AND g.is_active FOR SHARE OF i,g', [hashToken(token)])).rows[0];
    if (!invitation) throw new GroupError(404, '邀請碼無效或已過期，請向小組長索取。');
    const already = (await c.query(`SELECT 1 FROM small_groups g WHERE g.id=$1 AND ${activeMember}`, [invitation.group_id, actor])).rowCount;
    if (already) return { status: 'approved', name: invitation.name };
    await c.query("INSERT INTO life_group_requests(group_id,user_id,status) VALUES($1,$2,'pending') ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',created_at=now()", [invitation.group_id, actor]);
    return { status: 'pending', name: invitation.name };
  });
}
export function decideJoin(id: string, actor: string, userId: string, approve: boolean) {
  return transaction(async c => {
    await c.query('SELECT id FROM small_groups WHERE id=$1 FOR UPDATE', [id]);
    await groupAccess(c, id, actor, true);
    const r = await c.query("UPDATE life_group_requests SET status=$3 WHERE group_id=$1 AND user_id=$2 AND status='pending' RETURNING user_id", [id, userId, approve ? 'approved' : 'rejected']);
    if (!r.rowCount) throw conflict();
    if (approve) await c.query('INSERT INTO small_group_members(group_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active)', [id, userId]);
    return { ok: true };
  });
}
export function removeMember(id: string, actor: string, userId: string) {
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 AND is_active FOR UPDATE', [id])).rows[0];
    await groupAccess(c, id, actor, actor !== userId);
    if (g.leader_user_id === userId || g.pastor_user_id === userId) throw new GroupError(409, '請先在後台交接小組長，再移出或退出。');
    await c.query('UPDATE small_group_members SET is_active=false,updated_at=now() WHERE group_id=$1 AND user_id=$2', [id, userId]);
    await c.query("DELETE FROM life_group_requests WHERE group_id=$1 AND user_id=$2", [id, userId]);
    await c.query('DELETE FROM life_group_care_watches WHERE user_id=$2 AND care_id IN(SELECT id FROM life_group_care WHERE group_id=$1)', [id, userId]);
    return { ok: true };
  });
}
export function groupReading(id: string, actor: string, date: string) {
  return withGroup(id, actor, async c => {
    const entry = (await c.query(`SELECT id,date::text,version,plan_name AS "planName",scripture_reference AS reference,scripture_text AS "scriptureText",devotional_title AS title,devotional_text AS body,prayer,love_action AS "loveAction" FROM church_devotions WHERE date=$1 AND status='published'`, [date])).rows[0] || null;
    const readers = entry ? (await c.query(`SELECT u.id,${nameSql('u')} AS name FROM life_group_reading r JOIN users u ON u.id=r.user_id JOIN small_groups g ON g.id=r.group_id WHERE r.group_id=$1 AND r.devotion_id=$2 AND r.devotion_version=$3 AND (g.leader_user_id=u.id OR g.pastor_user_id=u.id OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=u.id AND m.is_active)) ORDER BY r.created_at`, [id, entry.id, entry.version])).rows : [];
    return { entry, readers };
  });
}
export function markReading(id: string, actor: string, devotionId: string, version: number, done: boolean) {
  return withGroup(id, actor, async c => {
    if (!(await c.query("SELECT id FROM church_devotions WHERE id=$1 AND version=$2 AND status='published' FOR SHARE", [devotionId, version])).rowCount) throw conflict();
    if (done) await c.query('INSERT INTO life_group_reading(group_id,user_id,devotion_id,devotion_version) VALUES($1,$2,$3,$4) ON CONFLICT(group_id,user_id,devotion_id) DO UPDATE SET devotion_version=$4,created_at=now()', [id, actor, devotionId, version]);
    else await c.query('DELETE FROM life_group_reading WHERE group_id=$1 AND user_id=$2 AND devotion_id=$3', [id, actor, devotionId]);
    return { ok: true };
  });
}
export async function shareSources(actor: string, kind: 'note' | 'prayer') {
  if (kind === 'prayer') return (await pool.query('SELECT id,title,prayer AS body,\'\' AS reference FROM personal_prayers WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200', [actor])).rows;
  return (await pool.query(`SELECT id,COALESCE(NULLIF(title_phrase,''),NULLIF(theme,''),verse_reference) AS title,verse_reference AS reference,
    concat_ws(E'\n\n',NULLIF(notes,''),NULLIF(observation,''),NULLIF(core_insight_note,''),NULLIF(action_plan,''),NULLIF(new_understanding,'')) AS body
    FROM devotional_notes WHERE user_id=$1 AND hidden=false ORDER BY updated_at DESC LIMIT 200`, [actor])).rows;
}
async function share(c: PoolClient, groupId: string, shareId: string) {
  const row = (await c.query('SELECT * FROM life_group_shares WHERE id=$1 AND group_id=$2 AND withdrawn_at IS NULL FOR UPDATE', [shareId, groupId])).rows[0];
  if (!row) throw missing();
  return row;
}
export function listShares(id: string, actor: string, kind: string, offset: number) {
  return withGroup(id, actor, async c => (await c.query(`SELECT s.id,CASE WHEN s.is_anonymous THEN NULL ELSE s.author_id END AS "authorId",CASE WHEN s.is_anonymous THEN '匿名' ELSE ${nameSql('u')} END AS "authorName",s.is_anonymous AS anonymous,s.author_id=$2 AS "isOwner",s.kind,s.title,s.body,s.reference,s.answered,s.version,s.created_at AS "createdAt",
    EXISTS(SELECT 1 FROM life_group_prayed WHERE share_id=s.id AND user_id=$2) AS prayed,
    (SELECT count(*)::int FROM life_group_prayed WHERE share_id=s.id) AS "prayerCount",
    (SELECT count(*)::int FROM life_group_comments WHERE share_id=s.id AND withdrawn_at IS NULL) AS "commentCount"
    FROM life_group_shares s JOIN users u ON u.id=s.author_id WHERE s.group_id=$1 AND s.kind=$3 AND s.withdrawn_at IS NULL ORDER BY s.created_at DESC,s.id DESC LIMIT 30 OFFSET $4`, [id, actor, kind, offset])).rows);
}
export function createShare(id: string, actor: string, shareId: string, input: z.infer<typeof shareInput>) {
  return withGroup(id, actor, async c => {
    const previous = (await c.query('SELECT group_id,author_id FROM life_group_shares WHERE id=$1', [shareId])).rows[0];
    if (previous) { if (previous.group_id !== id || previous.author_id !== actor) throw conflict(); return { id: shareId }; }
    if (input.sourceId) {
      const table = input.kind === 'note' ? 'devotional_notes' : 'personal_prayers';
      if (!(await c.query(`SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`, [input.sourceId, actor])).rowCount) throw missing();
    }
    await c.query('INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,reference,source_id,is_anonymous) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [shareId, id, actor, input.kind, input.title, input.body, input.reference, input.sourceId, input.kind === 'prayer' && input.anonymous]);
    return { id: shareId };
  });
}
export function editShare(id: string, actor: string, shareId: string, input: z.infer<typeof shareEditInput>) {
  return withGroup(id, actor, async c => {
    const s = await share(c, id, shareId);
    if (s.author_id !== actor) throw missing();
    if (s.version !== input.version) throw conflict();
    await c.query('UPDATE life_group_shares SET title=$2,body=$3,reference=$4,answered=$5,version=version+1,updated_at=now() WHERE id=$1', [shareId, input.title, input.body, input.reference, s.kind === 'prayer' && input.answered]);
    return { ok: true };
  });
}
export function withdrawShare(id: string, actor: string, shareId: string) {
  return withGroup(id, actor, async (c, g) => {
    const s = await share(c, id, shareId);
    if (s.author_id !== actor && !g.manager) throw missing();
    await c.query('UPDATE life_group_shares SET withdrawn_at=now() WHERE id=$1', [shareId]);
    return { ok: true };
  });
}
export function shareComments(id: string, actor: string, shareId: string, offset: number) {
  return withGroup(id, actor, async c => {
    await share(c, id, shareId);
    return (await c.query(`SELECT c.id,c.author_id AS "authorId",${nameSql('u')} AS "authorName",c.body,c.created_at AS "createdAt" FROM life_group_comments c JOIN users u ON u.id=c.author_id WHERE share_id=$1 AND withdrawn_at IS NULL ORDER BY c.created_at DESC,c.id DESC LIMIT 30 OFFSET $2`, [shareId, offset])).rows;
  });
}
export function addComment(id: string, actor: string, shareId: string, commentId: string, body: string) {
  return withGroup(id, actor, async c => {
    await share(c, id, shareId);
    const existing = (await c.query('SELECT share_id,author_id FROM life_group_comments WHERE id=$1', [commentId])).rows[0];
    if (existing && (existing.share_id !== shareId || existing.author_id !== actor)) throw conflict();
    await c.query('INSERT INTO life_group_comments(id,share_id,author_id,body) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [commentId, shareId, actor, body]);
    return { ok: true };
  });
}
export function withdrawComment(id: string, actor: string, shareId: string, commentId: string) {
  return withGroup(id, actor, async (c, g) => {
    await share(c, id, shareId);
    if (!(await c.query('UPDATE life_group_comments SET withdrawn_at=now() WHERE id=$1 AND share_id=$2 AND (author_id=$3 OR $4) RETURNING id', [commentId, shareId, actor, g.manager])).rowCount) throw missing();
    return { ok: true };
  });
}
export function prayForShare(id: string, actor: string, shareId: string) {
  return withGroup(id, actor, async c => {
    const s = await share(c, id, shareId);
    if (s.kind !== 'prayer') throw missing();
    await c.query('INSERT INTO life_group_prayed(share_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [shareId, actor]);
    return { ok: true };
  });
}
async function responsible(c: PoolClient, groupId: string, userId: string | null) {
  if (userId && !(await members(c, groupId)).some(m => m.id === userId)) throw new GroupError(400, '負責人必須是目前的小組成員。');
}
const careColumns = `a.id,a.creator_id AS "creatorId",a.name,a.need,a.status,a.responsible_id AS "responsibleId",a.next_action AS "nextAction",a.due_date::text AS "dueDate",a.version,a.updated_at AS "updatedAt"`;
export function listCare(id: string, actor: string, offset: number, watching: boolean) {
  return withGroup(id, actor, async c => (await c.query(`SELECT ${careColumns}, EXISTS(SELECT 1 FROM life_group_care_watches w WHERE w.care_id=a.id AND w.user_id=$2) AS watching,
    (SELECT count(*)::int FROM life_group_care_watches WHERE care_id=a.id) AS "watcherCount" FROM life_group_care a WHERE group_id=$1 AND withdrawn_at IS NULL
    AND (NOT $4 OR EXISTS(SELECT 1 FROM life_group_care_watches w WHERE w.care_id=a.id AND w.user_id=$2)) ORDER BY updated_at DESC,id DESC LIMIT 30 OFFSET $3`, [id, actor, offset, watching])).rows);
}
async function care(c: PoolClient, id: string, careId: string) {
  const row = (await c.query('SELECT * FROM life_group_care WHERE id=$1 AND group_id=$2 AND withdrawn_at IS NULL FOR UPDATE', [careId, id])).rows[0];
  if (!row) throw missing();
  return row;
}
export function createCare(id: string, actor: string, careId: string, input: z.infer<typeof careInput>) {
  return withGroup(id, actor, async c => {
    const existing = (await c.query('SELECT group_id,creator_id FROM life_group_care WHERE id=$1', [careId])).rows[0];
    if (existing) { if (existing.group_id !== id || existing.creator_id !== actor) throw conflict(); return { id: careId }; }
    await responsible(c, id, input.responsibleId);
    await c.query('INSERT INTO life_group_care(id,group_id,creator_id,name,need,responsible_id,next_action,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [careId, id, actor, input.name, input.need, input.responsibleId, input.nextAction, input.dueDate]);
    await c.query('INSERT INTO life_group_care_watches(care_id,user_id) VALUES($1,$2)', [careId, actor]);
    return { id: careId };
  });
}
export function careHistory(id: string, actor: string, careId: string, offset: number) {
  return withGroup(id, actor, async c => {
    await care(c, id, careId);
    return (await c.query(`SELECT h.id,h.author_id AS "authorId",${nameSql('u')} AS "authorName",h.body,h.status,h.next_action AS "nextAction",h.due_date::text AS "dueDate",h.responsible_id AS "responsibleId",h.created_at AS "createdAt" FROM life_group_care_updates h JOIN users u ON u.id=h.author_id WHERE care_id=$1 ORDER BY h.created_at DESC,h.id DESC LIMIT 30 OFFSET $2`, [careId, offset])).rows;
  });
}
export function editCare(id: string, actor: string, careId: string, version: number, input: z.infer<typeof careInput>) {
  return withGroup(id, actor, async (c, g) => {
    const a = await care(c, id, careId);
    if (a.creator_id !== actor && !g.manager) throw missing();
    if (a.version !== version) throw conflict();
    await responsible(c, id, input.responsibleId);
    await c.query('UPDATE life_group_care SET name=$2,need=$3,responsible_id=$4,next_action=$5,due_date=$6,version=version+1,updated_at=now(),consent_confirmed_at=now() WHERE id=$1', [careId,input.name,input.need,input.responsibleId,input.nextAction,input.dueDate]);
    await c.query('INSERT INTO life_group_care_updates(id,care_id,author_id,body,status,next_action,due_date,responsible_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(),careId,actor,'已更新關懷對象資料與安排。',a.status,input.nextAction,input.dueDate,input.responsibleId]);
    return { ok: true };
  });
}
export function updateCare(id: string, actor: string, careId: string, updateId: string, input: z.infer<typeof careUpdateInput>) {
  return withGroup(id, actor, async c => {
    const a = await care(c, id, careId);
    const previous = (await c.query('SELECT care_id,author_id FROM life_group_care_updates WHERE id=$1', [updateId])).rows[0];
    if (previous) { if (previous.care_id !== careId || previous.author_id !== actor) throw conflict(); return { ok: true }; }
    if (a.version !== input.version) throw conflict();
    await responsible(c, id, input.responsibleId);
    await c.query('INSERT INTO life_group_care_updates(id,care_id,author_id,body,status,next_action,due_date,responsible_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [updateId, careId, actor, input.body, input.status, input.nextAction, input.dueDate, input.responsibleId]);
    await c.query('UPDATE life_group_care SET status=$2,next_action=$3,due_date=$4,responsible_id=$5,version=version+1,updated_at=now() WHERE id=$1', [careId, input.status, input.nextAction, input.dueDate, input.responsibleId]);
    return { ok: true };
  });
}
export function watchCare(id: string, actor: string, careId: string, watch: boolean) {
  return withGroup(id, actor, async c => {
    await care(c, id, careId);
    if (watch) await c.query('INSERT INTO life_group_care_watches(care_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [careId, actor]);
    else await c.query('DELETE FROM life_group_care_watches WHERE care_id=$1 AND user_id=$2', [careId, actor]);
    return { ok: true };
  });
}
export function withdrawCare(id: string, actor: string, careId: string) {
  return withGroup(id, actor, async (c, g) => {
    const a = await care(c, id, careId);
    if (a.creator_id !== actor && !g.manager) throw missing();
    await c.query('UPDATE life_group_care SET withdrawn_at=now() WHERE id=$1', [careId]);
    return { ok: true };
  });
}
