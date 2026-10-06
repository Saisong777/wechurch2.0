import { assertSelectedChurch, selectedChurch, churchContext, churchPredicate, lockChurchContext } from './churchContext';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { pool } from './db';
import { storage } from './storage';
import { getCrmAccessContext, type CrmAccessContext } from './crmPermissions';
import { getChurchAliases, getKnownChurchOptions, normalizeChurch } from './churches';
import { GroupError } from './groupError';
import { registeredGroupCount } from './groupRoster';
import { familyCreateInput, familySettingsInput, matchingInput, matchingUpdateInput, memberMoveInput } from '../shared/family';

async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await lockChurchContext(c); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const denied = () => new GroupError(403, '不在你的小家管理範圍內。');
const conflict = () => new GroupError(409, '資料已更新，請重新載入後再試。');
const fields = `g.id,g.name,g.church,g.description,g.meeting,g.audience,g.announcement,g.is_listed AS listed,g.lifecycle AS status,g.version,g.leader_user_id AS "leaderId",g.co_leader_user_id AS "coLeaderId",(SELECT display_name FROM users WHERE id=g.leader_user_id) AS "leaderName",(SELECT display_name FROM users WHERE id=g.co_leader_user_id) AS "coLeaderName"`;
export async function familyAccess(actor: string) {
  return getCrmAccessContext(actor, await storage.getUserRole(actor), 'groups');
}
function churchAllowed(access: CrmAccessContext, church: string) {
  if(normalizeChurch(church)!==selectedChurch())return false;
  return access.canEnterCrm && access.canManageMembers && (access.role === 'admin' || access.churchScopes.includes(normalizeChurch(church) || ''));
}
function groupAllowed(access: CrmAccessContext, g: { id: string; church: string; leader_user_id?: string; co_leader_user_id?: string; pastor_user_id?: string }) {
  if(normalizeChurch(g.church)!==selectedChurch())return false;
  return churchAllowed(access, g.church) || g.leader_user_id === access.userId || g.co_leader_user_id === access.userId || g.pastor_user_id === access.userId || (access.canManageMembers && access.groupIds.includes(g.id));
}
function aliases(access: CrmAccessContext) { return [...new Set(access.churchScopes.flatMap(getChurchAliases))]; }

