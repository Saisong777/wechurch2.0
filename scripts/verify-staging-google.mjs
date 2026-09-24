import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { inspectStaging, target, root } from './railway-staging.mjs';

const { app, database, productionDeployment } = inspectStaging();
assert.equal(app.AUTH_REGISTRATION_MODE, 'google-only');
assert.equal(app.STAGING_GOOGLE_LOGIN_ENABLED, '1');
const client = new pg.Client({ connectionString: database.DATABASE_PUBLIC_URL, connectionTimeoutMillis: 10000 });
await client.connect();
let cookie = '';
const checks = [];
async function call(route, method = 'GET', body) {
  const response = await fetch(target.origin + route, {
    method, redirect: 'manual', signal: AbortSignal.timeout(20000),
    headers: { Cookie: cookie, Origin: target.origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(';')[0], name = pair.split('=')[0];
    cookie = cookie.split('; ').filter(p => p && !p.startsWith(name + '=')).concat(pair).join('; ');
  }
  return response;
}
async function counts() {
  return (await client.query(`SELECT (SELECT count(*)::integer FROM users) AS members,
    (SELECT count(*)::integer FROM auth_users) AS accounts,
    (SELECT count(*)::integer FROM google_account_links) AS links`)).rows[0];
}
try {
  const before = await counts();
  assert.equal((await call('/api/login')).status, 401);
  assert.equal((await call('/__staging/access', 'POST', { code: app.STAGING_ACCESS_CODE })).status, 303);
  const options = await call('/api/auth/options');
  assert.equal(options.status, 200);
  assert.deepEqual(await options.json(), { google: true, emailRegistration: false, staging: true });
  assert.equal((await call('/api/auth/register', 'POST', {})).status, 403);
  checks.push('Invited users only; Google registration enabled; email registration closed');
  for (const route of ['/api/dev-login', '/api/cron/daily-follow-email', '/api/webhooks/resend']) {
    assert.equal((await call(route)).status, 403);
  }
  const login = await call('/api/login');
  assert.equal(login.status, 302);
  const destination = new URL(login.headers.get('location'));
  assert.equal(destination.origin, 'https://accounts.google.com');
  assert.equal(destination.searchParams.get('client_id'), app.GOOGLE_CLIENT_ID);
  assert.equal(destination.searchParams.get('redirect_uri'), `${target.origin}/api/callback`);
  assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(destination.searchParams.get('code_challenge'));
  assert.ok(destination.searchParams.get('state'));
  assert.deepEqual(destination.searchParams.get('scope').split(' ').sort(), ['email', 'openid', 'profile']);
  checks.push('Independent B client, exact B callback, state and PKCE, basic identity scopes only');
  const forged = await call('/api/callback?code=not-a-real-google-code&state=forged');
  assert.equal(forged.status, 302);
  assert.equal(forged.headers.get('location'), '/login?error=google_login_failed');
  const denied = await call('/api/callback?error=access_denied');
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.get('location'), '/login?error=google_login_failed');
  assert.equal((await call('/api/auth/user')).status, 401);
  assert.deepEqual(await counts(), before);
  checks.push('Forged and cancelled callbacks cannot create accounts or login sessions');
  const evidence = path.join(root, 'artifacts/railway-staging');
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(evidence, 'google-verification.json'), JSON.stringify({
    at: new Date().toISOString(), origin: target.origin, checks, productionDeployment,
    realGoogleConsentVerified: false,
  }, null, 2), { mode: 0o600 });
  console.log({ checks, realGoogleConsentVerified: false });
} finally { await client.end(); }
