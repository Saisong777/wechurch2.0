import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state = inspectStaging();
const controlled = state.app.STAGING_CONTROLLED_EMAIL_ENABLED === '1' && state.app.DISABLE_OUTBOUND_EMAIL === '0';
const id = randomUUID(), authId = randomUUID(), sid = `email-ui-${randomUUID()}`, email = `email-ui-${id}@example.test`;
const output = path.join(root, 'output/playwright/email', randomUUID());
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const expires = new Date(Date.now() + 1800000);
const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
const cookie = encodeURIComponent(`s:${sid}.${createHmac('sha256', state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')}`);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const wrapper = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
const cli = (...args) => execFileSync(wrapper, ['-s=email-acceptance', ...args], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
let result;
async function journey(page, { origin, code, cookie, id, email, output, controlled }) {
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const gate = await page.context().request.post(origin + '/__staging/access', { headers: { Origin: origin }, data: { code }, maxRedirects: 0 });
  if (gate.status() !== 303) throw Error('B gate failed');
  await page.context().addCookies([{ name: 'connect.sid', value: cookie, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const me = await page.context().request.get(origin + '/api/auth/user');
  if (me.status() !== 200 || (await me.json()).legacyUserId !== id) throw Error('Fixture identity mismatch');
  const status = await (await page.context().request.get(origin + '/api/email-provider-status')).json();
  if (status.canSend !== controlled) throw Error('B email policy mismatch');
  if (controlled && !status.remindersEnabled) throw Error('B reminder scheduler not enabled');
  // Live acceptance must never deliver to real users or to the synthetic fixture.
  const preview = await page.context().request.get(origin + '/api/daily-follow-email/preview');
  const data = await preview.json();
  if (preview.status() !== 200 || !data.text.includes(origin + '/me') || data.html.includes('https://wechurch.online')) throw Error('Preview or B origin incorrect');
  const blocked = await page.context().request.post(origin + '/api/send-bulk-email', { headers: { Origin: origin }, data: { requestId: 'b14c3cd4-2e44-4a59-bc48-13b467683890', recipients: [{ email: 'not-a-wechurch-member@example.test' }], subject: 'Acceptance only', body: 'Never send' } });
  if (blocked.status() !== 403) throw Error('Unscoped recipient was not blocked');
  checks.push({ livePreview: true, controlledMail: controlled, unscopedRecipientBlocked: true, correctOrigin: true });
  // Screenshots use only fixture recipient data, not the real member directory.
  await page.route('**/api/admin/users-for-email', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id, email: 'fixture@example.test', displayName: '郵件驗收', role: 'admin', church: 'IM 行動教會' }]) }));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/me');
    await page.getByRole('button', { name: controlled ? '寄一封給自己' : '預覽提醒信', exact: true }).waitFor();
    const reminder = page.getByRole('switch', { name: '每日 Email 提醒', exact: true });
    if (await reminder.isChecked()) throw Error('Reminder enabled without consent');
    await page.getByLabel('寄送時間', { exact: true }).waitFor();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Personal mail horizontal overflow ' + width);
    await page.screenshot({ path: output + '/personal-' + width + '.png', fullPage: true });
    await page.goto(origin + '/admin');
    await page.getByTestId('button-mail-system').click();
    await page.getByTestId('text-recipient-count').waitFor();
    if (!(await page.getByTestId('text-recipient-count').innerText()).includes('0')) throw Error('Recipients preselected');
    if (!await page.getByTestId('button-send-email').isDisabled()) throw Error('Send enabled without recipients');
    await page.getByTestId('user-row-' + id).waitFor();
    await page.getByTestId('button-select-all').click();
    if (!(await page.getByTestId('text-recipient-count').innerText()).includes('1')) throw Error('Fixture recipient not selected');
    if ((await page.getByTestId('button-send-email').isDisabled()) === controlled) throw Error('Composer availability mismatch');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Composer horizontal overflow ' + width);
    await page.screenshot({ path: output + '/composer-' + width + '.png', fullPage: true });
    checks.push({ width, personalPreview: true, safeComposer: true, horizontalOverflow: false });
  }
  await page.evaluate(() => localStorage.setItem('wechurch-theme', 'dark'));
  await page.goto(origin + '/me');
  await page.getByRole('button', { name: controlled ? '寄一封給自己' : '預覽提醒信', exact: true }).waitFor();
  await page.screenshot({ path: output + '/personal-dark.png', fullPage: true });
  await page.goto(origin + '/admin');
  await page.getByTestId('button-mail-system').click();
  await page.getByTestId('user-row-' + id).waitFor();
  await page.screenshot({ path: output + '/composer-dark.png', fullPage: true });
  if (errors.length) throw Error('Browser errors encountered');
  return { checks, errors, actualEmailsSent: 0, physicalPhoneTested: false };
}
try {
  stagingSql(`BEGIN;
    INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(id)},${sql(email)},'!disabled-fixture','郵件驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(authId)},${sql(email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(id)},'pastor');
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(sid)},${sql(JSON.stringify(session))},${sql(expires.toISOString())}); COMMIT;`);
  cli('open', 'about:blank'); cli('snapshot');
  const config = { origin: target.origin, code: state.app.STAGING_ACCESS_CODE, cookie, id, email, output, controlled };
  const raw = cli('run-code', `async page => (${journey.toString()})(page,${JSON.stringify(config)})`);
  const serialized = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!serialized) {
    const diagnostic = raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (diagnostic && ![cookie, state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw Error('Browser verification failed; credential-bearing output withheld');
  }
  result = JSON.parse(serialized);
} catch (error) {
  if (error instanceof Error && 'stdout' in error) throw Error('Browser command failed; credential-bearing output withheld');
  throw error;
} finally {
  try { cli('close'); } catch { /* Remove the isolated fixture even if browser cleanup fails. */ }
  stagingSql(`BEGIN; DELETE FROM auth_sessions WHERE sid=${sql(sid)}; DELETE FROM user_email_preferences WHERE user_id=${sql(id)}; DELETE FROM user_roles WHERE user_id=${sql(id)}; DELETE FROM users WHERE id=${sql(id)} AND email=${sql(email)}; DELETE FROM auth_users WHERE id=${sql(authId)}; COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id=${sql(id)}`), '0');
}
assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ ...result, fixtureRemoved: true, productionUnchanged: true, at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ output, ...result, fixtureRemoved: true, productionUnchanged: true }));
