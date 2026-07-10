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

export async function ensureLineLinkedUser(profile: LineVerifiedProfile): Promise<LineLinkedUser> {
  const normalizedEmail = normalizeEmail(profile.email) ?? makeInternalLineEmail(profile.lineUserId);
  const displayName = profile.displayName?.trim() || "LINE 使用者";
  const authUserId = `line_${profile.lineUserId}`;

  const userResult = await pool.query<{ id: string; email: string; display_name: string | null; church: string | null }>(
    `INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET display_name = COALESCE(users.display_name, EXCLUDED.display_name),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           password = CASE
             WHEN EXCLUDED.email LIKE '%@line.wechurch.local' THEN users.password
             ELSE NULL
           END,
           updated_at = NOW()
     RETURNING id, email, display_name, church`,
    [normalizedEmail, displayName, profile.pictureUrl ?? null],
  );
  const user = userResult.rows[0];

  const existingAuth = await pool.query<{ id: string }>(
    `SELECT id FROM auth_users WHERE id = $1 OR email = $2 LIMIT 1`,
    [authUserId, normalizedEmail],
  );
  const effectiveAuthUserId = existingAuth.rows[0]?.id ?? authUserId;
  if (existingAuth.rows[0]) {
    await pool.query(
      `UPDATE auth_users
          SET first_name = COALESCE(first_name, $2),
              profile_image_url = COALESCE($3, profile_image_url),
              updated_at = NOW()
        WHERE id = $1`,
      [effectiveAuthUserId, displayName, profile.pictureUrl ?? null],
    );
  } else {
    await pool.query(
      `INSERT INTO auth_users (id, email, first_name, profile_image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [effectiveAuthUserId, normalizedEmail, displayName, profile.pictureUrl ?? null],
    );
  }

  let personId: string | null = null;
  const linkedPerson = await pool.query<{ id: string }>(
    `SELECT p.id
       FROM persons p
       JOIN person_identity_links l ON l.person_id = p.id
      WHERE l.user_id = $1
      LIMIT 1`,
    [user.id],
  );
  personId = linkedPerson.rows[0]?.id ?? null;

  if (!personId && !isInternalLineEmail(normalizedEmail)) {
    const personByEmail = await pool.query<{ id: string }>(
      `SELECT id FROM persons WHERE lower(primary_email) = $1 LIMIT 1`,
      [normalizedEmail],
    );
    personId = personByEmail.rows[0]?.id ?? null;
  }

  if (!personId) {
    const personResult = await pool.query<{ id: string }>(
      `INSERT INTO persons (id, display_name, primary_email, church, pastoral_stage, pastoral_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'friend', 'active', NOW(), NOW())
       RETURNING id`,
      [displayName, isInternalLineEmail(normalizedEmail) ? null : normalizedEmail, user.church ?? null],
    );
    personId = personResult.rows[0]?.id ?? null;
  }

  if (personId) {
    await pool.query(
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

  await pool.query(
    `INSERT INTO line_accounts (
        user_id, person_id, line_user_id, display_name, picture_url, email, channel_id,
        linked_at, last_login_at, created_at, updated_at
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW(), NOW())
     ON CONFLICT (line_user_id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           person_id = EXCLUDED.person_id,
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

  return {
    authUserId: effectiveAuthUserId,
    userId: user.id,
    personId,
    email: normalizedEmail,
    displayName: user.display_name || displayName,
  };
}
