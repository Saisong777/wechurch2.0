import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const { app, productionDeployment } = inspectStaging();
const output = path.join(root, 'output/playwright/product-audit', randomUUID());
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const people = ['member', 'senior_pastor', 'admin'].map(role => {
  const id = randomUUID(), authId = randomUUID(), sid = 'product-audit-' + randomUUID(), email = `product-audit-${id}@example.test`;
  const expires = new Date(Date.now() + 1800000);
  const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
  const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { id, authId, sid, email, role, session, expires, cookie: encodeURIComponent(`s:${sid}.${signature}`) };
});
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const ids = people.map(p => sql(p.id)).join(',');
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try {
  stagingSql('BEGIN;\n' + people.map(p => `INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(p.id)},${sql(p.email)},'!disabled-fixture','網站驗收','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(p.authId)},${sql(p.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(p.id)},${sql(p.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(p.sid)},${sql(JSON.stringify(p.session))},${sql(p.expires.toISOString())});`).join('\n') + '\nCOMMIT;');
  execFileSync(cli, ['-s=product-audit', 'open', target.origin], { cwd: root, stdio: 'pipe', timeout: 60000 });
  const script = `async page => {
    const origin=${JSON.stringify(target.origin)}, output=${JSON.stringify(output)}, people=${JSON.stringify(people.map(p => ({ id: p.id, cookie: p.cookie })))};
    const gate=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(gate.status()!==303)throw Error('B gate failed');
    async function login(index,route) {
      await page.context().clearCookies({name:'connect.sid'});
      await page.context().addCookies([{name:'connect.sid',value:people[index].cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
      await page.goto(origin+route);
      const me=await page.context().request.get(origin+'/api/auth/user');
      if(me.status()!==200||(await me.json()).legacyUserId!==people[index].id)throw Error('Fixture identity mismatch');
    }
    const checks=[], errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    const memberRoutes=['/','/learn','/learn/church-reading','/learn/bible','/learn/my-notes','/learn/reading-plans','/grace-record','/share','/walls','/prayer-wall','/devotion-wall','/groups','/care','/me','/me/activity','/me/sharing','/me/love-journey','/me/mentoring','/support','/play','/icebreaker','/grouper','/play/bible-quiz','/play/disciple-quiz','/card','/user','/user/notebook','/notebook','/learn/jesus-timeline','/prayer-meeting'];
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      for(const [index,routes] of [[0,memberRoutes],[2,['/admin','/admin/crm','/admin/church-devotions','/work/settings']]]) {
        await login(index,routes[0]);
        for(const route of routes) {
          await page.goto(origin+route,{waitUntil:'domcontentloaded'});
          await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
          const metrics=await page.evaluate(()=>{
            const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
            return {reached:location.pathname,overflow:document.documentElement.scrollWidth>innerWidth+1,
              headings:[...document.querySelectorAll('h1,h2')].filter(visible).slice(0,8).map(e=>e.textContent.trim().slice(0,60)),
              brokenImages:[...document.images].filter(e=>visible(e)&&e.complete&&!e.naturalWidth).length,
              smallTargets:[...document.querySelectorAll('button,a,input,[role=tab]')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<24}).slice(0,12).map(e=>(e.getAttribute('aria-label')||e.textContent).trim().slice(0,40)),
              mainCount:[...document.querySelectorAll('main')].filter(visible).length};
          });
          const file=output+'/'+(route.slice(1).replaceAll('/','-')||'home')+'-'+width+'.png';
          await page.screenshot({path:file,animations:'disabled'});
          checks.push({route,width,role:index===0?'member':'admin',file,...metrics});
        }
      }
      await login(1,'/admin'); await page.getByTestId('button-crm').waitFor();
      for(const id of ['button-inbox','button-mail-system','button-feature-toggles','button-message-cards'])if(await page.getByTestId(id).count())throw Error('Senior pastor sees global admin tool');
      if(await page.getByText('系統紀錄',{exact:true}).count())throw Error('Senior pastor sees admin telemetry');
      await page.getByTestId('button-church-devotions').waitFor();
      await login(0,'/learn/my-notes');
      await page.route('**/api/devotional-notes',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"fixture unavailable"}'}));
      await page.reload();
      await page.getByRole('button',{name:'重新載入筆記'}).waitFor();
      if(await page.getByText('尚無經文感動',{exact:true}).count())throw Error('Failed load presented as empty');
      await page.screenshot({path:output+'/notes-error-'+width+'.png',animations:'disabled'});
      await page.unroute('**/api/devotional-notes');
      await page.getByRole('button',{name:'重新載入筆記'}).click();
      await page.getByText('尚無經文感動',{exact:true}).waitFor();
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','dark'));
      await page.reload();await page.getByText('尚無經文感動',{exact:true}).waitFor();
      await page.screenshot({path:output+'/notes-dark-'+width+'.png',animations:'disabled'});
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','light'));
    }
    return {checks,errors,roleChecks:true,notesFailureAndRetry:true,physicalPhoneTested:false,formsSubmitted:false};
  }`;
  let raw;
  try { raw=execFileSync(cli,['-s=product-audit','run-code',script],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:8*1024*1024}); }
  catch { throw new Error('Browser audit failed; credential-bearing output withheld'); }
  const result=raw.split('### Result\n')[1]?.split('\n###')[0];
  if(!result) {
    const diagnostic=raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1000);
    if(diagnostic && ![app.SESSION_SECRET,app.STAGING_ACCESS_CODE,...people.map(p=>p.cookie)].some(v=>diagnostic.includes(v)))console.error(diagnostic);
    throw new Error('Missing browser evidence');
  }
  evidence=JSON.parse(result);
} finally {
  try {execFileSync(cli,['-s=product-audit','close'],{cwd:root,stdio:'pipe',timeout:30000});}catch{ /* Cleanup still required. */ }
  stagingSql(`BEGIN; DELETE FROM auth_sessions WHERE sid IN (${people.map(p=>sql(p.sid)).join(',')}); DELETE FROM user_roles WHERE user_id IN (${ids}); DELETE FROM users WHERE id IN (${ids}); DELETE FROM auth_users WHERE id IN (${people.map(p=>sql(p.authId)).join(',')}); COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN (${ids})`),'0');
}
assert.equal(inspectStaging().productionDeployment,productionDeployment);
evidence={...evidence,fixtureRemoved:true,productionUnchanged:true,at:new Date().toISOString()};
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({output,captures:evidence.checks.length,errors:evidence.errors,overflow:evidence.checks.filter(c=>c.overflow).map(c=>({route:c.route,width:c.width})),brokenImages:evidence.checks.filter(c=>c.brokenImages),fixtureRemoved:true,productionUnchanged:true,physicalPhoneTested:false}));
