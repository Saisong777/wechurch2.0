import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { resolveGoogleIdentity } from '../server/googleIdentityRepository';

// Never use DATABASE_URL: this exercise owns only a temporary local schema.
const url = new URL(process.env.GOOGLE_IDENTITY_TEST_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.search) throw new Error('Use a local test PostgreSQL URL without query parameters');
const schema = `google_identity_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: url.href });
let pool: Pool | undefined;
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  pool = new Pool({ connectionString: url.href, options: `-c search_path=${schema},pg_catalog` });
  await pool.query(`
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
      password text, display_name text, avatar_url text);
    CREATE TABLE auth_users (id varchar PRIMARY KEY, email varchar UNIQUE, first_name text, last_name text,
      profile_image_url text, CONSTRAINT failure_injection CHECK (first_name <> 'FAIL_TEST'));
    CREATE TABLE user_roles (user_id uuid REFERENCES users(id), role text);
  `);
  await pool.query(readFileSync(new URL('../migrations/0012_google_account_links.sql', import.meta.url), 'utf8'));
  const profile = (id: string, email = `${id}@example.test`) => ({
    provider: 'google', id, emails: [{ value: email, verified: true }], displayName: 'Synthetic member',
  });
  const counts = async () => (await pool!.query(`SELECT (SELECT count(*) FROM users) users,
    (SELECT count(*) FROM auth_users) auth, (SELECT count(*) FROM google_account_links) links`)).rows[0];
  const first = await resolveGoogleIdentity(pool, profile('1001'));
  const beforeInvalid = await counts();
  for (const invalid of [
    { ...profile('1010'), provider: 'firebase' },
    profile('firebase-uid'),
    { ...profile('1010'), emails: [{ value: 'unverified@example.test', verified: false }] },
    { ...profile('1010'), emails: [] },
  ]) await assert.rejects(resolveGoogleIdentity(pool, invalid), /GOOGLE_IDENTITY_INVALID/);
  assert.deepEqual(await counts(), beforeInvalid);
  const again = await resolveGoogleIdentity(pool, profile('1001', 'changed@example.test'));
  assert.deepEqual(first, again);
  assert.deepEqual(await counts(), { users: '1', auth: '1', links: '1' });

  const results = await Promise.all([resolveGoogleIdentity(pool, profile('1002')), resolveGoogleIdentity(pool, profile('1002'))]);
  assert.deepEqual(results[0], results[1]);
  const collision = await pool.query(`INSERT INTO users (email,password) VALUES ('MixedCase@Example.test','KEEP_PASSWORD') RETURNING id`);
  await pool.query(`INSERT INTO auth_users (id,email) VALUES ('local_test','MixedCase@Example.test')`);
  await pool.query(`INSERT INTO user_roles (user_id,role) VALUES ($1,'admin')`, [collision.rows[0].id]);
  const beforeCollision = await counts();
  await assert.rejects(resolveGoogleIdentity(pool, profile('1003', 'mixedcase@example.test')), /GOOGLE_ACCOUNT_LINK_REQUIRED/);
  assert.deepEqual(await counts(), beforeCollision);
  assert.equal((await pool.query('SELECT password FROM users WHERE id=$1', [collision.rows[0].id])).rows[0].password, 'KEEP_PASSWORD');
  assert.equal((await pool.query('SELECT role FROM user_roles WHERE user_id=$1', [collision.rows[0].id])).rows[0].role, 'admin');

  const old = await pool.query(`INSERT INTO users (email,password) VALUES ('old@example.test','KEEP_LEGACY_PASSWORD') RETURNING id`);
  await pool.query(`INSERT INTO auth_users (id,email) VALUES ('1004','old@example.test')`);
  const restored = await resolveGoogleIdentity(pool, profile('1004', 'mixedcase@example.test'));
  assert.equal(restored.userId, old.rows[0].id);
  assert.equal(restored.email, 'old@example.test');
  assert.equal((await pool.query('SELECT password FROM users WHERE id=$1', [old.rows[0].id])).rows[0].password, 'KEEP_LEGACY_PASSWORD');
  await pool.query(`UPDATE auth_users SET email='drift@example.test' WHERE id='1004'`);
  assert.equal((await resolveGoogleIdentity(pool, profile('1004'))).userId, old.rows[0].id);

  const beforeFailure = await counts();
  await assert.rejects(resolveGoogleIdentity(pool, { ...profile('1005'), name: { givenName: 'FAIL_TEST' } }));
  assert.deepEqual(await counts(), beforeFailure);
  await pool.query(`INSERT INTO auth_users (id,email) VALUES ('1006','orphan@example.test')`);
  await assert.rejects(resolveGoogleIdentity(pool, profile('1006')), /GOOGLE_ACCOUNT_LINK_REQUIRED/);
  const raced = await Promise.allSettled([
    resolveGoogleIdentity(pool, profile('1007', 'same@example.test')),
    resolveGoogleIdentity(pool, profile('1008', 'same@example.test')),
  ]);
  assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(raced.filter(result => result.status === 'rejected').length, 1);
  console.log('PASS: stable subject, changed email, concurrent login, collision rejection, password/role preservation, legacy mapping, orphan rejection, rollback');
} finally {
  await pool?.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
