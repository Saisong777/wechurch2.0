import { useEffect, useMemo, useState } from 'react';
import type { AccessTemplate } from '@shared/accessControl';
import { ministryRoleOptions } from '@/lib/ministryRoleOptions';

export function useMinistryRoleFilter(roles: Pick<AccessTemplate, 'name'>[], members: { ministryRoles?: string[] }[], ready: boolean) {
  const [ministryRole, setMinistryRole] = useState('');
  const options = useMemo(() => ministryRoleOptions(roles, members), [roles, members]);
  useEffect(() => {
    if (ready && ministryRole && !options.includes(ministryRole)) setMinistryRole('');
  }, [ready, ministryRole, options]);
  // Keep the selection readable during loading or a failed refresh.
  const visibleOptions = ministryRole && !options.includes(ministryRole) ? [...options, ministryRole] : options;
  return { ministryRole, setMinistryRole, options: visibleOptions };
}
