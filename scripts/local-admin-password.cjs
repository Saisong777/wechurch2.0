#!/usr/bin/env node

const pg = require("pg");
const bcrypt = require("bcryptjs");
const { isLocalDatabase, pgConfig } = require("./content-tables.cjs");

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
const email = (process.env.LOCAL_ADMIN_EMAIL || "saisong@gmail.com").trim().toLowerCase();
const password = process.env.LOCAL_ADMIN_PASSWORD || "localdev123";

if (!isLocalDatabase(databaseUrl) && process.env.ALLOW_NON_LOCAL_IMPORT !== "1") {
  console.error("[local-admin-password] Refusing to modify a non-local database.");
  process.exit(1);
}

async function main() {
  if (password.length < 8) {
    throw new Error("LOCAL_ADMIN_PASSWORD must be at least 8 characters");
  }

  const pool = new pg.Pool(pgConfig(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `UPDATE users SET password = $1, updated_at = NOW()
       WHERE LOWER(email) = $2
       RETURNING id, email, display_name`,
      [hash, email],
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User not found: ${email}`);
    }

    const user = userResult.rows[0];
    const authUserId = `local_${user.id}`;
    await client.query(
      `INSERT INTO auth_users (id, email, first_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, updated_at = NOW()`,
      [authUserId, user.email, user.display_name || user.email.split("@")[0]],
    );

    const roleResult = await client.query("SELECT id FROM user_roles WHERE user_id = $1 LIMIT 1", [user.id]);
    if (roleResult.rows.length > 0) {
      await client.query("UPDATE user_roles SET role = 'admin', updated_at = NOW() WHERE user_id = $1", [user.id]);
    } else {
      await client.query(
        "INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (gen_random_uuid(), $1, 'admin', NOW(), NOW())",
        [user.id],
      );
    }

    await client.query("COMMIT");
    console.log(`[local-admin-password] ${user.email} is ready for local admin login.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[local-admin-password] failed:", error.message);
  process.exit(1);
});
