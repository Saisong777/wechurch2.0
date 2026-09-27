export interface SessionIdentity {
  claims: { sub: string; [key: string]: unknown };
  sessionVersion?: number;
  sessionUserId?: string;
  [key: string]: unknown;
}

interface IdentityStore {
  getUser(id: string): Promise<{ legacyUserId?: string } | undefined>;
}

export function createSessionVersionGuard(
  identities: IdentityStore,
  getVersion: (memberId: string) => Promise<number | undefined>,
) {
  async function verify(value: unknown, freshLogin: boolean): Promise<SessionIdentity | false> {
    if (!value || typeof value !== 'object') return false;
    const user = value as SessionIdentity;
    if (typeof user.claims?.sub !== 'string' || !user.claims.sub) return false;
    // Use the canonical Google-link/email mapping, never a session email or ID prefix.
    const memberId = (await identities.getUser(user.claims.sub))?.legacyUserId;
    if (!memberId || (user.sessionUserId !== undefined && user.sessionUserId !== memberId)) return false;
    const current = await getVersion(memberId);
    if (current === undefined || !Number.isSafeInteger(current) || current < 0) return false;
    // Password logins supply the version read WITH the bcrypt credential. Never upgrade it.
    const version = user.sessionVersion === undefined ? (freshLogin ? current : 0) : user.sessionVersion;
    if (!Number.isSafeInteger(version) || version < 0 || version !== current) return false;
    return { ...user, claims: { ...user.claims }, sessionUserId: memberId, sessionVersion: version };
  }
  return {
    serialize: (user: unknown) => verify(user, true),
    deserialize: (user: unknown) => verify(user, false),
  };
}
