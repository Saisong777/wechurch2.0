import type { AccessTemplate } from '@shared/accessControl';

// Catalog entries remain selectable even before the first person is assigned.
// Keep assigned names too, so existing records can always be found.
export function ministryRoleOptions(roles: Pick<AccessTemplate, 'name'>[], members: { ministryRoles?: string[] }[]) {
  return [...new Set([...roles.map(role => role.name), ...members.flatMap(member => member.ministryRoles || [])])];
}
