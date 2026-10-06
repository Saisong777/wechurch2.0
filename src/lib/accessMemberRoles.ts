import type { AccessGrant, AccessTemplate } from '@shared/accessControl';
import { crmRoleLabels } from './crm-members';

type Member = { id: string; role: keyof typeof crmRoleLabels };
export type Appointment = { id: string; name: string; leaderId: string | null; coLeaderId?: string | null; pastorId: string | null };
type Sources = { grants: AccessGrant[]; appointments: Appointment[] };
export const isLiveAccessGrant = (grant: AccessGrant, now = Date.now()) => grant.effective !== false && grant.active && (!grant.expiresAt || Date.parse(grant.expiresAt) > now);

export function memberRoleSources(member: Member, data: Sources, now = Date.now()) {
  const sources = [{ name: crmRoleLabels[member.role], source: '帳號角色', groupId: null as string | null }];
  for (const group of data.appointments) {
    if (group.leaderId === member.id || group.coLeaderId === member.id) sources.push({ name: '小家長', source: `小家指派：${group.name}`, groupId: group.id });
    if (group.pastorId === member.id) sources.push({ name: '牧者', source: `小家指派：${group.name}`, groupId: group.id });
  }
  for (const grant of data.grants.filter(grant => grant.userId === member.id && isLiveAccessGrant(grant, now))) sources.push({ name: grant.roleName, source: '額外授權', groupId: grant.groupId });
  return sources;
}
export function memberMatchesRole(member: Member, roleName: string, data: Sources, now = Date.now()) {
  return memberRoleSources(member, data, now).some(source => source.name === roleName);
}
export function memberRoleFilterOptions(users: Member[], roles: AccessTemplate[], data: Sources) {
  const options = roles.map(role => ({ id: role.id, name: role.name }));
  const names = new Set(options.map(option => option.name));
  for (const member of users) for (const source of memberRoleSources(member, data)) {
    if (!names.has(source.name)) { names.add(source.name); options.push({ id: `derived:${source.name}`, name: source.name }); }
  }
  return options;
}
