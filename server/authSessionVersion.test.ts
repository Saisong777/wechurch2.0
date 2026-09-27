import { describe, expect, it, vi } from 'vitest';
import { createSessionVersionGuard } from './authSessionVersion';

function fixture(version = 0) {
  const identities = { getUser: vi.fn(async () => ({ legacyUserId: 'member-id' })) };
  const getVersion = vi.fn(async () => version as number | undefined);
  return { identities, getVersion, guard: createSessionVersionGuard(identities, getVersion) };
}

describe('database-backed session revocation', () => {
  it.each(['local_member-id', 'dev_member-id', '123456789', 'line_subject'])('maps %s through authStorage, not the subject or session email', async sub => {
    const { guard, identities, getVersion } = fixture(3);
    const login = { claims: { sub, email: 'stale-provider@example.test' } };
    const session = await guard.serialize(login);
    expect(identities.getUser).toHaveBeenCalledWith(sub);
    expect(getVersion).toHaveBeenCalledWith('member-id');
    expect(session).toMatchObject({ sessionVersion: 3, sessionUserId: 'member-id' });
    expect(login).not.toHaveProperty('sessionVersion');
    expect(await guard.deserialize(session)).toEqual(session);
    getVersion.mockResolvedValue(4);
    expect(await guard.deserialize(session)).toBe(false);
  });

  it('accepts legacy sessions only at version zero and never upgrades them', async () => {
    const { guard, getVersion } = fixture();
    const legacy = { claims: { sub: '123456789' } };
    expect(await guard.deserialize(legacy)).toMatchObject({ sessionVersion: 0 });
    getVersion.mockResolvedValue(1);
    expect(await guard.deserialize(legacy)).toBe(false);
    expect(legacy).not.toHaveProperty('sessionVersion');
  });

  it('rejects a password verified before a concurrent reset, while permitting a fresh provider login', async () => {
    const { guard, getVersion } = fixture();
    const passwordLogin = { claims: { sub: 'local_member-id' }, sessionVersion: 0, sessionUserId: 'member-id' };
    getVersion.mockResolvedValue(1);
    expect(await guard.serialize(passwordLogin)).toBe(false);
    expect(passwordLogin.sessionVersion).toBe(0);
    expect(await guard.serialize({ claims: passwordLogin.claims })).toMatchObject({ sessionVersion: 1 });
  });

  it('revokes an old serialized session even if it is saved after reset cleanup', async () => {
    const { guard, getVersion } = fixture();
    const savedLate = await guard.serialize({ claims: { sub: 'local_member-id' }, sessionVersion: 0 });
    getVersion.mockResolvedValue(1);
    expect(await guard.deserialize(JSON.parse(JSON.stringify(savedLate)))).toBe(false);
  });

  it('does not remap a previously bound session onto a different member', async () => {
    const { guard, identities } = fixture();
    const session = await guard.serialize({ claims: { sub: 'line_subject' } });
    identities.getUser.mockResolvedValue({ legacyUserId: 'other-member' });
    expect(await guard.deserialize(session)).toBe(false);
  });

  it.each([-1, 0.5, '0', null, NaN, Infinity])('rejects malformed serialized version %s', async version => {
    const { guard } = fixture();
    expect(await guard.deserialize({ claims: { sub: 'local_member-id' }, sessionVersion: version })).toBe(false);
  });

  it('fails closed for missing members and database failure', async () => {
    const { guard, getVersion } = fixture();
    const user = { claims: { sub: 'local_member-id' } };
    getVersion.mockResolvedValue(undefined);
    expect(await guard.deserialize(user)).toBe(false);
    getVersion.mockRejectedValue(new Error('database unavailable'));
    await expect(guard.deserialize(user)).rejects.toThrow('database unavailable');
    expect(await guard.deserialize({ claims: {} })).toBe(false);
    const unmapped = createSessionVersionGuard({ getUser: async () => undefined }, getVersion);
    expect(await unmapped.serialize(user)).toBe(false);
  });
});
