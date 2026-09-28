import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { pool } from './db';
import { storage } from './storage';
import { getCrmAccessContext, type CrmAccessContext } from './crmPermissions';
import { getChurchAliases, getKnownChurchOptions, normalizeChurch } from './churches';
import { GroupError } from './groupError';
import { familyCreateInput, familySettingsInput, matchingInput, matchingUpdateInput, memberMoveInput } from '../shared/family';

async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const denied = () => new GroupError(403, '不在你的小家管理範圍內。');
const conflict = () => new GroupError(409, '資料已更新，請重新載入後再試。');
const fields = `g.id,g.name,g.church,g.description,g.meeting,g.announcement,g.is_listed AS listed,g.lifecycle AS status,g.version,g.leader_user_id AS "leaderId"`;
export async function familyAccess(actor: string) {
  return getCrmAccessContext(actor, await storage.getUserRole(actor), 'members');
}
function churchAllowed(access: CrmAccessContext, church: string) {
  return access.canEnterCrm && access.canManageMembers && (access.role === 'admin' || access.churchScopes.includes(normalizeChurch(church) || ''));
}
function groupAllowed(access: CrmAccessContext, g: { id: string; church: string; leader_user_id?: string; pastor_user_id?: string }) {
  return churchAllowed(access, g.church) || g.leader_user_id === access.userId || g.pastor_user_id === access.userId || (access.canManageMembers && access.groupIds.includes(g.id));
}
function aliases(access: CrmAccessContext) { return [...new Set(access.churchScopes.flatMap(getChurchAliases))]; }

