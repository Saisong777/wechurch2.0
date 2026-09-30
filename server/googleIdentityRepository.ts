import type { Pool } from 'pg';

export class GoogleIdentityError extends Error {
  constructor(public readonly code: 'GOOGLE_IDENTITY_INVALID' | 'GOOGLE_ACCOUNT_LINK_REQUIRED') {
    super(code);
  }
}

interface GoogleProfile {
  provider: string;
  id: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  displayName?: string;
  name?: { givenName?: string; familyName?: string };
  photos?: Array<{ value: string }>;
}

interface Identity {
  authUserId: string;
  userId: string;
  email: string;
}

// Only call with a profile fetched by the server's Google OAuth strategy.
export async function resolveGoogleIdentity(pool: Pool, profile: GoogleProfile): Promise<Identity> {
  const verifiedEmail = profile.emails?.find(entry => entry.verified === true)?.value;
  if (profile.provider !== 'google' || !/^\d{1,255}$/.test(profile.id) ||
      !verifiedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail)) {
    throw new GoogleIdentityError('GOOGLE_IDENTITY_INVALID');
  }
  const email = verifiedEmail.trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent first logins; uniqueness constraints remain the final guard.
    for (const key of [`google:${profile.id}`, `google-email:${email}`].sort()) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
    const linked = await client.query<Identity>(
      `SELECT g.auth_user_id AS "authUserId", g.user_id AS "userId", u.email
       FROM google_account_links g JOIN users u ON u.id=g.user_id
       JOIN auth_users a ON a.id=g.auth_user_id
       WHERE g.google_subject=$1 FOR UPDATE OF g, u, a`, [profile.id]);
    if (linked.rows[0]) {
      await client.query('COMMIT');
      return linked.rows[0];
    }

    // Existing Google sessions used the Google subject as auth_users.id.
    // Bootstrap only that proven subject, never a new subject with the same email.
    const legacyAuth = await client.query<{ id: string; email: string }>(
      'SELECT id, email FROM auth_users WHERE id=$1 FOR UPDATE', [profile.id]);
    let identity: Identity;
    if (legacyAuth.rows[0]?.email) {
      const legacyUsers = await client.query<{ id: string; email: string }>(
        'SELECT id, email FROM users WHERE lower(trim(email))=lower(trim($1)) FOR UPDATE',
        [legacyAuth.rows[0].email]);
      if (legacyUsers.rows.length !== 1) throw new GoogleIdentityError('GOOGLE_ACCOUNT_LINK_REQUIRED');
      identity = { authUserId: profile.id, userId: legacyUsers.rows[0].id, email: legacyUsers.rows[0].email };
    } else {
      const collisions = await client.query(
        `SELECT id::text FROM users WHERE lower(trim(email))=$1
         UNION ALL SELECT id FROM auth_users WHERE lower(trim(email))=$1 OR id=$2`, [email, profile.id]);
      if (collisions.rows.length) throw new GoogleIdentityError('GOOGLE_ACCOUNT_LINK_REQUIRED');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (email, display_name, avatar_url) VALUES ($1,$2,$3) RETURNING id`,
        [email, profile.displayName || email.split('@')[0], profile.photos?.[0]?.value || null]);
      await client.query(
        `INSERT INTO auth_users (id,email,first_name,last_name,profile_image_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [profile.id, email, profile.name?.givenName || '', profile.name?.familyName || '', profile.photos?.[0]?.value || null]);
      identity = { authUserId: profile.id, userId: inserted.rows[0].id, email };
    }
    await client.query(
      'INSERT INTO google_account_links (google_subject,user_id,auth_user_id) VALUES ($1,$2,$3)',
      [profile.id, identity.userId, identity.authUserId]);
    await client.query('COMMIT');
    return identity;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      throw new GoogleIdentityError('GOOGLE_ACCOUNT_LINK_REQUIRED');
    }
    throw error;
  } finally {
    client.release();
  }
}
