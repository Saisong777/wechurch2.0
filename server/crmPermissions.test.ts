import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));
vi.mock('./accessControl', () => ({ activeGrants: async () => [] }));
import { getCrmAccessContext, filterUsersForCrmAccess, filterPotentialMembersForCrmAccess } from './crmPermissions';
import { appendPastoralAccessCondition } from './pastoralAccess';

let assignments: Record<string, unknown>[];
let appointments: Record<string, unknown>[];
beforeEach(() => {
  assignments = [];
  appointments = [{ id: 'group-a', name: '小家 A', church: 'iM', leader_user_id: 'leader', co_leader_user_id: null, pastor_user_id: null }];
  query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('WHERE id = $1') || sql.startsWith('SELECT church FROM users WHERE id=$1')) return { rows: [{ id: 'leader', email: 'leader@test.local', church: 'iM' }] };
    if (sql.includes('FROM crm_scope_assignments')) return { rows: assignments };
    if (sql.includes('FROM small_group_members')) return { rows: [{ user_id: 'a', member_email: 'a@test.local', potential_member_id: 'potential-a' }] };
    if (sql.includes('FROM small_groups')) return { rows: appointments };
    if (sql.includes('FROM potential_members')) return { rows: (params[0] as string[]).map(id => ({ email: `${id}@test.local` })) };
    if (sql.includes('FROM users')) return { rows: (params[0] as string[]).map(id => ({ email: `${id}@test.local` })) };
    throw new Error(sql);
  });
});
describe('CRM grants keep their own scope', () => {
  it('a member account appointment supplies only its own group and care scope', async () => {
    for (const capability of [undefined, 'groups', 'care', 'careOrMembers'] as const) {
      const access = await getCrmAccessContext('leader', 'member', capability);
      expect(access.canEnterCrm).toBe(true);
      expect(access.groupIds).toEqual(['group-a']);
      expect(access.churchScopes).toEqual([]);
      expect(access.canAssignScopes).toBe(false);
      expect(access.canViewPersonal).toBe(false);
      expect(access.canManageMembers).toBe(capability === 'groups');
      expect(filterUsersForCrmAccess([{ id: 'a', church: 'iM' }, { id: 'b', church: 'iM' }], access).map(u => u.id)).toEqual(['a']);
    }
    for (const capability of ['members','personal','email'] as const) {
      const access = await getCrmAccessContext('leader', 'member', capability);
      expect(access.groupIds).toEqual([]);
      expect(access.canManageMembers).toBe(false);
      expect(access.canManageCare).toBe(false);
      expect(access.canViewPersonal).toBe(false);
    }
  });
  it('a co-leader supplies the same scope and removal revokes the next request', async () => {
    appointments[0].leader_user_id = 'other';
    appointments[0].co_leader_user_id = 'leader';
    expect((await getCrmAccessContext('leader', 'member', 'groups')).groupIds).toEqual(['group-a']);
    appointments = [];
    const access = await getCrmAccessContext('leader', 'member');
    expect(access.groupIds).toEqual([]);
    expect(access.canEnterCrm).toBe(false);
    expect(access.canManageCare).toBe(false);
  });
  it('an invalid cross-church appointment never creates management scope', async () => {
    appointments[0].church = '桃園WeChurch';
    const access = await getCrmAccessContext('leader', 'member', 'groups');
    expect(access.groupIds).toEqual([]);
    expect(access.canEnterCrm).toBe(false);
    expect(access.canManageMembers).toBe(false);
  });
  it('group ownership does not expose unrelated same-church users or potential members', async () => {
    const access = await getCrmAccessContext('leader', 'group_leader');
    expect(access.churchScopes).toEqual([]);
    expect(filterUsersForCrmAccess([{ id: 'a', church: 'iM' }, { id: 'b', church: 'iM' }], access).map(u => u.id)).toEqual(['a']);
    expect(filterPotentialMembersForCrmAccess([{ id: 'potential-a', church: 'iM' }, { id: 'potential-b', church: 'iM' }], access).map(u => u.id)).toEqual(['potential-a']);
  });
  it('personal and member-write grants do not escape onto a separate visible person', async () => {
    appointments = [];
    assignments = [{ scope_type: 'member', member_user_id: 'a', can_view_personal: true, can_manage_members: true }, { scope_type: 'member', member_user_id: 'b', can_manage_care: true }];
    const people = [{ id: 'a' }, { id: 'b' }];
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', 'future_leader', 'personal')).map(u => u.id)).toEqual(['a']);
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', 'future_leader', 'members')).map(u => u.id)).toEqual(['a']);
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', 'future_leader', 'care')).map(u => u.id)).toEqual(['b']);
  });
  it('preserves explicit church grants without making them global', async () => {
    assignments = [{ scope_type: 'church', church: 'Other', can_manage_care: true }];
    const access = await getCrmAccessContext('leader', 'future_leader', 'care');
    expect(filterUsersForCrmAccess([{ id: 'x', church: 'Other' }, { id: 'y', church: 'iM' }], access).map(u => u.id)).toEqual(['x']);
    const conditions: string[] = [], params: unknown[] = [];
    appendPastoralAccessCondition(conditions, params, 'p', access);
    expect(conditions.join(' ')).toContain('p.church = ANY');
    expect(params).toContainEqual(['Other']);
  });
  it.each(['pastor', 'minister'])('%s does not upgrade a care-only assignment into personal or membership access', async role => {
    assignments = [{ scope_type: 'member', member_user_id: 'b', can_view_personal: false, can_manage_care: true, can_manage_members: false }];
    const people = [{ id: 'a' }, { id: 'b' }];
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', role, 'personal')).map(u => u.id)).toEqual(['a']);
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', role, 'members')).map(u => u.id)).not.toContain('b');
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', role, 'care')).map(u => u.id)).toEqual(['a', 'b']);
    assignments[0].can_view_personal = true;
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', role, 'personal')).map(u => u.id)).toEqual(['a', 'b']);
    assignments = [];
    expect(filterUsersForCrmAccess(people, await getCrmAccessContext('leader', role, 'personal')).map(u => u.id)).toEqual(['a']);
  });
  it('an unassigned senior pastor fails closed', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'leader', church: null }] });
    const access = await getCrmAccessContext('leader', 'senior_pastor');
    expect(access.accessLevel).not.toBe('all');
    expect(filterUsersForCrmAccess([{ id: 'other', church: 'iM' }], access)).toEqual([]);
  });
});
