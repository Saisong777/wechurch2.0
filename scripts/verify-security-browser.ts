import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import { devotionDayWindow } from '../shared/devotionWall';

const execute = promisify(execFile);
const loopback = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
function disposableDatabase(value: string) {
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol) && loopback.has(url.hostname), 'Browser fixtures require localhost Postgres');
  assert.match(url.pathname, /^\/wechurch_integrity_[a-f0-9]{32}$/, 'Browser fixtures require a disposable integrity database');
  return url.pathname.slice(1);
}

/** Optional, local-only acceptance fixture. The caller owns the HTTP server and database lifetime. */
export async function verifySecurityBrowser(pool: Pool, origin: string, userId: string) {
  assert.equal(process.env.RUN_SECURITY_BROWSER, '1', 'Browser acceptance requires explicit opt-in');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.LOCAL_INSECURE_COOKIES, '1');
  assert.equal(process.env.DISABLE_OUTBOUND_EMAIL, '1');
  assert.equal(process.env.DISABLE_MORNING_BRIEF, '1');
  const target = new URL(origin);
  assert(target.protocol === 'http:' && loopback.has(target.hostname) && target.port, 'Browser acceptance requires an explicit localhost HTTP port');
  assert.equal(target.origin, origin, 'Pass an origin without credentials, path, query or fragment');
  assert.match(userId, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  const database = disposableDatabase(process.env.DATABASE_URL || '');
  if (pool.options.connectionString) assert.equal(disposableDatabase(pool.options.connectionString), database);
  if (pool.options.host) assert(loopback.has(pool.options.host), 'The supplied pool must use loopback');
  // Docker port forwarding can report a container address despite a loopback client URL.
  const actual = (await pool.query('SELECT current_database() AS name, clock_timestamp() AS now')).rows[0];
  assert.equal(actual.name, database);
  const window = devotionDayWindow(actual.now);
  assert(Date.parse(window.expiresAt) - actual.now.getTime() > 180000, 'Run browser acceptance at least three minutes before Taipei midnight');
  const member = (await pool.query(`SELECT u.id,u.email,u.session_version,a.id AS auth_id FROM users u
    JOIN auth_users a ON a.email=u.email LEFT JOIN google_account_links g ON g.auth_user_id=a.id
    WHERE u.id=$1 AND u.email LIKE '%@example.test' AND (g.user_id IS NULL OR g.user_id=u.id)`, [userId])).rows[0];
  assert(member, 'Pass an existing disposable fixture member/auth identity');
  assert(Number.isSafeInteger(member.session_version) && member.session_version >= 0);
  const secret = process.env.SESSION_SECRET;
  assert(secret && secret.length >= 32, 'The test process must supply its disposable session secret');

  const runId = randomUUID();
  const prefix = `Security browser ${runId.slice(0, 8)} `;
  const noteId = randomUUID();
  const postIds = Array.from({ length: 35 }, () => randomUUID());
  const sid = `security-local-${randomUUID()}`;
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
  const cookie = { name: 'connect.sid', value: encodeURIComponent(`s:${sid}.${signature}`), url: origin, httpOnly: true, secure: false, sameSite: 'Lax', expires: expires.getTime() / 1000 };
  const session = {
    cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
    passport: { user: { claims: { sub: member.auth_id, email: member.email }, sessionUserId: userId, sessionVersion: member.session_version, expires_at: Math.floor(expires.getTime() / 1000) } },
  };
  const directory = path.resolve('output/playwright/security', runId);
  await mkdir(directory, { recursive: true });
  const config = path.join(directory, 'cli.config.json');
  await writeFile(config, JSON.stringify({ browser: { browserName: 'chromium', isolated: true,
    launchOptions: { channel: 'chrome', headless: true, args: ['--disable-background-networking', '--dns-prefetch-disable', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] },
    contextOptions: { serviceWorkers: 'block' },
  } }));
  const wrapper = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills/playwright/scripts/playwright_cli.sh');
  // Do not forward DB/provider credentials or the signing secret to the CLI process.
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'PLAYWRIGHT_BROWSERS_PATH'].filter(key => process.env[key]).map(key => [key, process.env[key]!]));
  async function cli(...args: string[]) {
    try {
      const { stdout } = await execute(wrapper, ['--session', 'security-local', ...args], {
        env: { ...env, npm_config_offline: 'true' }, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
      });
      if (/^### Error/m.test(stdout)) {
        const detail = stdout.split('### Error')[1]?.split('\n### ')[0]?.trim().slice(0, 1200) || 'CLI reported failure';
        throw new Error(detail);
      }
      return stdout;
    } catch (error) {
      const detail = error instanceof Error ? error.message.split('\n')[0] : 'Unknown CLI failure';
      const safe = detail.includes(secret!) || detail.includes(sid) || detail.includes('connect.sid') || detail.includes('async (page)') ? 'Command failed; session data withheld' : detail;
      throw new Error(`Security browser CLI failed (${args.includes('run-code') ? 'run-code' : args[0]}): ${safe}`);
    }
  }
  async function code(source: string): Promise<Record<string, unknown>> {
    const result = await cli('--raw', 'run-code', `async (page) => { ${source} }`);
    try { return JSON.parse(result); }
    catch { throw new Error('Security browser returned an invalid result'); }
  }
  const reports: Record<string, unknown>[] = [];
  let failure: unknown;
  let opened = false;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,observation,hidden)
        VALUES($1,$2,'約翰福音 3:16','Disposable scripture fixture',$3,false)`, [noteId, userId, `PRIVATE original ${runId}`]);
      await client.query(`INSERT INTO devotion_wall_posts(id,source_note_id,user_id,published_day,title,body,reference,expires_at,created_at)
        SELECT id,CASE WHEN ordinal=1 THEN $2::uuid ELSE NULL END,$3::uuid,$4::date,$5||lpad(ordinal::text,2,'0'),
        'Disposable public excerpt '||ordinal,'約翰福音 3:16',$6::timestamptz,clock_timestamp()
        FROM unnest($1::uuid[]) WITH ORDINALITY AS fixture(id,ordinal)`, [postIds, noteId, userId, window.day, prefix, window.expiresAt]);
      await client.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,$3)', [sid, JSON.stringify(session), expires]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }

    opened = true;
    await cli('open', 'about:blank', '--config', config);
    await cli('snapshot');
    await code(`
      const origin = ${JSON.stringify(origin)};
      const context = page.context();
      const audit = page.__securityAudit = { errors: [], external: [], fontsStubbed: 0 };
      await context.clearCookies();
      await context.addCookies([${JSON.stringify(cookie)}]);
      await context.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith(origin + '/')) return route.continue();
        if (url.startsWith('https://fonts.googleapis.com/') && route.request().resourceType() === 'stylesheet') {
          audit.fontsStubbed++; return route.fulfill({status:200,contentType:'text/css',body:''});
        }
        audit.external.push(url.split('?')[0]); return route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', socket => {
        const url = socket.url();
        if (url.startsWith(origin.replace('http:', 'ws:') + '/')) socket.connectToServer();
        else { audit.external.push(url.split('?')[0]); socket.close(); }
      });
      page.on('pageerror', error => audit.errors.push('pageerror: ' + error.message));
      page.on('console', message => { if (message.type() === 'error') audit.errors.push('console: ' + message.text()); });
      page.on('response', response => { if (response.status() >= 400) audit.errors.push('HTTP ' + response.status() + ' ' + response.url().split('?')[0]); });
      page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') audit.errors.push('requestfailed: ' + request.url().split('?')[0]); });
      return {ready:true};
    `);
    const identity = await code(`
      const response = await page.context().request.get(${JSON.stringify(origin + '/api/auth/user')}, {maxRedirects:0});
      const user = await response.json();
      return {status:response.status(),memberId:user.legacyUserId};
    `);
    assert.deepEqual(identity, {status:200,memberId:userId}, 'Browser cookie must resolve to the requested fixture account');
    const anonymous = await fetch(origin + '/api/auth/user', {redirect:'error',signal:AbortSignal.timeout(10000)});
    assert.equal(anonymous.status, 401, 'Anonymous requests must not inherit the fixture session');
    await anonymous.body?.cancel();
    const routes: Array<{path:string;name:string;more?:string;redirect?:string}> = [
      { path: '/learn/church-reading', name: 'church-reading' },
      { path: '/learn/bible?book=43&chapter=3', name: 'bible' },
      { path: '/devotion-wall', name: 'wall', more: '載入更多分享' },
      { path: '/me/sharing', name: 'my-sharing', more: '載入更多靈修分享' },
      { path: '/me', name: 'profile' },
      { path: '/prayer-meeting', name: 'legacy-redirect', redirect:'/prayer-wall' },
    ];
    for (const width of [390, 1440]) {
      await cli('resize', String(width), width === 390 ? '844' : '1000');
      for (const route of routes) {
        await cli('goto', origin + route.path);
        await cli('snapshot');
        await code(`
          await page.waitForLoadState('networkidle', {timeout:15000});
          await page.locator('main').first().waitFor({state:'visible'});
          ${route.name === 'bible' ? "await page.getByRole('heading', {name:'約翰福音 3',exact:true}).waitFor({state:'visible'});" : ''}
          ${route.more ? `await page.getByRole('button', {name:${JSON.stringify(route.more)},exact:true}).waitFor({state:'visible'});` : ''}
          return {ready:true};
        `);
        await cli('snapshot');
        const before = await code(`
          const main = page.locator('main').first();
          const text = await main.innerText();
          const count = await main.getByText(new RegExp('^' + ${JSON.stringify(prefix)} + '[0-9]{2}$')).count();
          await page.screenshot({path:${JSON.stringify(path.join(directory, `${width}-${route.name}.png`))},fullPage:true});
          return { count, textLength:text.trim().length, unexpected:/頁面載入發生問題|這個頁面暫時無法載入|Unexpected Application Error|404 Not Found|請先登入/.test(text),
            ${route.name === 'bible' ? "bibleTextLength:(await main.getByRole('region',{name:'經文',exact:true}).innerText()).trim().length," : ''}
            alerts:await main.getByRole('alert').count(), rect:await main.boundingBox(),
            overflow:await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            url:page.url(), errors:[...page.__securityAudit.errors], external:[...page.__securityAudit.external] };
        `);
        assert.equal(before.url, origin + (route.redirect || route.path), `Unexpected navigation on ${route.path}`);
        if (route.name === 'bible') assert(Number(before.bibleTextLength)>100, 'Bible chapter must contain actual scripture');
        assert.equal(before.unexpected, false, `Error/login fallback on ${route.path}`);
        assert.equal(before.alerts, 0, `Alert on ${route.path}`);
        assert(Number(before.textLength) > 12 && before.rect && (before.rect as { width: number; height: number }).width > 100 && (before.rect as { height: number }).height > 40, `Blank main on ${route.path}`);
        assert.equal(before.overflow, false, `Horizontal overflow on ${width} ${route.path}`);
        assert.deepEqual(before.errors, [], `Browser errors on ${route.path}`);
        assert.deepEqual(before.external, [], `Unexpected external request on ${route.path}`);
        if (route.more) {
          assert.equal(before.count, 30, `Expected the first 30 fixture shares on ${route.path}`);
          // The preceding snapshot is fresh; use the actual, source-verified role label.
          await code(`
            await page.getByRole('button', {name:${JSON.stringify(route.more)},exact:true}).click();
            await page.waitForFunction(prefix => [...document.querySelectorAll('main h2, main p')].filter(el => el.textContent?.startsWith(prefix) && new RegExp('^' + prefix + '[0-9]{2}$').test(el.textContent || '')).length === 35, ${JSON.stringify(prefix)}, {timeout:15000});
            return {loaded:true};
          `);
          await cli('snapshot');
          const after = await code(`
            await page.screenshot({path:${JSON.stringify(path.join(directory, `${width}-${route.name}-more.png`))},fullPage:true});
            return {count:await page.locator('main').first().getByText(new RegExp('^' + ${JSON.stringify(prefix)} + '[0-9]{2}$')).count(),
              overflow:await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
              errors:[...page.__securityAudit.errors], external:[...page.__securityAudit.external]};
          `);
          assert.equal(after.count, 35); assert.equal(after.overflow, false);
          assert.deepEqual(after.errors, []); assert.deepEqual(after.external, []);
        }
        reports.push({ width, route: route.path, loadMore: Boolean(route.more), status: 'passed' });
      }
    }
    const audit = await code('return {fontsStubbed:page.__securityAudit.fontsStubbed};');
    await writeFile(path.join(directory, 'results.json'), JSON.stringify({ reports, ...audit, limitations: ['Disposable localhost fixtures only', 'External Google Fonts replaced with empty CSS for offline acceptance', '/profile is not registered; tested /me instead'] }, null, 2));
  } catch (error) { failure = error; }
  finally {
    const clean = async (work: () => Promise<unknown>) => { try { await work(); } catch { failure ||= new Error('Security browser fixture cleanup failed'); } };
    if (opened) await clean(() => cli('close'));
    await clean(() => pool.query('DELETE FROM auth_sessions WHERE sid=$1', [sid]));
    await clean(() => pool.query('DELETE FROM devotion_wall_posts WHERE id=ANY($1::uuid[]) AND user_id=$2', [postIds, userId]));
    await clean(() => pool.query('DELETE FROM devotional_notes WHERE id=$1 AND user_id=$2', [noteId, userId]));
  }
  if (failure) throw failure;
  console.log(`PASS security browser: ${reports.length} route/viewport checks; screenshots ${directory}`);
  return { reports, directory };
}
