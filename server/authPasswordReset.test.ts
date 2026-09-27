import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumePasswordResetToken, issuePasswordResetToken } from './authPasswordReset';

function fixture(options: { invalid?: boolean; missing?: boolean; failUpdate?: boolean; failInvalidation?: boolean; failCleanup?: boolean } = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT id, email FROM users') || sql.startsWith('SELECT id FROM users')) {
      return { rows: options.missing ? [] : [{ id: 'member-id', email: 'member@example.test' }] };
    }
    if (sql.startsWith('SELECT id FROM password_reset_tokens')) return { rows: options.invalid ? [] : [{ id: 'token-id' }] };
    if (sql.startsWith('UPDATE users')) {
      if (options.failUpdate) throw new Error('update failed');
      return { rows: [{ id: 'member-id', email: 'member@example.test', session_version: 1 }] };
    }
    if (sql.startsWith('UPDATE password_reset_tokens') && options.failInvalidation) throw new Error('invalidation failed');
    return { rows: [] };
  });
  const release = vi.fn();
  const cleanup = vi.fn(async () => { if (options.failCleanup) throw new Error('cleanup failed'); return { rows: [] }; });
  const connect = vi.fn(async () => ({ query, release }));
  return { pool: { connect, query: cleanup } as unknown as Pool, query, release, cleanup };
}

afterEach(() => vi.restoreAllMocks());

describe('atomic password reset', () => {
  it('locks the member and token, checks expiry after lock wait, increments version and consumes all account tokens before commit', async () => {
    const { pool, query, release, cleanup } = fixture();
    expect(await consumePasswordResetToken(pool, 'synthetic-token', 'synthetic-bcrypt-hash')).toBe(true);
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toMatch(/SELECT id, email FROM users[\s\S]*FOR UPDATE/);
    expect(statements[2]).toMatch(/used = false AND expires_at > clock_timestamp\(\)/);
    expect(statements[2]).toContain("created_at > clock_timestamp() - INTERVAL '1 hour' FOR UPDATE");
    expect(statements[3]).toContain('session_version = session_version + 1');
    expect(query).toHaveBeenNthCalledWith(4, statements[3], ['synthetic-bcrypt-hash', 'member-id']);
    expect(statements[4]).toContain('WHERE LOWER(email) = LOWER($1) AND used = false');
    expect(statements[5]).toBe('COMMIT');
    expect(cleanup).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM auth_sessions'), ['member-id', 1, 'member@example.test']);
    expect(cleanup.mock.invocationCallOrder[0]).toBeGreaterThan(release.mock.invocationCallOrder[0]);
    expect(release).toHaveBeenCalledOnce();
  });
  it.each([{ invalid: true }, { missing: true }])('rejects a used, expired, unknown or concurrently consumed token under lock: %s', async options => {
    const { pool, query, cleanup, release } = fixture(options);
    expect(await consumePasswordResetToken(pool, 'synthetic-token', 'hash')).toBe(false);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE users'))).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
  it.each([{ failUpdate: true }, { failInvalidation: true }])('rolls back password/version/token changes on failure: %s', async options => {
    const { pool, query, cleanup, release } = fixture(options);
    await expect(consumePasswordResetToken(pool, 'synthetic-token', 'hash')).rejects.toThrow();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(cleanup).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
  it('retains successful authoritative version revocation when physical session deletion fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { pool, query } = fixture({ failCleanup: true });
    expect(await consumePasswordResetToken(pool, 'synthetic-token', 'hash')).toBe(true);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(query).not.toHaveBeenCalledWith('ROLLBACK');
  });
  it('serializes token issuance with resets using the same member-first lock order', async () => {
    const { pool, query, release } = fixture();
    expect(await issuePasswordResetToken(pool, 'member@example.test', 'synthetic-token')).toBe(true);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM users WHERE LOWER(email) = $1 FOR UPDATE'), ['member@example.test']);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('UPDATE password_reset_tokens'), ['member@example.test']);
    expect(query).toHaveBeenNthCalledWith(4, expect.stringContaining("clock_timestamp() + INTERVAL '1 hour', clock_timestamp()"), ['member@example.test', 'synthetic-token']);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
});
