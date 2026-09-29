import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state = inspectStaging();
const output = path.join(root, 'output/playwright/access', randomUUID());
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const expires = new Date(Date.now() + 1800000);
const fixtures = ['admin', 'member'].map(role => {
  const id = randomUUID(), authId = randomUUID(), sid = `access-ui-${randomUUID()}`, email = `access-ui-${id}@example.test`;
  const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
  const cookie = encodeURIComponent(`s:${sid}.${createHmac('sha256', state.app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')}`);
  return { id, authId, sid, email, session, cookie, role };
});
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const cli = (...args) => {
  try { return execFileSync(path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh'), ['-s=access-acceptance', ...args], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 }); }
  catch (error) {
    const output = String(error.stdout || '');
    const detail = output.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (detail && ![state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET, ...fixtures.map(f => f.cookie)].some(s => detail.includes(s))) console.error(detail);
    console.error({ browserStep: args[0], status: error.status, code: error.code });
    throw Error('Browser step failed');
  }
};
let result, phase = 'fixtures';
async function journey(page, { origin, code, fixtures, output }) {
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  // Grant creation still uses confirm. Revocation must exercise the real inline UI.
  await page.addInitScript(() => {
    window.confirm = () => true;
  });
  const [admin, member] = fixtures;
  const switchUser = async fixture => {
    await page.context().addCookies([{ name: 'connect.sid', value: fixture.cookie, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const me = await page.context().request.get(origin + '/api/auth/user');
    if (me.status() !== 200 || (await me.json()).legacyUserId !== fixture.id) throw Error('Fixture identity mismatch');
  };
  const gate = await page.context().request.post(origin + '/__staging/access', { headers: { Origin: origin }, data: { code }, maxRedirects: 0 });
  if (gate.status() !== 303) throw Error('B gate failed');
  await switchUser(admin);
  // Real API authorization is exercised; only screenshots are limited to synthetic users.
  await page.route('**/api/access-control', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.users = data.users.filter(u => fixtures.some(f => f.id === u.id));
    data.grants = data.grants.filter(g => g.userId === member.id);
    data.history = data.history.filter(h => h.actorName === '權限驗收管理員');
    data.legacyScopes = []; data.appointments = []; data.groups = [];
    await route.fulfill({ response, json: data });
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/admin/access?member=' + member.id);
    await page.getByRole('button', { name: '新增職分', exact: true }).click();
    const view = page.getByRole('checkbox', { name: '查看會員名單', exact: true });
    if (await view.isChecked()) throw Error('Permissions were implicitly selected');
    await page.getByLabel('管理範圍', { exact: true }).selectOption('member');
    await page.getByLabel('指定對象', { exact: true }).selectOption(member.id);
    await view.check();
    await page.getByLabel('異動原因', { exact: true }).fill('B 權限介面驗收');
    if (!await page.getByRole('checkbox', { name: '管理全站靈修課表', exact: true }).isDisabled()) throw Error('Site permission mixed with member scope');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Access editor horizontal overflow ' + width);
    await page.screenshot({ path: output + '/editor-' + width + '.png', fullPage: true });
    checks.push({ width, editor: true, noImplicitPermissions: true, horizontalOverflow: false });
  }
  await page.getByRole('button', { name: '儲存授權', exact: true }).click();
  await page.getByRole('button', { name: '撤回授權', exact: true }).waitFor();
  const snapshot = await (await page.context().request.get(origin + '/api/access-control')).json();
  const grants = snapshot.grants.filter(g => g.userId === member.id && g.active);
  if (grants.length !== 1 || grants[0].permissions.join() !== 'members.read' || grants[0].memberId !== member.id) throw Error('Saved permission readback mismatch');
  await page.getByRole('tab', { name: '異動紀錄' }).click();
  await page.getByText('新增授權', { exact: true }).first().waitFor();
  await page.locator('summary').first().click();
  await page.screenshot({ path: output + '/audit.png', fullPage: true });
  await switchUser(member);
  const directory = await page.context().request.get(origin + '/api/users');
  if (directory.status() !== 200) throw Error('Granted member denied');
  const rows = await directory.json();
  if (rows.length !== 1 || rows[0].id !== member.id || 'address' in rows[0] || !rows[0].ministryRoles.includes('同工')) throw Error('Member scope or title projection failed');
  if ((await page.context().request.get(origin + '/api/access-control')).status() !== 403) throw Error('Delegated user could grant authority');
  await page.goto(origin + '/admin');
  await page.getByTestId('button-crm').waitFor();
  if ((await page.getByTestId('admin-role-label').textContent()) !== '同工') throw Error('Delegated ministry title is incorrect in the admin header');
  await page.screenshot({ path: output + '/coworker-admin.png', fullPage: true });
  await switchUser(admin);
  const second = await page.context().request.post(origin + '/api/access-control/grants', { data: {
    userId: member.id, roleId: grants[0].roleId, permissions: ['members.read'], scope: 'member',
    church: snapshot.church, groupId: null, memberId: member.id, expiresAt: null, reason: '重疊授權撤回驗收',
  } });
  if (!second.ok()) throw Error('Second fixture grant failed');
  for (const width of [320, 390, 1440]) {
    await page.evaluate(theme => localStorage.setItem('wechurch-theme', theme), width === 390 ? 'dark' : 'light');
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/admin/access?member=' + member.id);
    await page.getByRole('button', { name: '撤回授權', exact: true }).first().click();
    const form = page.getByRole('form', { name: '撤回授權確認' });
    await form.waitFor();
    if (await form.getByLabel('撤回原因', { exact: true }).inputValue() !== '職務調整') throw Error('Missing visible default reason');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Revocation horizontal overflow ' + width);
    await page.screenshot({ path: output + '/revoke-' + width + '.png', fullPage: true });
    await form.getByRole('button', { name: '取消', exact: true }).click();
    const cancelled = await (await page.context().request.get(origin + '/api/access-control')).json();
    if (cancelled.grants.filter(g => g.userId === member.id && g.active).length !== 2) throw Error('Cancel mutated grants');
    checks.push({ width, inlineRevocation: true, cancelWithoutMutation: true, horizontalOverflow: false });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => localStorage.setItem('wechurch-theme', 'dark'));
  await page.goto(origin + '/admin/access?member=' + member.id);
  await page.getByRole('button', { name: '撤回授權', exact: true }).first().click();
  const revokeForm = page.getByRole('form', { name: '撤回授權確認' });
  await revokeForm.getByLabel('撤回原因', { exact: true }).fill('撤回其中一筆測試授權');
  await page.route('**/api/access-control/grants/*', async route => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 503, json: { error: '測試連線中斷，請再試一次' } });
      await page.unroute('**/api/access-control/grants/*');
    } else await route.continue();
  });
  await revokeForm.getByRole('button', { name: '確認撤回', exact: true }).click();
  await revokeForm.getByRole('alert').getByText('測試連線中斷，請再試一次', { exact: true }).waitFor();
  if (await revokeForm.getByLabel('撤回原因', { exact: true }).inputValue() !== '撤回其中一筆測試授權') throw Error('Retry lost reason');
  await page.screenshot({ path: output + '/revoke-error-390.png', fullPage: true });
  await revokeForm.getByRole('button', { name: '確認撤回', exact: true }).click();
  await page.getByText('已撤回', { exact: true }).waitFor();
  const remaining = await (await page.context().request.get(origin + '/api/access-control')).json();
  if (remaining.grants.filter(g => g.userId === member.id && g.active).length !== 1) throw Error('Other grant was changed');
  await switchUser(member);
  if ((await page.context().request.get(origin + '/api/users')).status() !== 200) throw Error('Overlapping permission was lost');
  await switchUser(admin);
  await page.goto(origin + '/admin/access?member=' + member.id);
  await page.getByRole('button', { name: '撤回授權', exact: true }).click();
  await page.getByRole('form', { name: '撤回授權確認' }).getByRole('button', { name: '確認撤回', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('article h3 span')].filter(e => e.textContent === '已撤回').length === 2);
  await switchUser(member);
  if ((await page.context().request.get(origin + '/api/users')).status() !== 403) throw Error('Revocation did not take effect');
  const access = await (await page.context().request.get(origin + '/api/access-control/me')).json();
  if (access.permissions.length || access.canEnterAdmin) throw Error('Revoked permission remains active');
  if (errors.length) throw Error('Browser errors encountered');
  return { checks, liveGrantAndRevoke: true, otherGrantPreserved: true, inlineFailureAndRetry: true, scopedDirectory: true, coworkerTitle: true, audit: true, darkMode: true, errors, actualEmailsSent: 0, physicalPhoneTested: false };
}
try {
  stagingSql('BEGIN;\n' + fixtures.map(f => `
    INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(f.id)},${sql(f.email)},'!disabled-fixture',${sql(f.role === 'admin' ? '權限驗收管理員' : '權限驗收同工')},'IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(f.authId)},${sql(f.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(f.id)},${sql(f.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(f.sid)},${sql(JSON.stringify(f.session))},${sql(expires.toISOString())});`).join('\n') + '\nCOMMIT;');
  phase = 'browser'; cli('open', 'about:blank'); cli('snapshot');
  const config = { origin: target.origin, code: state.app.STAGING_ACCESS_CODE, fixtures: fixtures.map(({id,cookie}) => ({id,cookie})), output };
  phase = 'journey'; const raw = cli('run-code', `async page => (${journey.toString()})(page,${JSON.stringify(config)})`);
  let diagnostic = raw.replaceAll(JSON.stringify(config), '[test configuration withheld]');
  for (const secret of [state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET, ...fixtures.map(f => f.cookie)]) {
    if (secret) diagnostic = diagnostic.replaceAll(secret, '[redacted]');
  }
  fs.writeFileSync(path.join(output, 'browser-output.txt'), diagnostic, { mode: 0o600 });
  const serialized = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!serialized) {
    const message = raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (message && ![state.app.STAGING_ACCESS_CODE, state.app.SESSION_SECRET, ...fixtures.map(f => f.cookie)].some(s => message.includes(s))) console.error(message);
    throw Error('Access browser verification failed; sensitive output withheld');
  }
  phase = 'result'; result = JSON.parse(serialized);
} catch (error) {
  console.error({ phase, errorType: error.name, detail: phase === 'fixtures' ? 'Fixture SQL failed' : undefined });
  throw Error('Access acceptance failed; fixture cleanup attempted and sensitive command output withheld');
} finally {
  try { cli('close'); } catch { /* Cleanup synthetic records even if the browser closes early. */ }
  const ids = fixtures.map(f => sql(f.id)).join(',');
  stagingSql(`BEGIN; DELETE FROM access_audit WHERE actor_id IN(${ids}); DELETE FROM access_grants WHERE user_id IN(${ids});
    DELETE FROM auth_sessions WHERE sid IN(${fixtures.map(f => sql(f.sid)).join(',')});
    DELETE FROM user_roles WHERE user_id IN(${ids}); DELETE FROM users WHERE id IN(${ids}) AND email LIKE 'access-ui-%@example.test';
    DELETE FROM auth_users WHERE id IN(${fixtures.map(f => sql(f.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN(${ids})`), '0');
}
assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ ...result, fixturesRemoved: true, productionUnchanged: true, at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ output, ...result, fixturesRemoved: true, productionUnchanged: true }));