export async function familyDirectory(actor: string, church: string, search: string) {
  const own = (await pool.query('SELECT church FROM users WHERE id=$1', [actor])).rows[0];
  const churches = getKnownChurchOptions();
  const candidate = normalizeChurch(church || own?.church);
  const selected = selectedChurch();
  if(church && candidate!==selected)throw denied();
  const groups = selected ? (await pool.query(`SELECT g.id,g.name,g.church,g.description,g.meeting,g.audience,(SELECT display_name FROM users WHERE id=g.leader_user_id) AS "leaderName",(SELECT display_name FROM users WHERE id=g.co_leader_user_id) AS "coLeaderName",
    CASE WHEN (g.leader_user_id=$3 OR g.co_leader_user_id=$3) OR g.pastor_user_id=$3 OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=$3 AND m.is_active)
      THEN 'approved' ELSE (SELECT r.status FROM life_group_requests r WHERE r.group_id=g.id AND r.user_id=$3 AND r.status!='approved') END AS "membershipStatus"
    FROM small_groups g
    WHERE is_active AND lifecycle='active' AND is_listed AND church=ANY($1::text[]) AND strpos(lower(name),lower($2))>0
    ORDER BY name,id LIMIT 100`, [getChurchAliases(selected), search, actor])).rows : [];
  return { churches:churches.filter(c=>c.id===selected), selectedChurch: selected, groups };
}
export async function joinListedFamily(actor: string, id: string, message = '') {
  return transaction(async c => {
    const g = (await c.query("SELECT id,name,church FROM small_groups WHERE id=$1 AND is_active AND lifecycle='active' AND is_listed FOR SHARE", [id])).rows[0];
    if (!g) throw new GroupError(404, '這個小家目前不開放申請。');
    assertSelectedChurch(g.church);
    if(churchContext()?.actorChurch!==normalizeChurch(g.church))throw denied();
    const exists = (await c.query(`SELECT 1 FROM small_groups g WHERE g.id=$1 AND ((g.leader_user_id=$2 OR g.co_leader_user_id=$2) OR g.pastor_user_id=$2 OR EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active))`, [id, actor])).rowCount;
    if (exists) return { status: 'approved' };
    await c.query("INSERT INTO life_group_requests(group_id,user_id,status,message) VALUES($1,$2,'pending',$3) ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',message=$3,created_at=now() WHERE life_group_requests.status!='pending'", [id, actor, message]);
    return { status: 'pending' };
  });
}
export async function withdrawFamilyJoin(actor: string, id: string) {
  return transaction(async c => {
    await c.query('SELECT id FROM small_groups WHERE id=$1 FOR UPDATE', [id]);
    if (!(await c.query("DELETE FROM life_group_requests WHERE group_id=$1 AND user_id=$2 AND status='pending' RETURNING user_id", [id, actor])).rowCount) throw conflict();
    return { ok: true };
  });
}
export async function requestMatching(actor: string, input: z.infer<typeof matchingInput>) {
  const church = normalizeChurch(input.church)!;
  assertSelectedChurch(church);
  if (!getKnownChurchOptions().some(c => c.id === church)) throw new GroupError(400, '請選擇教會。');
  return transaction(async c=>(await c.query(`INSERT INTO family_matching_requests(user_id,church,availability,region,contact) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id) WHERE status IN ('pending','contacting') DO NOTHING RETURNING id`, [actor, church, input.availability, input.region, input.contact])).rows[0] || { existing: true });
}
export async function myMatching(actor: string) {
  return (await pool.query(`SELECT r.id,r.church,r.availability,r.region,r.contact,r.status,r.message,r.version,r.created_at AS "createdAt",g.name AS "groupName",u.display_name AS "ownerName"
    FROM family_matching_requests r LEFT JOIN small_groups g ON g.id=r.group_id LEFT JOIN users u ON u.id=r.owner_id
    WHERE r.user_id=$1 AND r.church=ANY($2::text[]) ORDER BY r.created_at DESC LIMIT 20`, [actor,getChurchAliases(selectedChurch())])).rows;
}
export async function cancelMatching(actor: string, id: string) {
  if (!(await pool.query("UPDATE family_matching_requests SET status='cancelled',version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('pending','contacting') RETURNING id", [id, actor])).rowCount) throw conflict();
  return { ok: true };
}
export async function familyManagement(actor: string) {
  const a = await familyAccess(actor);
  const groups = (await pool.query(`SELECT ${fields},true AS "canManage",
    (SELECT count(*)::int FROM life_group_requests r WHERE r.group_id=g.id AND r.status='pending') AS "pendingRequestCount",
    ${registeredGroupCount()} AS "memberCount"
    FROM small_groups g WHERE ${churchPredicate('g')} AND ($1 OR ($2 AND (g.church=ANY($3::text[]) OR g.id=ANY($4::uuid[]))) OR (g.leader_user_id=$5 OR g.co_leader_user_id=$5) OR g.pastor_user_id=$5) ORDER BY g.name LIMIT 200`,
  [a.role === 'admin', a.canManageMembers, aliases(a), a.groupIds, actor])).rows;
  const requests = a.canEnterCrm && a.canManageMembers ? (await pool.query(`SELECT r.id,r.user_id AS "userId",u.display_name AS name,r.church,r.availability,r.region,r.contact,r.status,r.message,r.version,r.created_at AS "createdAt",owner.display_name AS "ownerName",g.name AS "groupName"
    FROM family_matching_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users owner ON owner.id=r.owner_id LEFT JOIN small_groups g ON g.id=r.group_id
    WHERE r.church=ANY($3::text[]) AND ($1 OR r.church=ANY($2::text[])) AND r.status IN ('pending','contacting') ORDER BY r.created_at LIMIT 100`, [a.role === 'admin', aliases(a),getChurchAliases(selectedChurch())])).rows : [];
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
export async function createFamily(actor: string, input: z.input<typeof familyCreateInput>) {
  const details = familyCreateInput.parse(input);
  const a = await familyAccess(actor), church = normalizeChurch(input.church)!;
  if (!getKnownChurchOptions().some(c => c.id === church)) throw new GroupError(400, '請選擇目前開放的教會。');
  assertSelectedChurch(church);
  if (!churchAllowed(a, church)) throw denied();
  return transaction(async c => {
    if (details.coLeaderId) {
      if (details.coLeaderId === actor) throw new GroupError(400, '請選擇兩位不同的小家長。');
      const co = (await c.query('SELECT church FROM users WHERE id=$1 FOR SHARE', [details.coLeaderId])).rows[0];
      if (!co || normalizeChurch(co.church) !== church) throw new GroupError(400, '請選擇同教會已核對帳號的小家長。');
    }
    const g = (await c.query('INSERT INTO small_groups(name,church,leader_user_id,audience,description,meeting,is_listed,co_leader_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [details.name, church, churchContext()?.actorChurch===church ? actor : null, details.audience, details.description, details.meeting, details.listed, details.coLeaderId ?? null])).rows[0];
    await c.query("INSERT INTO family_membership_events(group_id,actor_id,action) VALUES($1,$2,'created')", [g.id, actor]);
    return g;
  });
}
export async function managedFamilyDetail(actor: string, id: string) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 FOR SHARE', [id])).rows[0];
    if (!g || !groupAllowed(a, g)) throw denied();
    const members = (await c.query(`SELECT u.id,COALESCE(NULLIF(u.display_name,''),'小家成員') AS name,(u.id=g.leader_user_id OR u.id=g.co_leader_user_id OR u.id=g.pastor_user_id) IS TRUE AS manager
      FROM users u CROSS JOIN small_groups g WHERE g.id=$1 AND (u.id=g.leader_user_id OR u.id=g.co_leader_user_id OR u.id=g.pastor_user_id OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=$1 AND m.user_id=u.id AND m.is_active)) ORDER BY name`, [id])).rows;
    const history = (await c.query(`SELECT e.action,e.reason,e.created_at AS "createdAt",u.display_name AS name,a.display_name AS "actorName",t.name AS "targetName"
      FROM family_membership_events e LEFT JOIN users u ON u.id=e.user_id JOIN users a ON a.id=e.actor_id LEFT JOIN small_groups t ON t.id=e.target_group_id WHERE e.group_id=$1 ORDER BY e.created_at DESC LIMIT 50`, [id])).rows;
    const requests = (await c.query("SELECT r.user_id AS id,u.display_name AS name,r.message,r.created_at AS \"createdAt\" FROM life_group_requests r JOIN users u ON u.id=r.user_id WHERE group_id=$1 AND status='pending' ORDER BY r.created_at", [id])).rows;
    return { members, requests, history, canChangeLeader: churchAllowed(a, g.church) };
  });
}
export async function decideManagedJoin(actor: string, id: string, userId: string, approve: boolean) {
  const a = await familyAccess(actor);
  return transaction(async c => {
    const g = (await c.query('SELECT * FROM small_groups WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!g || !groupAllowed(a, g)) throw denied();
    if (g.lifecycle !== 'active') throw new GroupError(409, '請先恢復小家運作。');
    if(approve && !(await c.query('SELECT 1 FROM users WHERE id=$1 AND church=$2 FOR SHARE',[userId,g.church])).rowCount)throw denied();
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
    // Omitted second slot from legacy clients preserves its appointment.
    const coLeaderId = input.coLeaderId === undefined ? g.co_leader_user_id ?? null : input.coLeaderId;
    if (input.leaderId && coLeaderId === input.leaderId) throw new GroupError(400, '請選擇兩位不同的小家長。');
    const previousLeaders = [g.leader_user_id, g.co_leader_user_id].filter(Boolean) as string[];
    const nextLeaders = [input.leaderId, coLeaderId].filter(Boolean) as string[];
    if (input.leaderId !== g.leader_user_id || coLeaderId !== (g.co_leader_user_id ?? null)) {
      if (!churchAllowed(a, g.church)) throw denied();
      for (const next of nextLeaders.filter(value => !previousLeaders.includes(value))) {
        const candidate = (await c.query(`SELECT u.church FROM users u WHERE u.id=$2 AND
          (EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=$1 AND m.user_id=u.id AND m.is_active)
          OR EXISTS(SELECT 1 FROM small_groups WHERE id=$1 AND pastor_user_id=u.id)) FOR SHARE OF u`, [id, next])).rows[0];
        if (!candidate || normalizeChurch(candidate.church) !== normalizeChurch(g.church)) throw new GroupError(400, '請先將同教會的接任同工加入小家。');
      }
      for (const removed of previousLeaders.filter(value => !nextLeaders.includes(value) && value !== g.pastor_user_id)) {
        await c.query('INSERT INTO small_group_members(group_id,user_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM small_group_members WHERE group_id=$1 AND user_id=$2 AND is_active)', [id, removed]);
      }
      await c.query("INSERT INTO family_membership_events(group_id,actor_id,action,reason) VALUES($1,$2,'leaders_changed',$3)", [id, actor, JSON.stringify({ previousLeaderIds: previousLeaders, nextLeaderIds: nextLeaders })]);
      await c.query('DELETE FROM life_group_invites WHERE group_id=$1', [id]);
    }
    if (input.status === 'archived') {
      if (!churchAllowed(a, g.church)) throw denied();
      if ((await c.query('SELECT 1 FROM small_group_members WHERE group_id=$1 AND is_active AND (user_id IS NULL OR user_id<>ALL($2::uuid[])) LIMIT 1', [id, [...nextLeaders, g.pastor_user_id].filter(Boolean)])).rowCount) throw new GroupError(409, '請先完成成員轉家或退出，再封存小家。');
    }
    if (input.status !== 'active') await c.query('DELETE FROM life_group_invites WHERE group_id=$1', [id]);
    await c.query('UPDATE small_groups SET name=$2,description=$3,meeting=$4,announcement=$5,is_listed=$6,lifecycle=$7,is_active=$8,leader_user_id=$9,audience=COALESCE($10,audience),co_leader_user_id=$11,version=version+1,updated_at=now() WHERE id=$1', [id, input.name, input.description, input.meeting, input.announcement, input.listed && input.status === 'active', input.status, input.status !== 'archived', input.leaderId, input.audience ?? null, coLeaderId]);
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
    if ([source.leader_user_id, source.co_leader_user_id, source.pastor_user_id].includes(input.userId)) throw new GroupError(409, '請先完成小家長或牧者交接。');
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
