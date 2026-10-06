import { churchPredicate, lockChurchContext } from './churchContext';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { pool } from './db';
import { getChurchAliases } from './churches';
import { GroupError } from './groupError';
import { visibleContent } from './lifeGroupRepository';
import { taipeiToday } from '../shared/churchDevotion';
import { createGatheringInput, saveAttendanceInput, type DashboardGroup } from '../shared/leaderDashboard';

const denied = () => new GroupError(404, '找不到內容，或已不在你的負責範圍。');
const conflict = () => new GroupError(409, '記錄已更新，請重新載入後再修改；本次輸入尚未儲存。');
async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await lockChurchContext(c); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

// Dashboard responsibility never implies membership or visibility of old shared content.
// Technical administrators need an explicit appointment or scoped assignment too.
async function scopes(c: PoolClient, actor: string, scope = 'all') {
  const user = (await c.query(`SELECT church,(SELECT CASE WHEN count(*)=1 THEN max(role::text) ELSE 'member' END FROM user_roles WHERE user_id=$1) AS role FROM users WHERE id=$1 FOR SHARE`, [actor])).rows[0];
  if (!user) throw denied();
  const grants = (await c.query(`SELECT scope_type,church,group_id FROM crm_scope_assignments WHERE assignee_user_id=$1 AND is_active
    AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) AND (can_manage_care OR can_manage_members) FOR SHARE`, [actor])).rows;
  const churches = new Set<string>(user.role === 'senior_pastor' ? getChurchAliases(user.church) : []);
  for (const grant of grants) if (grant.scope_type === 'church') for (const church of getChurchAliases(grant.church)) churches.add(church);
  const ids = grants.filter(g => g.scope_type === 'group').map(g => g.group_id);
  const groups = (await c.query(`SELECT g.id,g.name,g.church,((g.leader_user_id=$1 OR g.co_leader_user_id=$1) OR g.pastor_user_id=$1 OR EXISTS(
      SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$1 AND m.is_active)) IS TRUE AS "sharedReadable"
    FROM small_groups g WHERE ${churchPredicate('g')} AND g.is_active AND ((g.leader_user_id=$1 OR g.co_leader_user_id=$1) OR g.pastor_user_id=$1 OR g.church=ANY($2::text[]) OR g.id=ANY($3::uuid[]))
    ORDER BY g.name,g.id FOR SHARE OF g`, [actor, [...churches], ids])).rows as DashboardGroup[];
  const selected = scope === 'all' ? groups : groups.filter(g => g.id === scope);
  if (scope !== 'all' && !selected.length) throw denied();
  // Lock membership rows used by the existing history visibility policy until this request ends.
  await c.query('SELECT id FROM small_group_members WHERE group_id=ANY($1::uuid[]) AND user_id=$2 AND is_active FOR SHARE', [selected.map(g => g.id), actor]);
  return { groups, selected, ids: selected.map(g => g.id) };
}
const careWhere = () => `a.group_id=ANY($1::uuid[]) AND a.withdrawn_at IS NULL AND a.status IN ('new','following') AND ${visibleContent('a')}`;
const prayerWhere = () => `s.group_id=ANY($1::uuid[]) AND s.withdrawn_at IS NULL AND s.kind='prayer' AND ${visibleContent('s')}
  AND s.updated_at >= ($3::date::timestamp AT TIME ZONE 'Asia/Taipei') AND s.updated_at<=now()`;
const careFields = `a.id,a.group_id AS "groupId",g.name AS "groupName",a.name,a.status,a.due_date::text AS "dueDate",
  CASE WHEN a.responsible_id IS NULL THEN NULL ELSE COALESCE(NULLIF(u.display_name,''),'小家成員') END AS "responsibleName",a.responsible_id AS "responsibleId",a.next_action AS "nextAction",a.updated_at AS "updatedAt"`;
const careJoin = `FROM life_group_care a JOIN small_groups g ON g.id=a.group_id LEFT JOIN users u ON u.id=a.responsible_id`;
function dates() {
  const today = taipeiToday();
  const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 6);
  return { today, since: d.toISOString().slice(0, 10) };
}
const meetingFields = `m.id,m.group_id AS "groupId",g.name AS "groupName",m.gathering_date::text AS date,m.kind,m.cancelled,m.visitors,m.version`;
const meetingCounts = `(SELECT json_build_object('present',count(*) FILTER(WHERE a.status='present'),'excused',count(*) FILTER(WHERE a.status='excused'),
  'absent',count(*) FILTER(WHERE a.status='absent'),'unrecorded',count(*) FILTER(WHERE a.status='unrecorded')) FROM group_gathering_attendance a WHERE a.gathering_id=m.id) AS counts`;

