import { beforeEach, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));
import { myAccess, memberRoleNames } from './accessControl';
import { activeGroupAppointments } from './groupAppointments';
import { runChurchContext } from './churchContext';

let appointments: Record<string, unknown>[];
beforeEach(() => {
  appointments = [{ id: 'group-a', name: '已核帳號小家', church: 'IM 行動教會', leader_user_id: 'member', co_leader_user_id: null, pastor_user_id: null }];
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT u.id,u.church')) return { rows: [{ id: 'member', church: 'IM 行動教會', role: 'member' }] };
    if (sql.startsWith('SELECT church FROM users')) return { rows: [{ church: 'IM 行動教會' }] };
    if (sql.includes('FROM access_grants')) return { rows: [] };
    if (sql.includes('FROM users u JOIN small_groups')) return { rows: appointments.map(g => ({ user_id: 'member', user_church: 'IM 行動教會', church: g.church, name: '小家長' })) };
    if (sql.includes('FROM small_groups')) return { rows: appointments };
    throw new Error(sql);
  });
});
it('makes an account-linked member appointment usable without inserting a global role or grant', async () => {
  expect(await myAccess('member')).toMatchObject({ appointments: [{groupId:'group-a',groupName:'已核帳號小家',role:'group_leader'}],
    permissions:[], grants:[], canManageGroups:true, canManageAccess:false, canEnterCrm:true, canEnterAdmin:true });
  expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});
it('removing the appointment withdraws both entry and the derived role name on the next request', async () => {
  expect((await memberRoleNames(['member'])).get('member')).toEqual(['小家長']);
  appointments=[];
  expect(await myAccess('member')).toMatchObject({ appointments:[], canEnterCrm:false, canEnterAdmin:false, canManageGroups:false });
  expect((await memberRoleNames(['member'])).get('member')).toBeUndefined();
});
it('filters foreign-church appointments from navigation and derived role names', async () => {
  appointments[0].church='火樂';
  expect(await activeGroupAppointments('member')).toEqual([]);
  expect((await memberRoleNames(['member'])).get('member')).toBeUndefined();
});
it('does not transfer an appointment to another selected church', async () => {
  const result=await runChurchContext({actorId:'member',actorChurch:'IM 行動教會',selectedChurch:'火樂',isSystemAdmin:true},()=>activeGroupAppointments('member'));
  expect(result).toEqual([]);
});
