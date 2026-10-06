import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { issuePasswordResetToken } from '../server/authPasswordReset';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

// Called only by the parent-owned disposable localhost integrity harness, never production.
export async function verifyAuthSecurityHttp(pool: Pool, origin: string, makeClient: () => Client) {
  const base = new URL(origin);
  assert(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname));
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name, /^wechurch_integrity_[a-f0-9]{32}$/);
  assert.equal(process.env.PUBLIC_BASE_URL, origin, 'Set PUBLIC_BASE_URL to the fixture origin before auth requests');

  // Prove a legitimately issued token works before introducing the concurrent-reset case.
  const simpleEmail = `auth-reset-${randomUUID()}@example.test`;
  const simplePassword = randomUUID(), simpleToken = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO users(email) VALUES($1)', [simpleEmail]);
  assert(await issuePasswordResetToken(pool, simpleEmail, simpleToken));
  const simpleClient = makeClient();
  assert.equal((await simpleClient(`/api/auth/verify-reset-token?token=${simpleToken}`)).status, 200);
  const single = await simpleClient('/api/auth/reset-password', 'POST', { token: simpleToken, password: simplePassword });
  const singleBody = await single.json();
  assert.equal(single.status, 200, `Single legitimate reset: ${singleBody.message}`);
  const singleMember = (await pool.query('SELECT password,session_version FROM users WHERE email=$1', [simpleEmail])).rows[0];
  assert.equal(singleMember.session_version, 1);
  assert(await bcrypt.compare(simplePassword, singleMember.password));

  const email = `auth-security-${randomUUID()}@example.test`;
  const oldPassword = randomUUID(), newPassword = randomUUID();
  const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
  assert.equal((await clients[0]('/api/auth/register', 'POST', { email, password: oldPassword, displayName: 'Auth security fixture' })).status, 200);
  const member = (await pool.query('SELECT id, session_version FROM users WHERE email = $1', [email])).rows[0];
  assert.equal(member.session_version, 0);
  const authId = (await pool.query('SELECT id FROM auth_users WHERE email = $1', [email])).rows[0].id;
  const snapshots: Array<{ sid: string; sess: Record<string, unknown>; expire: Date }> = [];
  async function captureSession() {
    const rows = (await pool.query("SELECT sid, sess, expire FROM auth_sessions WHERE sess->'passport'->'user'->'claims'->>'sub' = $1", [authId])).rows;
    const row = rows.find(candidate => !snapshots.some(previous => previous.sid === candidate.sid));
    assert(row, 'Expected a newly saved authenticated session');
    snapshots.push(row);
  }
  await captureSession();
  for (const client of clients.slice(1)) {
    assert.equal((await client('/api/auth/email-login', 'POST', { email, password: oldPassword })).status, 200);
    await captureSession();
  }
  for (const [index, snapshot] of snapshots.entries()) {
    const user = (snapshot.sess.passport as { user: { sessionVersion: number; sessionUserId: string } }).user;
    assert.equal(user.sessionVersion, 0);
    assert.equal(user.sessionUserId, member.id);
    assert.equal((await clients[index]('/api/auth/user')).status, 200);
  }

  // Exercise legacy, Google (including changed email), LINE and local stored identities.
  const googleId = `9${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const lineId = `line_${randomUUID()}`;
  await pool.query("INSERT INTO auth_users(id,email) VALUES($1,$2)", [googleId, `changed-${randomUUID()}@example.test`]);
  await pool.query('INSERT INTO google_account_links(google_subject,user_id,auth_user_id) VALUES($1,$2,$1)', [googleId, member.id]);
  // Local/LINE identities may reuse the same auth-user row; rename it to test the LINE subject form.
  await pool.query('UPDATE auth_users SET id = $1 WHERE id = $2', [lineId, authId]);
  for (const [index, snapshot] of snapshots.entries()) {
    const passport = snapshot.sess.passport as { user: Record<string, unknown> & { claims: { sub: string } } };
    passport.user.claims.sub = index === 1 ? googleId : lineId;
    if (index === 0) {
      // A pre-receipt legacy session has neither canonical binding nor new login metadata.
      // New bound receipts remain protected by the atomic session-save trigger.
      delete passport.user.sessionVersion; delete passport.user.sessionUserId;
      delete passport.user.loginReceiptId; delete passport.user.loginReceiptAt;
    }
    await pool.query('UPDATE auth_sessions SET sess = $1 WHERE sid = $2', [JSON.stringify(snapshot.sess), snapshot.sid]);
    assert.equal((await clients[index]('/api/auth/user')).status, 200);
  }

  for (const path of ['/api/auth/register', '/api/auth/email-login']) {
    for (const maliciousOrigin of ['https://evil.test', 'null']) {
      const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: maliciousOrigin }, body: JSON.stringify({ email, password: oldPassword }), redirect: 'manual' });
      assert.equal(response.status, 403);
    }
    assert.equal((await fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password: oldPassword }), redirect: 'manual' })).status, 415);
    assert.equal((await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: oldPassword }), redirect: 'manual' })).status, 403);
  }

  const tokens = [randomBytes(32).toString('hex'), randomUUID()];
  for (const token of tokens) await pool.query("INSERT INTO password_reset_tokens(email,token,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [email, token]);
  const resetter = makeClient();
  for (const token of tokens) assert.equal((await resetter(`/api/auth/verify-reset-token?token=${token}`)).status, 200);
  const resetResults = await Promise.all(tokens.map(token => resetter('/api/auth/reset-password', 'POST', { token, password: newPassword })));
  const resetDiagnostics = await Promise.all(resetResults.map(async result => ({ status: result.status, message: (await result.json()).message })));
  assert.deepEqual(resetResults.map(result => result.status).sort(), [200, 400], JSON.stringify(resetDiagnostics));
  const changed = (await pool.query('SELECT password, session_version FROM users WHERE id = $1', [member.id])).rows[0];
  assert.equal(changed.session_version, 1);
  assert(await bcrypt.compare(newPassword, changed.password));
  assert.equal((await pool.query('SELECT count(*)::int count FROM password_reset_tokens WHERE email = $1 AND used = false', [email])).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::int count FROM auth_sessions WHERE sid = ANY($1::text[])', [snapshots.map(snapshot => snapshot.sid)])).rows[0].count, 0);

  // Reinsert old sessions to model a delayed store write after physical deletion.
  for (const [index, snapshot] of snapshots.entries()) {
    await pool.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expire=EXCLUDED.expire', [snapshot.sid, JSON.stringify(snapshot.sess), snapshot.expire]);
    assert.equal((await clients[index]('/api/auth/user')).status, 401);
  }
  assert.equal((await resetter('/api/auth/reset-password', 'POST', { token: tokens[0], password: oldPassword })).status, 400);
  const fresh = makeClient();
  assert.equal((await fresh('/api/auth/email-login', 'POST', { email, password: oldPassword })).status, 401);
  assert.equal((await fresh('/api/auth/email-login', 'POST', { email, password: newPassword })).status, 200);
  assert.equal((await fresh('/api/auth/user')).status, 200);

  const expiredToken = randomUUID();
  await pool.query("INSERT INTO password_reset_tokens(email,token,expires_at) VALUES($1,$2,NOW()-INTERVAL '1 minute')", [email, expiredToken]);
  assert.equal((await resetter('/api/auth/reset-password', 'POST', { token: expiredToken, password: oldPassword })).status, 400);
  assert.equal((await pool.query('SELECT session_version FROM users WHERE id = $1', [member.id])).rows[0].session_version, 1);

  const limitedEmail = `rate-${randomUUID()}@example.test`;
  for (let i = 0; i < 11; i++) {
    const response = await fetch(origin + '/api/auth/email-login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Forwarded-For': `198.51.100.${i + 1}`, 'X-Participant-Id': randomUUID() },
      body: JSON.stringify({ email: i % 2 ? ` ${limitedEmail.toUpperCase()} ` : limitedEmail, password: randomUUID() }),
    });
    assert.equal(response.status, i < 10 ? 401 : 429);
  }
  assert.equal((await makeClient()('/api/auth/email-login', 'POST', { email, password: newPassword })).status, 200);
  await verifySharedNatLogins(pool, origin, makeClient);
  return { legitimateReset: true, csrf: true, providerSessionRevocation: true, legacyRevocation: true, concurrentReset: true, physicalSessionCleanup: true, delayedSessionSave: true, newPasswordLogin: true, expiredToken: true, independentAccountLimit: true, sharedNat101Logins: true, wrongPasswordSprayDenied: true };
}

async function verifySharedNatLogins(pool: Pool, origin: string, makeClient: () => Client) {
  const password = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  const emails = Array.from({ length: 101 }, () => `nat-${randomUUID()}@example.test`);
  await pool.query('INSERT INTO users(email,password) SELECT unnest($1::text[]), $2', [emails, hash]);
  // Each member actually logs in over HTTP; these are not pre-created authenticated cookies.
  for (const [index, email] of emails.entries()) {
    const member = makeClient();
    const response = await member('/api/auth/email-login', 'POST', { email, password });
    assert.equal(response.status, 200, `Legitimate shared-NAT member ${index + 1}: ${(await response.json()).message}`);
    assert.equal((await member('/api/auth/user')).status, 200);
  }

  let failures = 0, denied = false;
  for (const [index, email] of emails.entries()) {
    const response = await fetch(origin + '/api/auth/email-login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Forwarded-For': `198.51.100.${index + 1}`, 'X-Participant-Id': randomUUID() },
      body: JSON.stringify({ email, password: 'synthetic-wrong-password' }),
    });
    if (response.status === 429) {
      assert.match((await response.json()).message, /failed authentication attempts/);
      denied = true; break;
    }
    assert.equal(response.status, 401); failures++;
  }
  assert(failures > 0 && denied, 'Failed-password IP budget must still block a cross-account spray');
}