export function dashboardAccess(actor: string) {
  return transaction(async c => ({ available: (await scopes(c, actor)).groups.length > 0 }));
}
export function dashboard(actor: string, scope: string) {
  return transaction(async c => {
    const a = await scopes(c, actor, scope); const { today, since } = dates();
    const care = (await c.query(`SELECT count(*)::int AS active,count(*) FILTER(WHERE a.due_date<=$3::date)::int AS due,
      count(*) FILTER(WHERE a.responsible_id IS NULL)::int AS unassigned FROM life_group_care a WHERE ${careWhere()}`, [a.ids, actor, today])).rows[0];
    const items = (await c.query(`SELECT ${careFields} ${careJoin} WHERE ${careWhere()} AND (a.due_date<=$3::date OR a.responsible_id IS NULL)
      ORDER BY a.due_date ASC NULLS LAST,a.updated_at,a.id LIMIT 5`, [a.ids, actor, today])).rows;
    const recent = (await c.query(`SELECT count(*)::int AS count FROM life_group_shares s WHERE ${prayerWhere()}`, [a.ids, actor, since])).rows[0].count;
    const prayers = await prayerRows(c, a.ids, actor, since, 0, 5);
    const gatherings = (await c.query(`SELECT ${meetingFields},${meetingCounts} FROM group_gatherings m JOIN small_groups g ON g.id=m.group_id
      WHERE m.group_id=ANY($1::uuid[]) AND NOT m.cancelled AND m.gathering_date<=$2::date
      AND m.id=(SELECT n.id FROM group_gatherings n WHERE n.group_id=m.group_id AND NOT n.cancelled AND n.gathering_date<=$2::date ORDER BY n.gathering_date DESC,n.created_at DESC,n.id DESC LIMIT 1)
      ORDER BY m.gathering_date DESC,g.name,m.id`, [a.ids, today])).rows;
    return { groups: a.groups, scope, today, since, updatedAt: new Date().toISOString(), care: { ...care, items }, prayers: { recent, items: prayers }, gatherings,
      groupsWithoutGathering: a.ids.length - gatherings.length };
  });
}
export function carePage(actor: string, scope: string, filter: string, offset: number) {
  return transaction(async c => {
    const a = await scopes(c, actor, scope);
    const where = `${careWhere()} AND ($3='active' OR ($3='due' AND a.due_date<=$4::date) OR ($3='unassigned' AND a.responsible_id IS NULL))`;
    const args = [a.ids, actor, filter, taipeiToday()];
    const total = (await c.query(`SELECT count(*)::int AS total FROM life_group_care a WHERE ${where}`, args)).rows[0].total;
    const items = (await c.query(`SELECT ${careFields} ${careJoin} WHERE ${where} ORDER BY a.due_date ASC NULLS LAST,a.updated_at,a.id LIMIT 30 OFFSET $5`, [...args, offset])).rows;
    return { items, total };
  });
}
async function prayerRows(c: PoolClient, ids: string[], actor: string, since: string, offset: number, limit: number) {
  return (await c.query(`SELECT s.id,s.group_id AS "groupId",g.name AS "groupName",s.title,s.answered,s.updated_at AS "updatedAt",
    CASE WHEN s.is_anonymous THEN '匿名' ELSE COALESCE(NULLIF(u.display_name,''),'小家成員') END AS "authorName"
    FROM life_group_shares s JOIN small_groups g ON g.id=s.group_id JOIN users u ON u.id=s.author_id WHERE ${prayerWhere()}
    ORDER BY s.updated_at DESC,s.id DESC LIMIT $4 OFFSET $5`, [ids, actor, since, limit, offset])).rows;
}
export function prayerPage(actor: string, scope: string, offset: number) {
  return transaction(async c => {
    const a = await scopes(c, actor, scope); const { since } = dates();
    const total = (await c.query(`SELECT count(*)::int AS total FROM life_group_shares s WHERE ${prayerWhere()}`, [a.ids, actor, since])).rows[0].total;
    return { total, items: await prayerRows(c, a.ids, actor, since, offset, 30) };
  });
}
export function gatheringsPage(actor: string, scope: string, offset: number) {
  return transaction(async c => {
    const a = await scopes(c, actor, scope);
    const total = (await c.query('SELECT count(*)::int AS total FROM group_gatherings WHERE group_id=ANY($1::uuid[])', [a.ids])).rows[0].total;
    const items = (await c.query(`SELECT ${meetingFields},${meetingCounts} FROM group_gatherings m JOIN small_groups g ON g.id=m.group_id
      WHERE m.group_id=ANY($1::uuid[]) ORDER BY m.gathering_date DESC,m.created_at DESC,m.id DESC LIMIT 30 OFFSET $2`, [a.ids, offset])).rows;
    return { total, items };
  });
}
async function roster(c: PoolClient, groupId: string, date: string) {
  // Legacy membership timestamps are UTC without timezone. Only actual departure
  // events may close an interval; generic updated_at is not a departure date.
  const eligible = `((m.joined_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')::date<=$2::date AND (m.is_active OR
    (SELECT min(e.created_at AT TIME ZONE 'Asia/Taipei')::date FROM family_membership_events e
      WHERE e.group_id=m.group_id AND e.user_id=m.user_id AND e.action IN ('left','removed','transferred_out')
      AND e.created_at >= (m.joined_at AT TIME ZONE 'UTC')) >= $2::date)`;
  return (await c.query(`SELECT 'user:'||u.id AS key,COALESCE(NULLIF(u.display_name,''),'小家成員') AS name
    FROM users u CROSS JOIN small_groups g WHERE g.id=$1 AND ((g.leader_user_id=u.id OR g.co_leader_user_id=u.id) OR g.pastor_user_id=u.id OR EXISTS(
      SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=u.id AND ${eligible}))
    UNION ALL SELECT 'membership:'||m.id,COALESCE(NULLIF(p.name,''),'未連結帳號的成員')
    FROM small_group_members m LEFT JOIN potential_members p ON p.id=m.potential_member_id WHERE m.group_id=$1 AND ${eligible} AND m.user_id IS NULL
    ORDER BY name,key`, [groupId,date])).rows as { key: string; name: string }[];
}
export function gatheringRoster(actor: string, groupId: string, date: string) {
  return transaction(async c => { await scopes(c, actor, groupId); return roster(c, groupId, date); });
}
export function createGathering(actor: string, groupId: string, id: string, input: z.infer<typeof createGatheringInput>) {
  return transaction(async c => {
    await scopes(c, actor, groupId);
    if (input.date > taipeiToday()) throw new GroupError(400, '請選擇今天或過去的聚會日期。');
    const existing = (await c.query('SELECT group_id,created_by,gathering_date::text AS date,kind FROM group_gatherings WHERE id=$1', [id])).rows[0];
    if (existing) {
      if (existing.group_id !== groupId || existing.created_by !== actor || existing.date !== input.date || existing.kind !== input.kind) throw conflict();
      const prior = (await c.query('SELECT person_key FROM group_gathering_attendance WHERE gathering_id=$1',[id])).rows.map(r => r.person_key).sort();
      if (JSON.stringify(prior) !== JSON.stringify([...input.roster].sort())) throw conflict();
      return { id };
    }
    const members = await roster(c, groupId, input.date); const selected = input.roster.map(key => members.find(m => m.key === key));
    if (selected.some(m => !m)) throw new GroupError(409, '小家名單已更新，請重新確認當次名單。');
    await c.query('INSERT INTO group_gatherings(id,group_id,gathering_date,kind,created_by) VALUES($1,$2,$3,$4,$5)', [id, groupId, input.date, input.kind, actor]);
    for (const m of selected) await c.query('INSERT INTO group_gathering_attendance(gathering_id,person_key,name_snapshot) VALUES($1,$2,$3)', [id,m!.key,m!.name]);
    await c.query('INSERT INTO group_gathering_events(gathering_id,actor_id,changes) VALUES($1,$2,$3)', [id,actor,JSON.stringify({ action: 'created', date: input.date, kind: input.kind, roster: input.roster })]);
    return { id };
  });
}
async function meeting(c: PoolClient, actor: string, groupId: string, id: string, lock = false) {
  await scopes(c, actor, groupId);
  const m = (await c.query(`SELECT ${meetingFields},${meetingCounts} FROM group_gatherings m JOIN small_groups g ON g.id=m.group_id WHERE m.id=$1 AND m.group_id=$2 ${lock ? 'FOR UPDATE OF m' : ''}`, [id,groupId])).rows[0];
  if (!m) throw denied(); return m;
}
export function gatheringDetail(actor: string, groupId: string, id: string) {
  return transaction(async c => {
    const m = await meeting(c,actor,groupId,id);
    const entries = (await c.query('SELECT person_key AS key,name_snapshot AS name,status FROM group_gathering_attendance WHERE gathering_id=$1 ORDER BY name_snapshot,person_key',[id])).rows;
    return { ...m, entries };
  });
}
export function saveAttendance(actor: string, groupId: string, id: string, input: z.infer<typeof saveAttendanceInput>) {
  return transaction(async c => {
    const m = await meeting(c,actor,groupId,id,true);
    if (m.version !== input.version) throw conflict();
    const existing = (await c.query('SELECT person_key AS key,status FROM group_gathering_attendance WHERE gathering_id=$1',[id])).rows;
    if (input.entries.length !== existing.length || input.entries.some(e => !existing.some(old => old.key === e.key))) throw new GroupError(400,'請使用這次聚會的完整名單。');
    const changed = input.entries.filter(e => existing.find(old => old.key === e.key)?.status !== e.status);
    for (const entry of changed) await c.query('UPDATE group_gathering_attendance SET status=$3,recorded_by=$4,recorded_at=now() WHERE gathering_id=$1 AND person_key=$2',[id,entry.key,entry.status,actor]);
    await c.query('UPDATE group_gatherings SET visitors=$2,cancelled=$3,version=version+1,updated_at=now() WHERE id=$1',[id,input.visitors,input.cancelled]);
    await c.query('INSERT INTO group_gathering_events(gathering_id,actor_id,changes) VALUES($1,$2,$3)', [id,actor,JSON.stringify({ action: 'recorded', before: { entries: existing.filter(e => changed.some(n => n.key === e.key)), visitors: m.visitors, cancelled: m.cancelled }, after: { entries: changed, visitors: input.visitors, cancelled: input.cancelled } })]);
    return { ok: true, version: m.version + 1 };
  });
}
