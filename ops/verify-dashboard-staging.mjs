import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

// Synthetic identities only. Never impersonate a member or copy real pastoral records.
const { app, productionDeployment } = inspectStaging();
const run=randomUUID(), group=randomUUID(), care=randomUUID(), prayer=randomUUID();
const output=path.join(root,'output/playwright/leader-dashboard',run);
fs.mkdirSync(output,{recursive:true,mode:0o700});
const people=['group_leader','member','admin'].map((role,index)=>{
  const id=randomUUID(),authId=randomUUID(),sid='dashboard-test-'+randomUUID(),email=`dashboard-test-${id}@example.test`;
  const expires=new Date(Date.now()+1800000);
  const session={cookie:{originalMaxAge:1800000,expires:expires.toISOString(),secure:true,httpOnly:true,path:'/',sameSite:'lax'},passport:{user:{claims:{sub:authId,email},sessionUserId:id,sessionVersion:0,expires_at:Math.floor(expires.getTime()/1000)}}};
  const signature=createHmac('sha256',app.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/,'');
  return {id,authId,sid,email,expires,session,role,name:['示範領袖','示範成員','示範管理者'][index],cookie:encodeURIComponent(`s:${sid}.${signature}`)};
});
const sql=v=>`'${String(v).replaceAll("'","''")}'`;
const cli=path.join(process.env.HOME,'.codex/skills/playwright/scripts/playwright_cli.sh');
let evidence;
try{
  stagingSql('BEGIN;\n'+people.map(p=>`INSERT INTO users(id,email,password,display_name,church) VALUES(${sql(p.id)},${sql(p.email)},'!disabled-test',${sql(p.name)},'IM 行動教會');
    INSERT INTO auth_users(id,email) VALUES(${sql(p.authId)},${sql(p.email)});
    INSERT INTO user_roles(user_id,role) VALUES(${sql(p.id)},${sql(p.role)});
    INSERT INTO auth_sessions(sid,sess,expire) VALUES(${sql(p.sid)},${sql(JSON.stringify(p.session))},${sql(p.expires.toISOString())});`).join('\n')+`
    INSERT INTO small_groups(id,name,church,leader_user_id) VALUES(${sql(group)},'恩典小家（示範）','IM 行動教會',${sql(people[0].id)});
    INSERT INTO small_group_members(group_id,user_id) VALUES(${sql(group)},${sql(people[1].id)});
    INSERT INTO life_group_care(id,group_id,creator_id,name,need,next_action,status,due_date) VALUES(${sql(care)},${sql(group)},${sql(people[0].id)},'小明（示範）','最近換了工作，想有人一起聊聊。','關心新工作的適應','following',(now() AT TIME ZONE 'Asia/Taipei')::date);
    INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,is_anonymous) VALUES(${sql(prayer)},${sql(group)},${sql(people[0].id)},'prayer','為新工作代禱（示範）','求有平安與智慧，適應新的工作環境。',true);
    COMMIT;`);
  execFileSync(cli,['-s=leader-dashboard-b','open',target.origin],{cwd:root,stdio:'pipe',timeout:60000});
  const script=`async page=>{
    const origin=${JSON.stringify(target.origin)},output=${JSON.stringify(output)},group=${JSON.stringify(group)},people=${JSON.stringify(people.map(p=>({id:p.id,cookie:p.cookie})))};
    const gate=await page.context().request.post(origin+'/__staging/access',{headers:{Origin:origin},data:{code:${JSON.stringify(app.STAGING_ACCESS_CODE)}},maxRedirects:0});
    if(gate.status()!==303)throw Error('B gate failed');
    async function login(index){await page.context().addCookies([{name:'connect.sid',value:people[index].cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);await page.goto(origin+'/work');const r=await page.context().request.get(origin+'/api/auth/user');if(r.status()!==200||(await r.json()).legacyUserId!==people[index].id)throw Error('Fixture identity mismatch');}
    await login(0);
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('heading',{name:'牧養概況',exact:true}).waitFor();
    await page.getByRole('button',{name:'查看與記錄出席',exact:true}).click();
    await page.getByRole('button',{name:'新增聚會記錄',exact:true}).click();
    await page.getByLabel('選取這份名單全部成員',{exact:true}).check();
    await page.getByRole('button',{name:'建立並記錄出席（2 人）',exact:true}).click();
    await page.getByRole('heading',{name:'記錄聚會出席',exact:true}).waitFor();
    await page.getByRole('group',{name:'示範成員的出席狀態',exact:true}).getByRole('button',{name:'出席',exact:true}).click();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Attendance editor overflow');
    await page.screenshot({path:output+'/390-attendance.png',fullPage:true});
    await page.getByRole('button',{name:'儲存出席',exact:true}).click();
    await page.getByRole('heading',{name:'牧養概況',exact:true}).waitFor();
    const d=await(await page.context().request.get(origin+'/api/life-groups/dashboard?scope='+group)).json();
    if(d.gatherings[0]?.counts.present!==1||d.gatherings[0]?.counts.unrecorded!==1||d.gatherings[0]?.counts.absent!==0)throw Error('Attendance save contract failed');
    if(d.care.active!==1||d.prayers.recent!==1||d.prayers.items[0].authorName!=='匿名')throw Error('Dashboard data contract failed');
    const checks=[];
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:844});await page.goto(origin+'/work');await page.getByRole('button',{name:'補記錄',exact:true}).waitFor();
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Dashboard overflow '+width);
      await page.screenshot({path:output+'/'+width+'-overview.png',fullPage:true});checks.push({width,overflow:false});
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>localStorage.setItem('wechurch-theme','dark'));
    await page.emulateMedia({colorScheme:'dark'});
    await page.reload();await page.getByRole('button',{name:'補記錄',exact:true}).waitFor();
    await page.screenshot({path:output+'/390-overview-dark.png',fullPage:true});
    await page.getByRole('link',{name:'記錄關心',exact:true}).click();
    await page.getByRole('heading',{name:'小明（示範） · 關懷進度',exact:true}).waitFor();
    await page.getByRole('textbox',{name:'本次跟進紀錄',exact:true}).fill('測試：已關心，這段資料會在驗收後移除。');
    await page.getByRole('button',{name:'儲存本次跟進',exact:true}).click();
    await page.getByText('測試：已關心，這段資料會在驗收後移除。',{exact:true}).waitFor();
    await page.goto(origin+'/work');await page.getByRole('button',{name:'查看共同代禱',exact:true}).click();await page.getByText('為新工作代禱（示範）',{exact:true}).waitFor();
    await page.getByRole('link',{name:'前往代禱',exact:true}).click();await page.getByText('求有平安與智慧，適應新的工作環境。',{exact:true}).waitFor();
    await login(2);const admin=await(await page.context().request.get(origin+'/api/life-groups/dashboard')).json();if(admin.groups.length)throw Error('System admin inherited pastoral scope');
    await login(1);const denied=await page.context().request.get(origin+'/api/life-groups/dashboard?scope='+group);if(denied.status()!==404)throw Error('Ordinary member inherited dashboard scope');
    await login(2);
    const changed=await page.context().request.patch(origin+'/api/life-groups/management/'+group,{headers:{Origin:origin},data:{version:1,name:'恩典小家（示範）',description:'',meeting:'',announcement:'',listed:false,status:'active',leaderId:people[1].id}});
    if(changed.status()!==200)throw Error('Fixture handoff failed');
    await login(1);const inherited=await(await page.context().request.get(origin+'/api/life-groups/dashboard?scope='+group)).json();
    if(inherited.gatherings[0]?.counts.present!==1||inherited.care.active!==1)throw Error('New appointment did not inherit group history');
    await page.goto(origin+'/');await page.getByRole('link',{name:/牧養概況/}).waitFor();
    await login(0);if((await page.context().request.get(origin+'/api/life-groups/dashboard?scope='+group)).status()!==404)throw Error('Former appointment retained dashboard permission');
    return {checks,attendanceSaved:true,unknownPreserved:true,careDeepLinkAndWrite:true,sharedPrayerNavigation:true,anonymousProtected:true,adminScopeDenied:true,ordinaryMemberScopeDenied:true,fixtureSession:true,handoffHistoryPreserved:true,memberRoleLeaderEntry:true,formerLeaderRevoked:true,physicalIPhoneTested:false,googleOAuthTested:false};
  }`;
  let raw;
  try{raw=execFileSync(cli,['-s=leader-dashboard-b','run-code',script],{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024});}
  catch(error){const text=String(error.stdout||'')+String(error.stderr||'');const diagnostic=text.split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1200);if(diagnostic&&![app.SESSION_SECRET,app.STAGING_ACCESS_CODE,...people.map(p=>p.cookie)].some(v=>diagnostic.includes(v)))console.error(diagnostic);throw Error('B dashboard browser failed; credential-bearing output withheld');}
  const result=raw.split('### Result\n')[1]?.split('\n###')[0];if(!result){const diagnostic=raw.split('### Error\n')[1]?.split('\n###')[0]?.slice(0,1000);if(diagnostic&&![app.STAGING_ACCESS_CODE,...people.map(p=>p.cookie)].some(v=>diagnostic.includes(v)))console.error(diagnostic);throw Error('Missing browser result; raw output withheld');}evidence=JSON.parse(result);
}finally{
  try{execFileSync(cli,['-s=leader-dashboard-b','close'],{cwd:root,stdio:'pipe',timeout:30000});}catch{}
  stagingSql(`BEGIN;
    DELETE FROM group_gathering_events WHERE gathering_id IN(SELECT id FROM group_gatherings WHERE group_id=${sql(group)});
    DELETE FROM group_gathering_attendance WHERE gathering_id IN(SELECT id FROM group_gatherings WHERE group_id=${sql(group)});
    DELETE FROM group_gatherings WHERE group_id=${sql(group)};
    DELETE FROM life_group_care_updates WHERE care_id=${sql(care)};
    DELETE FROM life_group_care_watches WHERE care_id=${sql(care)};
    DELETE FROM life_group_care WHERE id=${sql(care)} AND group_id=${sql(group)};
    DELETE FROM life_group_prayed WHERE share_id=${sql(prayer)};
    DELETE FROM life_group_comments WHERE share_id=${sql(prayer)};
    DELETE FROM life_group_shares WHERE id=${sql(prayer)} AND group_id=${sql(group)};
    DELETE FROM small_group_members WHERE group_id=${sql(group)};
    DELETE FROM family_membership_events WHERE group_id=${sql(group)};
    DELETE FROM small_groups WHERE id=${sql(group)} AND leader_user_id IN(${sql(people[0].id)},${sql(people[1].id)});
    ${people.map(p=>`DELETE FROM auth_sessions WHERE sid=${sql(p.sid)};DELETE FROM user_roles WHERE user_id=${sql(p.id)};DELETE FROM users WHERE id=${sql(p.id)} AND email=${sql(p.email)};DELETE FROM auth_users WHERE id=${sql(p.authId)} AND email=${sql(p.email)};`).join('\n')}
    COMMIT;`);
  assert.equal(stagingSql(`SELECT count(*) FROM users WHERE id IN(${people.map(p=>sql(p.id)).join(',')})`),'0');
}
assert.equal(inspectStaging().productionDeployment,productionDeployment,'A changed');
evidence={...evidence,fixtureRemoved:true,productionUnchanged:true,at:new Date().toISOString()};
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({output,...evidence}));
