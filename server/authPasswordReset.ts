import type { Pool } from 'pg';

type ResetPool = Pick<Pool, 'connect' | 'query'>;

export async function issuePasswordResetToken(pool: ResetPool, email: string, token: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query('SELECT id FROM users WHERE LOWER(email) = $1 FOR UPDATE', [email]);
    if (owner.rows.length !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('UPDATE password_reset_tokens SET used = true WHERE LOWER(email) = $1 AND used = false', [email]);
    // Timestamp-without-time-zone fields must be written and checked on the same database clock.
    await client.query("INSERT INTO password_reset_tokens (email, token, expires_at, created_at) VALUES ($1, $2, clock_timestamp() + INTERVAL '1 hour', clock_timestamp())", [email, token]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function consumePasswordResetToken(pool: ResetPool, token: string, passwordHash: string): Promise<boolean> {
  const client = await pool.connect();
  let changed: { id: string; email: string; session_version: number };
  try {
    await client.query('BEGIN');
    // Always lock the member before tokens: different tokens for one account cannot deadlock.
    const owner = await client.query(
      `SELECT id, email FROM users WHERE LOWER(email) =
       (SELECT LOWER(email) FROM password_reset_tokens WHERE token = $1) FOR UPDATE`, [token],
    );
    if (owner.rows.length !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const member = owner.rows[0];
    const reset = await client.query(
      `SELECT id FROM password_reset_tokens WHERE token = $1 AND LOWER(email) = LOWER($2)
       AND used = false AND expires_at > clock_timestamp()
       AND created_at > clock_timestamp() - INTERVAL '1 hour' FOR UPDATE`, [token, member.email],
    );
    if (reset.rows.length !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const updated = await client.query(
      `UPDATE users SET password = $1, session_version = session_version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING id, email, session_version`, [passwordHash, member.id],
    );
    changed = updated.rows[0];
    await client.query('UPDATE password_reset_tokens SET used = true WHERE LOWER(email) = LOWER($1) AND used = false', [member.email]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Best-effort cleanup only. The committed version check revokes even concurrently saved sessions.
  try {
    await pool.query(
      `DELETE FROM auth_sessions
       WHERE (sess->'passport'->'user'->>'sessionUserId' = $1 OR
         sess->'passport'->'user'->'claims'->>'sub' IN (
           SELECT a.id FROM auth_users a LEFT JOIN google_account_links g ON g.auth_user_id = a.id
           WHERE g.user_id = $1::uuid OR (g.auth_user_id IS NULL AND a.email = $3)))
       AND COALESCE((sess->'passport'->'user'->>'sessionVersion')::bigint, 0) < $2`,
      [changed.id, changed.session_version, changed.email],
    );
  } catch {
    console.warn('[Auth] Session cleanup unavailable; database session version remains authoritative');
  }
  return true;
}
