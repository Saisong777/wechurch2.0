import { pool } from './db';
import { normalizeChurch } from './churches';
import { filterUsersForCrmAccess, filterPotentialMembersForCrmAccess, type CrmAccessContext } from './crmPermissions';
import { GroupError } from './lifeGroupRepository';

export async function assignCrmGroupMember(groupId: string, input: { userId?: string | null; potentialMemberId?: string | null; memberEmail?: string | null }, access: CrmAccessContext) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtext('crm-membership:' || $1))", [groupId]);
    const group = (await c.query('SELECT id,church FROM small_groups WHERE id=$1 AND is_active FOR SHARE', [groupId])).rows[0];
    if (!group || (access.role !== 'admin' && !access.groupIds.includes(groupId) && !access.churchScopes.includes(normalizeChurch(group.church) || ''))) throw new GroupError(403, '小組不在管理範圍內');
    const normalizeEmail = (value: string) => value.trim().toLowerCase();
    const emails = new Set<string>();
    if (input.userId) {
      const rows = (await c.query('SELECT id,email,church FROM users WHERE id=$1 FOR SHARE', [input.userId])).rows;
      if (!filterUsersForCrmAccess(rows, access).length) throw new GroupError(403, '成員不在管理範圍內');
      emails.add(normalizeEmail(rows[0].email));
    }
    if (input.potentialMemberId) {
      const rows = (await c.query('SELECT id,email,church FROM potential_members WHERE id=$1 FOR SHARE', [input.potentialMemberId])).rows;
      if (!filterPotentialMembersForCrmAccess(rows, access).length) throw new GroupError(403, '成員不在管理範圍內');
      emails.add(normalizeEmail(rows[0].email));
    }
    if (input.memberEmail) {
      const email = normalizeEmail(input.memberEmail);
      const users = (await c.query('SELECT id,email,church FROM users WHERE lower(trim(email))=$1 FOR SHARE', [email])).rows;
      const potentials = (await c.query('SELECT id,email,church FROM potential_members WHERE lower(trim(email))=$1 FOR SHARE', [email])).rows;
      if ((!users.length && !potentials.length) || filterUsersForCrmAccess(users, access).length !== users.length || filterPotentialMembersForCrmAccess(potentials, access).length !== potentials.length) throw new GroupError(403, '成員不在管理範圍內');
      emails.add(email);
    }
    if (emails.size !== 1) throw new GroupError(400, '成員識別資料不一致');
    const email = [...emails][0];
    const existing = (await c.query(`SELECT * FROM small_group_members WHERE group_id=$1 AND is_active
      AND (user_id=$2 OR potential_member_id=$3 OR lower(trim(member_email))=$4) FOR UPDATE`, [groupId, input.userId || null, input.potentialMemberId || null, email])).rows[0];
    const result = existing || (await c.query(`INSERT INTO small_group_members(group_id,user_id,potential_member_id,member_email,joined_at,updated_at)
      VALUES($1,$2,$3,$4,now(),now()) RETURNING *`, [groupId, input.userId || null, input.potentialMemberId || null, email])).rows[0];
    // Joining another group must not silently remove a person's other memberships.
    await c.query('COMMIT'); return result;
  } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
