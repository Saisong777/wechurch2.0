import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const { app, productionDeployment } = inspectStaging();
const id = randomUUID(), authId = randomUUID(), group = randomUUID();
const email = `prayer-acceptance-${id}@example.test`, sid = `prayer-acceptance-${randomUUID()}`;
const expires = new Date(Date.now() + 30 * 60 * 1000);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const output = path.join(root, 'output/playwright/prayers-b', id);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const session = { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), secure: true, httpOnly: true, path: '/', sameSite: 'lax' },
  passport: { user: { claims: { sub: authId, email }, sessionUserId: id, sessionVersion: 0, expires_at: Math.floor(expires.getTime() / 1000) } } };
const signature = createHmac('sha256', app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
const cli = path.join(process.env.HOME, '.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try {
  stagingSql(`BEGIN;
    INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(id)},${sql(email)},'!disabled-fixture','禱告驗收帳號','IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(authId)},${sql(email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(id)},'member');
    INSERT INTO small_groups(id,name,church,leader_user_id) VALUES(${sql(group)},'禱告驗收小家','IM 行動教會',${sql(id)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(sid)},${sql(JSON.stringify(session))},${sql(expires.toISOString())});
    COMMIT;`);
  execFileSync(cli, ['-s=prayers-b', 'open', target.origin], { cwd: root, stdio: 'pipe', timeout: 60000 });
  const script = `async page => {
    const origin=${JSON.stringify(target.origin)}, group=${JSON.stringify(group)}, output=${JSON.stringify(output)};
    const access=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(access.status()!==303) throw Error('B gate rejected');
    await page.context().addCookies([{name:'connect.sid',value:${JSON.stringify(encodeURIComponent(`s:${sid}.${signature}`))},url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
    const me=await page.context().request.get(origin+'/api/auth/user');
    if(me.status()!==200||(await me.json()).legacyUserId!==${JSON.stringify(id)}) throw Error('Fixture identity mismatch');
    const checks=[];
    async function screenshot(name) {
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Horizontal overflow: '+name);
      await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
    }
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      const title='禱告操作驗收 '+width, shared='只分享這段代禱 '+width;
      await page.goto(origin+'/grace-record?new=1');
      await page.getByLabel('標題',{exact:true}).fill(title);
      await page.getByLabel('禱告內容',{exact:true}).fill('私人原稿不公開');
      await page.getByRole('button',{name:'開始禱告',exact:true}).click();
      const row=page.getByRole('article',{name:'個人禱告：'+title,exact:true});
      await row.waitFor();
      await row.getByRole('button',{name:'編輯',exact:true}).click();
      await row.getByLabel('私人禱告內容').fill('更新的私人原稿不公開');
      await screenshot(width+'-inline-edit');
      if(await page.getByRole('dialog').count()) throw Error('Editor must remain inline');
      await row.getByRole('button',{name:'儲存修改'}).click();
      await row.getByRole('button',{name:'記錄',exact:true}).click();
      await row.getByLabel('近況與恩典回應（僅自己可見）').fill('持續等候的私人近況');
      await row.getByRole('button',{name:'儲存進展'}).click();
      await row.getByText('等候中',{exact:true}).waitFor();
      await row.getByRole('button',{name:'記錄',exact:true}).waitFor();
      await row.getByRole('checkbox',{name:'選取 '+title}).check();
      await page.getByRole('button',{name:'分享選取的禱告',exact:true}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('combobox',{name:'分享至小家'}).selectOption(group);
      await dialog.getByRole('checkbox',{name:/分享到公共禱告牆/}).check();
      await dialog.getByRole('checkbox',{name:'匿名分享',exact:true}).check();
      await dialog.getByRole('checkbox',{name:'標記為緊急代禱'}).check();
      await dialog.getByRole('textbox',{name:'第 1 筆分享內容'}).fill(shared);
      await dialog.getByRole('checkbox',{name:/我確認將以上內容/}).check();
      await screenshot(width+'-share-preview');
      await dialog.getByRole('button',{name:'確認分享'}).click();
      await dialog.waitFor({state:'hidden'});
      await page.goto(origin+'/prayer-wall');
      await page.getByRole('searchbox',{name:'搜尋禱告牆'}).fill(shared);
      const wall=page.getByRole('article',{name:'代禱：'+title,exact:true});
      await wall.getByText('緊急代禱',{exact:true}).waitFor();
      await wall.getByText('匿名',{exact:true}).waitFor();
      if((await wall.innerText()).includes('私人')) throw Error('Private text leaked');
      await wall.getByRole('button',{name:/鼓勵與禱告/}).click();
      await wall.getByRole('textbox',{name:'回應內容'}).fill('一起守望');
      await wall.getByRole('button',{name:'送出回應'}).click();
      await wall.getByText('一起守望',{exact:true}).waitFor();
      await screenshot(width+'-wall');
      const copies=await (await page.context().request.get(origin+'/api/life-groups/'+group+'/shares?kind=prayer')).json();
      if(!copies.some(copy=>copy.body===shared&&copy.anonymous)) throw Error('Family prayer share missing');
      await page.goto(origin+'/grace-record');
      await page.getByRole('searchbox').fill(title);
      await row.getByRole('button',{name:'記錄',exact:true}).click();
      await row.getByRole('combobox',{name:'這次的進展'}).selectOption('grace');
      await row.getByLabel('近況與恩典回應（僅自己可見）').fill('蒙應允的私人紀錄');
      await row.getByRole('checkbox',{name:/同時結束禱告牆/}).check();
      await row.getByRole('button',{name:'儲存進展'}).click();
      await row.waitFor({state:'hidden'});
      await page.getByRole('button',{name:'恩典紀錄',exact:true}).click();
      await row.getByRole('button',{name:'閱讀全文與歷程'}).click();
      await row.getByText(/持續等候的私人近況/).waitFor();
      await row.getByText(/蒙應允的私人紀錄/).waitFor();
      await screenshot(width+'-history');
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','dark'));
      await page.reload();
      await page.getByRole('button',{name:'恩典紀錄',exact:true}).click();
      await row.getByRole('button',{name:'閱讀全文與歷程'}).click();
      if(!await page.locator('html').evaluate(el=>el.classList.contains('dark'))) throw Error('Dark mode absent');
      await screenshot(width+'-dark-history');
      await page.evaluate(()=>localStorage.setItem('wechurch-theme','light'));
      const feed=await (await page.context().request.get(origin+'/api/prayers')).json();
      if(feed.some(p=>p.content.includes(title))) throw Error('Completed prayer still public');
      const mine=await (await page.context().request.get(origin+'/api/prayers?view=my')).json();
      const finished=mine.find(p=>p.content.includes(title));
      if(!finished?.isAnswered||finished.commentCount!==1) throw Error('Closed record lost');
      checks.push({width,inline:true,progress:true,anonymousFamily:true,urgentPublic:true,comment:true,close:true,history:true,dark:true});
    }
    return {checks,fixtureSession:true,googleOAuthTested:false,physicalPhoneTested:false};
  }`;
  let raw;
  try { raw = execFileSync(cli, ['-s=prayers-b', 'run-code', script], { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 }); }
  catch (error) {
    const text = String(error.stdout || '') + String(error.stderr || '');
    const diagnostic = text.split('### Error\n')[1]?.split('\n###')[0]?.slice(0, 1000);
    if (diagnostic && ![app.SESSION_SECRET, app.STAGING_ACCESS_CODE, sid, signature].some(value => diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('B prayer browser failed; credential-bearing output withheld');
  }
  const result = raw.split('### Result\n')[1]?.split('\n###')[0];
  if (!result) {
    const diagnostic=raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1000);
    if(diagnostic && ![app.SESSION_SECRET,app.STAGING_ACCESS_CODE,sid,signature].some(value=>diagnostic.includes(value))) console.error(diagnostic);
    throw new Error('B prayer browser did not return acceptance evidence; output withheld');
  }
  evidence = JSON.parse(result);
} finally {
  try { execFileSync(cli, ['-s=prayers-b', 'close'], { cwd: root, stdio: 'pipe', timeout: 30000 }); } catch { /* Always remove only this fixture's rows. */ }
  stagingSql(`BEGIN;
    DELETE FROM auth_sessions WHERE sid=${sql(sid)};
    DELETE FROM prayer_notifications WHERE prayer_id IN (SELECT id FROM prayers WHERE user_id=${sql(id)});
    DELETE FROM prayer_comments WHERE prayer_id IN (SELECT id FROM prayers WHERE user_id=${sql(id)});
    DELETE FROM prayer_amens WHERE prayer_id IN (SELECT id FROM prayers WHERE user_id=${sql(id)});
    DELETE FROM prayers WHERE user_id=${sql(id)};
    DELETE FROM personal_prayer_shares WHERE owner_id=${sql(id)};
    DELETE FROM personal_prayers WHERE user_id=${sql(id)};
    DELETE FROM life_group_shares WHERE group_id=${sql(group)};
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
