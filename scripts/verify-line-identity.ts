import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ensureLineLinkedUser } from '../server/lineIntegrationRepository';

export async function verifyLineIdentity(pool: Pool) {
  const subject = () => `U${randomUUID().replaceAll('-','')}`;
  const profile = { lineUserId: subject(), channelId: 'synthetic-channel', displayName: 'Synthetic LINE' };
  const [first, repeated] = await Promise.all([ensureLineLinkedUser(profile), ensureLineLinkedUser(profile)]);
  assert.equal(first.userId, repeated.userId);
  const changed = await ensureLineLinkedUser({ ...profile, email: 'new-provider-email@example.test' });
  assert.equal(first.userId, changed.userId); assert.equal(first.email, changed.email);
  const email = `existing-${randomUUID()}@example.test`;
  const existing = (await pool.query("INSERT INTO users(email,password) VALUES($1,'PRESERVE_PASSWORD_HASH') RETURNING id",[email])).rows[0].id;
  await assert.rejects(ensureLineLinkedUser({ lineUserId: subject(), email }), /LINE_ACCOUNT_LINK_REQUIRED/);
  assert.equal((await pool.query('SELECT password FROM users WHERE id=$1',[existing])).rows[0].password,'PRESERVE_PASSWORD_HASH');
  const linkedProfile={lineUserId:subject(),email};
  assert.equal((await ensureLineLinkedUser(linkedProfile,existing)).userId,existing);
  assert.equal((await pool.query('SELECT password FROM users WHERE id=$1',[existing])).rows[0].password,'PRESERVE_PASSWORD_HASH');
  await assert.rejects(ensureLineLinkedUser(linkedProfile,first.userId),/LINE_ACCOUNT_ALREADY_LINKED/);
  const mixedEmail=`MixedCase-${randomUUID()}@Example.test`;
  const mixedId=(await pool.query('INSERT INTO users(email) VALUES($1) RETURNING id',[mixedEmail])).rows[0].id;
  const mixedProfile={lineUserId:subject(),email:mixedEmail.toLowerCase()};
  assert.equal((await ensureLineLinkedUser(mixedProfile,mixedId)).userId,mixedId);
  const mixedRepeat=await ensureLineLinkedUser(mixedProfile);
  assert.equal(mixedRepeat.userId,mixedId); assert.equal(mixedRepeat.email,mixedEmail);
  await assert.rejects(ensureLineLinkedUser({ ...profile, channelId: 'other-channel' }), /mismatch/);
  const counts = async () => (await pool.query(`SELECT (SELECT count(*) FROM users)::int users,(SELECT count(*) FROM auth_users)::int auth,
    (SELECT count(*) FROM persons)::int persons,(SELECT count(*) FROM line_accounts)::int line,(SELECT count(*) FROM person_identity_links)::int links`)).rows[0];
  await pool.query("ALTER TABLE auth_users ADD CONSTRAINT line_test_failure CHECK(first_name <> 'INJECT_LINE_FAILURE')");
  const before = await counts();
  try { await assert.rejects(ensureLineLinkedUser({ lineUserId: subject(), displayName: 'INJECT_LINE_FAILURE' })); assert.deepEqual(await counts(), before); }
  finally { await pool.query('ALTER TABLE auth_users DROP CONSTRAINT line_test_failure'); }
  console.log('PASS LINE subject identity, concurrent login, password preservation, channel separation and transaction rollback');
}
