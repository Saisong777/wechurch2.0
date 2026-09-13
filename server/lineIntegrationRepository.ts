import { pool } from "./db";

export interface LineVerifiedProfile {
  lineUserId: string;
  displayName?: string | null;
  pictureUrl?: string | null;
  email?: string | null;
  channelId?: string | null;
}

export interface LineLinkedUser {
  authUserId: string;
  userId: string;
  personId: string | null;
  email: string;
  displayName: string;
}

export function isLineSchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string };
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

function makeInternalLineEmail(lineUserId: string) {
  const safeId = lineUserId.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `line_${safeId}@line.wechurch.local`;
}

function normalizeEmail(email?: string | null) {
  const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
  return trimmed || null;
}

export function isInternalLineEmail(email: string) {
  return email.endsWith("@line.wechurch.local");
}

export async function ensureLineLinkedUser(profile: LineVerifiedProfile, linkUserId?: string): Promise<LineLinkedUser> {
  if (!/^U[0-9a-f]{32}$/i.test(profile.lineUserId)) throw new Error('Invalid LINE subject');
  const client = await pool.connect();
  try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('line-login:' || $1))", [profile.lineUserId]);
  const bound = (await client.query(`SELECT la.user_id,la.person_id,la.channel_id,u.email FROM line_accounts la
    JOIN users u ON u.id=la.user_id WHERE la.line_user_id=$1 FOR UPDATE OF la,u`, [profile.lineUserId])).rows[0];
  if (bound?.channel_id && profile.channelId && bound.channel_id !== profile.channelId) throw new Error('LINE channel binding mismatch');
  if (bound && linkUserId && bound.user_id !== linkUserId) throw new Error('LINE_ACCOUNT_ALREADY_LINKED');
  const linkingUser = linkUserId ? (await client.query('SELECT id,email FROM users WHERE id=$1 FOR UPDATE',[linkUserId])).rows[0] : null;
  if (linkUserId && !linkingUser) throw new Error('LINE_ACCOUNT_LINK_REQUIRED');
  if (linkUserId && (await client.query('SELECT id FROM line_accounts WHERE user_id=$1 AND line_user_id<>$2',[linkUserId,profile.lineUserId])).rowCount) throw new Error('LINE_ACCOUNT_ALREADY_LINKED');
  const normalizedEmail = normalizeEmail(bound?.email || linkingUser?.email || profile.email) || makeInternalLineEmail(profile.lineUserId);
  const displayName = profile.displayName?.trim() || "LINE 使用者";
  const authUserId = `line_${profile.lineUserId}`;

  const existingUser = await client.query<{ id: string; email: string; display_name: string | null; church: string | null }>('SELECT id,email,display_name,church FROM users WHERE lower(trim(email))=$1 FOR UPDATE', [normalizedEmail]);
  if (!bound && !linkingUser && existingUser.rows[0]) throw new Error('LINE_ACCOUNT_LINK_REQUIRED');
  const userResult = bound || linkingUser ? await client.query<{ id: string; email: string; display_name: string | null; church: string | null }>('SELECT id,email,display_name,church FROM users WHERE id=$1 FOR UPDATE', [bound?.user_id || linkingUser.id]) : await client.query<{ id: string; email: string; display_name: string | null; church: string | null }>(
    `INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
     RETURNING id, email, display_name, church`,
    [normalizedEmail, displayName, profile.pictureUrl ?? null],
  );
  const user = userResult.rows[0];

  const existingAuth = await client.query<{ id: string }>(
    `SELECT id FROM auth_users WHERE id = $1 OR email = $2 ORDER BY (id=$1) DESC LIMIT 1`,
    [authUserId, user.email],
  );
  const effectiveAuthUserId = existingAuth.rows[0]?.id ?? authUserId;
  if (!bound && !linkingUser && existingAuth.rows[0]) throw new Error('LINE_ACCOUNT_LINK_REQUIRED');
  if (existingAuth.rows[0]) {
    await client.query(
      `UPDATE auth_users
          SET first_name = COALESCE(first_name, $2),
              profile_image_url = COALESCE($3, profile_image_url),
              updated_at = NOW()
        WHERE id = $1`,
      [effectiveAuthUserId, displayName, profile.pictureUrl ?? null],
    );
  } else {
    await client.query(
      `INSERT INTO auth_users (id, email, first_name, profile_image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [effectiveAuthUserId, user.email, displayName, profile.pictureUrl ?? null],
    );
  }

  let personId: string | null = null;
  const linkedPerson = await client.query<{ id: string }>(
    `SELECT COALESCE(p.merged_into_person_id,p.id) AS id
       FROM persons p
       JOIN person_identity_links l ON l.person_id = p.id
      WHERE l.user_id = $1
      LIMIT 1`,
    [user.id],
  );
  personId = linkedPerson.rows[0]?.id ?? null;

  if (!personId) {
    const emailClaimed = (await client.query('SELECT id FROM persons WHERE lower(primary_email)=$1', [normalizedEmail])).rowCount;
    const personResult = await client.query<{ id: string }>(
      `INSERT INTO persons (id, display_name, primary_email, church, pastoral_stage, pastoral_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'friend', 'active', NOW(), NOW())
       RETURNING id`,
      [displayName, isInternalLineEmail(normalizedEmail) || emailClaimed ? null : normalizedEmail, user.church ?? null],
    );
    personId = personResult.rows[0]?.id ?? null;
  }

  if (personId) {
    await client.query(
      `INSERT INTO person_identity_links (
          person_id, user_id, source_type, source_label, match_method, confidence, is_primary, created_at, updated_at
        )
       VALUES ($1, $2, 'line_account', 'LINE', 'line_login', 92, true, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET source_type = COALESCE(person_identity_links.source_type, 'line_account'),
             updated_at = NOW()`,
      [personId, user.id],
    );
  }

  await client.query(
    `INSERT INTO line_accounts (
        user_id, person_id, line_user_id, display_name, picture_url, email, channel_id,
        linked_at, last_login_at, created_at, updated_at
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW(), NOW())
     ON CONFLICT (line_user_id) DO UPDATE
       SET person_id = EXCLUDED.person_id,
           display_name = EXCLUDED.display_name,
           picture_url = EXCLUDED.picture_url,
           email = EXCLUDED.email,
           channel_id = EXCLUDED.channel_id,
           last_login_at = NOW(),
           updated_at = NOW()`,
    [
      user.id,
      personId,
      profile.lineUserId,
      displayName,
      profile.pictureUrl ?? null,
      normalizedEmail,
      profile.channelId ?? null,
    ],
  );

  await client.query('COMMIT');
  return {
    authUserId: effectiveAuthUserId,
    userId: user.id,
    personId,
    email: user.email,
    displayName: user.display_name || displayName,
  };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