export async function familyDirectory(actor: string, church: string, search: string) {
  const own = (await pool.query('SELECT church FROM users WHERE id=$1', [actor])).rows[0];
  const churches = getKnownChurchOptions();
  const candidate = normalizeChurch(church || own?.church);
  const selected = churches.some(c => c.id === candidate) ? candidate! : (!church && churches.length === 1 ? churches[0].id : '');
  const groups = selected ? (await pool.query(`SELECT id,name,church,description,meeting FROM small_groups
    WHERE is_active AND lifecycle='active' AND is_listed AND church=ANY($1::text[]) AND strpos(lower(name),lower($2))>0
    ORDER BY name,id LIMIT 100`, [getChurchAliases(selected), search])).rows : [];
  return { churches, selectedChurch: selected, groups };
}
export async function joinListedFamily(actor: string, id: string) {
  return transaction(async c => {
    const g = (await c.query("SELECT id,name FROM small_groups WHERE id=$1 AND is_active AND lifecycle='active' AND is_listed FOR SHARE", [id])).rows[0];
    if (!g) throw new GroupError(404, '這個小家目前不開放申請。');
    const exists = (await c.query(`SELECT 1 FROM small_groups g WHERE g.id=$1 AND (g.leader_user_id=$2 OR g.pastor_user_id=$2 OR EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active))`, [id, actor])).rowCount;
    if (exists) return { status: 'approved' };
    await c.query("INSERT INTO life_group_requests(group_id,user_id,status) VALUES($1,$2,'pending') ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',created_at=now()", [id, actor]);
    return { status: 'pending' };
  });
}
export async function requestMatching(actor: string, input: z.infer<typeof matchingInput>) {
  const church = normalizeChurch(input.church)!;
  if (!getKnownChurchOptions().some(c => c.id === church)) throw new GroupError(400, '請選擇教會。');
  return (await pool.query(`INSERT INTO family_matching_requests(user_id,church,availability,region,contact) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id) WHERE status IN ('pending','contacting') DO NOTHING RETURNING id`, [actor, church, input.availability, input.region, input.contact])).rows[0] || { existing: true };
}
export async function myMatching(actor: string) {
  return (await pool.query(`SELECT r.id,r.church,r.availability,r.region,r.contact,r.status,r.message,r.version,r.created_at AS "createdAt",g.name AS "groupName",u.display_name AS "ownerName"
    FROM family_matching_requests r LEFT JOIN small_groups g ON g.id=r.group_id LEFT JOIN users u ON u.id=r.owner_id
    WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 20`, [actor])).rows;
}
export async function cancelMatching(actor: string, id: string) {
  if (!(await pool.query("UPDATE family_matching_requests SET status='cancelled',version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('pending','contacting') RETURNING id", [id, actor])).rowCount) throw conflict();
  return { ok: true };
}
export async function familyManagement(actor: string) {
  const a = await familyAccess(actor);
  const groups = (await pool.query(`SELECT ${fields},true AS "canManage",
    (SELECT count(DISTINCT uid)::int FROM (SELECT user_id AS uid FROM small_group_members WHERE group_id=g.id AND is_active UNION SELECT g.leader_user_id UNION SELECT g.pastor_user_id) m WHERE uid IS NOT NULL) AS "memberCount"
    FROM small_groups g WHERE $1 OR ($2 AND (g.church=ANY($3::text[]) OR g.id=ANY($4::uuid[]))) OR g.leader_user_id=$5 OR g.pastor_user_id=$5 ORDER BY g.name LIMIT 200`,
  [a.role === 'admin', a.canManageMembers, aliases(a), a.groupIds, actor])).rows;
  const requests = a.canEnterCrm && a.canManageMembers ? (await pool.query(`SELECT r.id,r.user_id AS "userId",u.display_name AS name,r.church,r.availability,r.region,r.contact,r.status,r.message,r.version,r.created_at AS "createdAt",owner.display_name AS "ownerName",g.name AS "groupName"
    FROM family_matching_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users owner ON owner.id=r.owner_id LEFT JOIN small_groups g ON g.id=r.group_id
    WHERE ($1 OR r.church=ANY($2::text[])) AND r.status IN ('pending','contacting') ORDER BY r.created_at LIMIT 100`, [a.role === 'admin', aliases(a)])).rows : [];
  return { groups, requests, churches: getKnownChurchOptions().filter(c => churchAllowed(a, c.id)) };
}
export async function updateMatching(actor: string, id: string, input: z.infer<typeof matchingUpdateInput>) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const r = (await c.query('SELECT * FROM family_matching_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!r || !churchAllowed(a, r.church)) throw denied();
    if (r.version !== input.version || !['pending','contacting'].includes(r.status)) throw conflict();
    if (input.status === 'matched') {
      const g = (await c.query("SELECT * FROM small_groups WHERE id=$1 AND is_active AND lifecycle='active' FOR SHARE", [input.groupId])).rows[0];
      if (!g || !groupAllowed(a, g) || normalizeChurch(g.church) !== normalizeChurch(r.church)) throw denied();
      // Matching proposes a home; the leader still confirms membership before private content is visible.
      await c.query("INSERT INTO life_group_requests(group_id,user_id,status) VALUES($1,$2,'pending') ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',created_at=now()", [input.groupId, r.user_id]);
    }
    await c.query('UPDATE family_matching_requests SET status=$2,owner_id=$3,group_id=$4,message=$5,version=version+1,updated_at=now() WHERE id=$1', [id, input.status, actor, input.status === 'matched' ? input.groupId : null, input.message]);
    return { ok: true };
  });
}
export async function createFamily(actor: string, input: z.infer<typeof familyCreateInput>) {
  const a = await familyAccess(actor), church = normalizeChurch(input.church)!;
  if (!getKnownChurchOptions().some(c => c.id === church)) throw new GroupError(400, '請選擇目前開放的教會。');
  if (!churchAllowed(a, church)) throw denied();
  return transaction(async c => {
    const g = (await c.query('INSERT INTO small_groups(name,church,leader_user_id) VALUES($1,$2,$3) RETURNING id', [input.name, church, actor])).rows[0];
    await c.query("INSERT INTO family_membership_events(group_id,actor_id,action) VALUES($1,$2,'created')", [g.id, actor]);
    return g;
  });
}
export async function managedFamilyDetail(actor: string, id: string) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 FOR SHARE', [id])).rows[0];
    if (!g || !groupAllowed(a, g)) throw denied();
    const members = (await c.query(`SELECT u.id,COALESCE(NULLIF(u.display_name,''),'小家成員') AS name,(u.id=g.leader_user_id OR u.id=g.pastor_user_id) IS TRUE AS manager
      FROM users u CROSS JOIN small_groups g WHERE g.id=$1 AND (u.id=g.leader_user_id OR u.id=g.pastor_user_id OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=$1 AND m.user_id=u.id AND m.is_active)) ORDER BY name`, [id])).rows;
    const history = (await c.query(`SELECT e.action,e.reason,e.created_at AS "createdAt",u.display_name AS name,a.display_name AS "actorName",t.name AS "targetName"
      FROM family_membership_events e LEFT JOIN users u ON u.id=e.user_id JOIN users a ON a.id=e.actor_id LEFT JOIN small_groups t ON t.id=e.target_group_id WHERE e.group_id=$1 ORDER BY e.created_at DESC LIMIT 50`, [id])).rows;
    const requests = (await c.query("SELECT r.user_id AS id,u.display_name AS name FROM life_group_requests r JOIN users u ON u.id=r.user_id WHERE group_id=$1 AND status='pending' ORDER BY r.created_at", [id])).rows;
    return { members, requests, history, canChangeLeader: churchAllowed(a, g.church) };
  });
}
export async function decideManagedJoin(actor: string, id: string, userId: string, approve: boolean) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!g || !groupAllowed(a, g)) throw denied();
    if (g.lifecycle !== 'active') throw new GroupError(409, '請先恢復小家運作。');
    if (!(await c.query("UPDATE life_group_requests SET status=$3 WHERE group_id=$1 AND user_id=$2 AND status='pending' RETURNING user_id", [id, userId, approve ? 'approved' : 'rejected'])).rowCount) throw conflict();
    if (approve) await c.query('INSERT INTO small_group_members(group_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active)', [id, userId]);
    await c.query('INSERT INTO family_membership_events(group_id,user_id,actor_id,action) VALUES($1,$2,$3,$4)', [id, userId, actor, approve ? 'joined' : 'declined']);
    return { ok: true };
  });
}
export async function updateFamily(actor: string, id: string, input: z.infer<typeof familySettingsInput>) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!g || !groupAllowed(a, g)) throw denied();
    if (g.version !== input.version) throw conflict();
    if (g.lifecycle === 'archived' && !churchAllowed(a, g.church)) throw denied();
    if (input.leaderId !== g.leader_user_id) {
      if (!churchAllowed(a, g.church)) throw denied();
      if (!input.leaderId || !(await c.query('SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active UNION SELECT 1 FROM small_groups WHERE id=$1 AND pastor_user_id=$2', [id, input.leaderId])).rowCount) throw new GroupError(400, '請先將接任同工加入小家。');
      if (g.leader_user_id) await c.query('INSERT INTO small_group_members(group_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active)', [id, g.leader_user_id]);
      await c.query("INSERT INTO family_membership_events(group_id,user_id,actor_id,action) VALUES($1,$2,$3,'leader_changed')", [id, input.leaderId, actor]);
      await c.query('DELETE FROM life_group_invites WHERE group_id=$1', [id]);
    }
    if (input.status === 'archived') {
      if (!churchAllowed(a, g.church)) throw denied();
      if ((await c.query('SELECT 1 FROM small_group_members WHERE group_id=$1 AND is_active AND user_id IS DISTINCT FROM $2 AND user_id IS DISTINCT FROM $3 LIMIT 1', [id, g.leader_user_id, g.pastor_user_id])).rowCount) throw new GroupError(409, '請先完成成員轉家或退出，再封存小家。');
    }
    if (input.status !== 'active') await c.query('DELETE FROM life_group_invites WHERE group_id=$1', [id]);
    await c.query('UPDATE small_groups SET name=$2,description=$3,meeting=$4,announcement=$5,is_listed=$6,lifecycle=$7,is_active=$8,leader_user_id=$9,version=version+1,updated_at=now() WHERE id=$1', [id, input.name, input.description, input.meeting, input.announcement, input.listed && input.status === 'active', input.status, input.status !== 'archived', input.leaderId]);
    await c.query("INSERT INTO family_membership_events(group_id,actor_id,action,reason) VALUES($1,$2,'settings',$3)", [id, actor, input.status]);
    return { ok: true };
  });
}
export async function moveFamilyMember(actor: string, id: string, input: z.infer<typeof memberMoveInput>) {
  const a = await familyAccess(actor);
  if (input.targetGroupId === id) throw new GroupError(400, '請選擇不同的小家。');
  return transaction(async c => {
    // Lock both homes in a stable order so simultaneous transfers cannot deadlock or partially succeed.
    const groups = (await c.query('SELECT * FROM small_groups WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[id, input.targetGroupId].filter(Boolean)])).rows;
    const source = groups.find(g => g.id === id), target = groups.find(g => g.id === input.targetGroupId);
    if (!source || !groupAllowed(a, source)) throw denied();
    if (input.targetGroupId && (!target || !target.is_active || target.lifecycle !== 'active' || !groupAllowed(a, target) || normalizeChurch(source.church) !== normalizeChurch(target.church))) throw denied();
    if ([source.leader_user_id, source.pastor_user_id].includes(input.userId)) throw new GroupError(409, '請先完成小家長或牧者交接。');
    if (!(await c.query('UPDATE small_group_members SET is_active=false,updated_at=now() WHERE group_id=$1 AND user_id=$2 AND is_active RETURNING id', [id, input.userId])).rowCount) throw conflict();
    await c.query('DELETE FROM life_group_requests WHERE group_id=$1 AND user_id=$2', [id, input.userId]);
    await c.query('DELETE FROM life_group_care_watches WHERE user_id=$2 AND care_id IN(SELECT id FROM life_group_care WHERE group_id=$1)', [id, input.userId]);
    await c.query('UPDATE life_group_care SET responsible_id=NULL,version=version+1,updated_at=now() WHERE group_id=$1 AND responsible_id=$2 AND withdrawn_at IS NULL', [id, input.userId]);
    if (target) {
      await c.query('INSERT INTO small_group_members(group_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active)', [target.id, input.userId]);
      await c.query("UPDATE life_group_requests SET status='approved' WHERE group_id=$1 AND user_id=$2", [target.id, input.userId]);
      await c.query("INSERT INTO family_membership_events(group_id,user_id,actor_id,action,target_group_id) VALUES($1,$2,$3,'transferred_in',$4)", [target.id, input.userId, actor, id]);
    }
    await c.query('INSERT INTO family_membership_events(group_id,user_id,actor_id,action,target_group_id,reason) VALUES($1,$2,$3,$4,$5,$6)', [id, input.userId, actor, target ? 'transferred_out' : 'removed', input.targetGroupId, input.reason]);
    return { ok: true };
  });
}
