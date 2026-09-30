import { normalizeChurch } from './churches';

export function mayManageStudySession(role: string | null, user: { id: string; church?: string | null } | undefined,
  session: { ownerId?: string | null; churchUnit?: string | null } | undefined) {
  if (!user || !role) return false;
  if (role === 'admin') return true;
  if (!['senior_pastor', 'pastor', 'minister', 'group_leader', 'leader', 'future_leader'].includes(role) || !session) return false;
  if (session.ownerId === user.id) return true;
  const church = normalizeChurch(user.church);
  return !!church && church === normalizeChurch(session.churchUnit);
}
