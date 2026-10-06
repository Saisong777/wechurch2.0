import { expect, it } from 'vitest';
import type { AccessGrant } from '@shared/accessControl';
import { memberMatchesRole, memberRoleFilterOptions, memberRoleSources } from './accessMemberRoles';
const member = { id: 'member', role: 'member' as const };
const appointment = { id: 'group', name: '測試小家', leaderId: 'other', coLeaderId: member.id, pastorId: null };
const grant: AccessGrant = { id:'grant',userId:member.id,roleId:'leader-role',roleName:'小家長',permissions:[],scope:'group',church:'IM 行動教會',groupId:'group',memberId:null,expiresAt:null,active:true,version:1,reason:'fixture' };
it('finds a member appointed in the second slot without requiring a duplicated account role or grant', () => {
  const data={grants:[],appointments:[appointment]};
  expect(memberMatchesRole(member,'小家長',data)).toBe(true);
  expect(memberRoleSources(member,data)).toContainEqual({name:'小家長',source:'小家指派：測試小家',groupId:'group'});
  expect(memberRoleFilterOptions([member],[],data)).toContainEqual({id:'derived:小家長',name:'小家長'});
});
it('combines the two legacy leader aliases, appointments and live grants without repeating filter options', () => {
  const data={grants:[grant],appointments:[appointment]};
  const templates=[{id:'leader-role',name:'小家長',permissions:[],version:1,editable:true}];
  const users=[member,{id:'legacy-a',role:'leader' as const},{id:'legacy-b',role:'group_leader' as const}];
  expect(users.filter(user=>memberMatchesRole(user,'小家長',data))).toHaveLength(3);
  expect(memberRoleFilterOptions(users,templates,data).filter(option=>option.name==='小家長')).toEqual([{id:'leader-role',name:'小家長'}]);
});
it('drops removed appointments and expired or revoked grants on the next snapshot', () => {
  expect(memberMatchesRole(member,'小家長',{appointments:[],grants:[{...grant,active:false}]})).toBe(false);
  expect(memberMatchesRole(member,'小家長',{appointments:[],grants:[{...grant,expiresAt:'2026-01-01T00:00:00Z'}]},Date.parse('2026-10-06T00:00:00Z'))).toBe(false);
  expect(memberMatchesRole(member,'小家長',{appointments:[],grants:[]})).toBe(false);
});

it('does not count a live-looking grant whose server-verified group scope is no longer valid',()=>{
  expect(memberMatchesRole(member,'小家長',{appointments:[],grants:[{...grant,effective:false}]})).toBe(false);
});
