import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));
import { getCrmAccessContext, filterUsersForCrmAccess, filterPotentialMembersForCrmAccess } from './crmPermissions';
import { appendPastoralAccessCondition } from './pastoralAccess';

let assignments: Record<string, unknown>[];
beforeEach(() => {
  assignments = [];
  query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('WHERE id = $1')) return { rows: [{ id: 'leader', email: 'leader@test.local', church: 'iM' }] };
    if (sql.includes('FROM crm_scope_assignments')) return { rows: assignments };
    if (sql.includes('FROM small_groups')) return { rows: [{ id: 'group-a', church: 'iM' }] };
    if (sql.includes('FROM small_group_members')) return { rows: [{ user_id: 'a', member_email: 'a@test.local', potential_member_id: 'potential-a' }] };
    if (sql.includes('FROM potential_members')) return { rows: (params[0] as string[]).map(id => ({ email: `${id}@test.local` })) };
    if (sql.includes('FROM users')) return { rows: (params[0] as string[]).map(id => ({ email: `${id}@test.local` })) };
    throw new Error(sql);
  });
});
describe('CRM grants keep their own scope', () => {
  it('group ownership does not expose unrelated same-church users or potential members', async () => {
    const access = await getCrmAccessContext('leader', 'group_leader');
    expect(access.churchScopes).toEqual([]);
    expect(filterUsersForCrmAccess([{ id: 'a', church: 'iM' }, { id: 'b', church: 'iM' }], access).map(u => u.id)).toEqual(['a']);
    expect(filterPotentialMembersForCrmAccess([{ id: 'potential-a', church: 'iM' }, { id: 'potential-b', church: 'iM' }], access).map(u => u.id)).toEqual(['potential-a']);
  });
  it('personal and member-write grants do not escape onto a separate visible person', async () => {
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
  it('an unassigned senior pastor fails closed', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'leader', church: null }] });
    const access = await getCrmAccessContext('leader', 'senior_pastor');
    expect(access.accessLevel).not.toBe('all');
    expect(filterUsersForCrmAccess([{ id: 'other', church: 'iM' }], access)).toEqual([]);
  });
});
