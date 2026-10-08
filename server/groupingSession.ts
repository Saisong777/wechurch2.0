import type { Request } from 'express';
import type { SessionData } from 'express-session';

export const MAX_GROUPING_GRANTS = 64;
type Grants = Record<string, { participantId: string; expiresAt: number }>;
declare module 'express-session' {
  interface SessionData { groupingParticipants?: Grants; }
}
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Only the old, signed server session can supply grants across login regeneration.
export function validGroupingGrants(session?: Pick<SessionData, 'groupingParticipants'>): Grants {
  const grants = session?.groupingParticipants;
  if (!grants || typeof grants !== 'object' || Array.isArray(grants) || Object.keys(grants).length > MAX_GROUPING_GRANTS) return {};
  return Object.fromEntries(Object.entries(grants).filter(([id, value]) => uuid.test(id) && value &&
    typeof value.participantId === 'string' && uuid.test(value.participantId) &&
    Number.isSafeInteger(value.expiresAt) && value.expiresAt > Date.now()));
}

export function loginWithGroupingSession(req: Request, user: Express.User, done: (error?: unknown) => void) {
  const grants = validGroupingGrants(req.session);
  // Keep Passport's session ID rotation; never merge OAuth state or old auth data.
  req.login(user, error => {
    if (!error && Object.keys(grants).length) req.session.groupingParticipants = grants;
    done(error);
  });
}
