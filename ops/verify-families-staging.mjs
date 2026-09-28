import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

// B-only disposable identity; never impersonate a member or exercise their private data.
const { app, productionDeployment } = inspectStaging();
const id = randomUUID(), authId = randomUUID(), group = randomUUID();
const email = `family-acceptance-${id}@example.test`, sid = `family-acceptance-${randomUUID()}`;
const expires = new Date(Date.now() + 30 * 60 * 1000);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const output = path.join(root, 'output/playwright/families-b', id);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(output, 'fixture-ids.json'), JSON.stringify({ id, authId, group }), { mode: 0o600 });
const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' },
  passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try {
  stagingSql(`BEGIN;
    INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(id)},${sql(email)},'!disabled-fixture','小家驗收帳號','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(authId)},${sql(email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(id)},'member');
    INSERT INTO small_groups(id,name,church,leader_user_id,meeting,announcement) VALUES(${sql(group)},'小家操作驗收','IM 行動教會',${sql(id)},'週五晚上','一起讀經、禱告');
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(sid)},${sql(JSON.stringify(session))},${sql(expires.toISOString())});
    COMMIT;`);
  execFileSync(cli, ['-s=families-b', 'open', target.origin], { cwd: root, stdio: 'pipe', timeout: 60000 });
  const script = `async page => {
    const origin=${JSON.stringify(target.origin)}, group=${JSON.stringify(group)};
    const access=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(access.status()!==303) throw Error('B gate rejected');
    await page.context().addCookies([{name:'connect.sid',value:${JSON.stringify(encodeURIComponent(`s:${sid}.${signature}`))},url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
    const me=await page.context().request.get(origin+'/api/auth/user');
    if(me.status()!==200||(await me.json()).legacyUserId!==${JSON.stringify(id)}) throw Error('Fixture identity mismatch');
    const checks=[];
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      for(const [label,route,heading] of [['entry','/groups','加入小家'],['feed','/groups/'+group,'小家操作驗收'],['management','/groups?manage=1','小家管理']]) {
        await page.goto(origin+route); await page.getByRole('heading',{name:heading,exact:true}).first().waitFor();
        await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
        if(await page.getByRole('alert').count()) throw Error('Unexpected page error');
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Horizontal overflow');
        await page.screenshot({path:${JSON.stringify(output)}+'/'+width+'-'+label+'.png',fullPage:true});
        checks.push({width,view:label,passed:true});
      }
    }
    const api=origin+'/api/life-groups';
    for(const route of ['/directory','/matching','/management','/management/'+group,'/'+group+'/shares?kind=all']) {
      if((await page.context().request.get(api+route)).status()!==200) throw Error('Family endpoint failed: '+route);
    }
    const post=await page.context().request.put(api+'/'+group+'/shares/'+${JSON.stringify(randomUUID())},{headers:{Origin:origin},data:{kind:'message',title:'驗收留言',body:'這是即將移除的測試內容',consent:true}});
    if(post.status()!==200) throw Error('Message write failed');
    const invite=await page.context().request.post(api+'/'+group+'/invite',{headers:{Origin:origin},data:{}});
    if(invite.status()!==200||!(await invite.json()).code) throw Error('Short invitation failed');
    const matching=await page.context().request.post(api+'/matching',{headers:{Origin:origin},data:{church:'IM 行動教會',availability:'週五',contact:'測試資料',consent:true}});
    if(matching.status()!==201) throw Error('Matching write failed');
    await page.goto(origin+'/groups/'+group);
    await page.getByText('驗收留言',{exact:true}).waitFor();
    return {checks,fixtureSession:true,googleOAuthTested:false,apiReads:5,messageSaved:true,shortInvite:true,matchingSaved:true};
  }`;
  let raw;
  try { raw = execFileSync(cli, ['-s=families-b', 'run-code', script], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 }); }
  catch (error) {
    const text = String(error.stdout || '') + String(error.stderr || '');
    const diagnostic = text.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (diagnostic && ![app.SESSION_SECRET, app.STAGING_ACCESS_CODE, sid, signature].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('B family browser failed; credential-bearing output withheld');
  }
  const result = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) throw new Error('B family browser did not return acceptance evidence; output withheld');
  evidence = JSON.parse(result);
} finally {
  try { execFileSync(cli, ['-s=families-b', 'close'], { cwd: root, stdio: 'pipe', timeout: 30000 }); } catch { /* Cleanup database even after a browser failure. */ }
  stagingSql(`BEGIN;
    DELETE FROM auth_sessions WHERE sid=${sql(sid)};
    DELETE FROM family_matching_requests WHERE user_id=${sql(id)};
    DELETE FROM life_group_invites WHERE group_id=${sql(group)};
    DELETE FROM life_group_shares WHERE group_id=${sql(group)};
    DELETE FROM family_membership_events WHERE group_id=${sql(group)};
    DELETE FROM small_groups WHERE id=${sql(group)} AND leader_user_id=${sql(id)};
    DELETE FROM user_roles WHERE user_id=${sql(id)};
    DELETE FROM users WHERE id=${sql(id)} AND email=${sql(email)};
    DELETE FROM auth_users WHERE id=${sql(authId)} AND email=${sql(email)};
    COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id=${sql(id)}`), '0');
}
assert.equal(inspectStaging().productionDeployment, productionDeployment, 'A deployment changed');
evidence = { ...evidence, fixtureRemoved: true, productionUnchanged: true, at: new Date().toISOString() };
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
