import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { inspectStaging, stagingSql, target, root } from '../scripts/railway-staging.mjs';

const state=inspectStaging();
const file=path.join(root,'artifacts/railway-staging/notification-fixture.json');
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
const mode=process.argv[2];
assert(['prepare','cleanup'].includes(mode));
if(mode==='cleanup') {
  const f=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const key of ['actor','prayer','group','share']) assert.match(f[key],/^[a-f0-9-]{36}$/);
  assert.match(f.email,/^notification-qa-[a-f0-9-]{36}@example\.invalid$/);
  stagingSql(`BEGIN;
    DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id=${literal(f.actor)} AND email<>${literal(f.email)}) THEN RAISE EXCEPTION 'Fixture identity changed'; END IF; END $guard$;
    DELETE FROM prayer_comments WHERE prayer_id=${literal(f.prayer)};
    DELETE FROM prayer_amens WHERE prayer_id=${literal(f.prayer)};
    DELETE FROM prayers WHERE id=${literal(f.prayer)} AND content='通知驗收：這是測試代禱，不是真實需求。';
    DELETE FROM life_group_comments WHERE share_id=${literal(f.share)};
    DELETE FROM life_group_prayed WHERE share_id=${literal(f.share)};
    DELETE FROM life_group_shares WHERE id=${literal(f.share)};
    DELETE FROM small_group_members WHERE group_id=${literal(f.group)};
    DELETE FROM small_groups WHERE id=${literal(f.group)} AND name='通知驗收小家（測試）';
    DELETE FROM auth_sessions WHERE sess->'passport'->'user'->>'sessionUserId'=${literal(f.actor)};
    DELETE FROM auth_users WHERE id=${literal(`local_${f.actor}`)} AND email=${literal(f.email)};
    DELETE FROM users WHERE id=${literal(f.actor)} AND email=${literal(f.email)};
    COMMIT;`);
  const remaining=Number(stagingSql(`SELECT (SELECT count(*) FROM users WHERE id=${literal(f.actor)})+(SELECT count(*) FROM prayers WHERE id=${literal(f.prayer)})+(SELECT count(*) FROM small_groups WHERE id=${literal(f.group)})+(SELECT count(*) FROM interaction_notifications WHERE actor_id=${literal(f.actor)});`));
  assert.equal(remaining,0); fs.writeFileSync(file,JSON.stringify({...f,cleanedAt:new Date().toISOString()},null,2),{mode:0o600});
  console.log({syntheticDataRemoved:true,productionUnchanged:true});
} else {
  assert(!fs.existsSync(file)||JSON.parse(fs.readFileSync(file,'utf8')).cleanedAt,'Clean up the previous fixture first');
  const recipient=JSON.parse(stagingSql(`SELECT coalesce(json_agg(t),'[]') FROM (SELECT id,church FROM users WHERE lower(email)=${literal(process.env.WECHURCH_QA_RECIPIENT || '')}) t`));
  assert.equal(recipient.length,1);
  assert.equal(Number(stagingSql(`SELECT count(*) FROM user_email_preferences WHERE user_id=${literal(recipient[0].id)} AND interaction_email_enabled`)),0,'Recipient must remain opted out');
  const f={actor:randomUUID(),prayer:randomUUID(),group:randomUUID(),share:randomUUID(),familyComment:randomUUID(),email:`notification-qa-${randomUUID()}@example.invalid`,createdAt:new Date().toISOString()};
  fs.writeFileSync(file,JSON.stringify(f,null,2),{mode:0o600});
  const password=randomUUID()+randomUUID(),hash=await bcrypt.hash(password,12);
  stagingSql(`BEGIN;
    INSERT INTO users(id,email,password,display_name,church) VALUES(${literal(f.actor)},${literal(f.email)},${literal(hash)},'通知驗收（測試）',${literal(recipient[0].church)});
    INSERT INTO prayers(id,user_id,content) VALUES(${literal(f.prayer)},${literal(recipient[0].id)},'通知驗收：這是測試代禱，不是真實需求。');
    INSERT INTO small_groups(id,name,church,leader_user_id,is_listed) VALUES(${literal(f.group)},'通知驗收小家（測試）',${literal(recipient[0].church)},${literal(recipient[0].id)},false);
    INSERT INTO small_group_members(group_id,user_id,history_from) VALUES(${literal(f.group)},${literal(f.actor)},now()-interval '1 day');
    INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body) VALUES(${literal(f.share)},${literal(f.group)},${literal(recipient[0].id)},'prayer','通知驗收：小家代禱','這是測試內容，驗收後移除。');
    COMMIT;`);
  let cookie='';
  const call=async(route,method='GET',body) => {
    const r=await fetch(target.origin+route,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Cookie:cookie,Origin:target.origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    for(const value of r.headers.getSetCookie()) { const pair=value.split(';')[0]; cookie=cookie.split('; ').filter(p=>p&&!p.startsWith(pair.split('=')[0]+'=')).concat(pair).join('; '); }
    return r;
  };
  assert.equal((await call('/__staging/access','POST',{code:state.app.STAGING_ACCESS_CODE})).status,303);
  assert.equal((await call('/api/auth/email-login','POST',{email:f.email,password})).status,200);
  assert.equal((await call(`/api/prayers/${f.prayer}/amen`,'POST',{})).status,201);
  const comment=await call(`/api/prayers/${f.prayer}/comments`,'POST',{content:'通知驗收：我為你禱告，也與你同行。',requestId:randomUUID()});
  assert.equal(comment.status,201);f.prayerComment=(await comment.json()).id;
  const family=`/api/life-groups/${f.group}/shares/${f.share}`;
  assert.equal((await call(family+'/comments/'+f.familyComment,'PUT',{body:'通知驗收：小家的鼓勵能直接看見。'})).status,200);
  const count=Number(stagingSql(`SELECT count(*) FROM interaction_notifications WHERE actor_id=${literal(f.actor)} AND user_id=${literal(recipient[0].id)}`));
  assert.equal(count,3);assert.equal((await (await call('/api/notifications')).json()).unreadCount,0);
  fs.writeFileSync(file,JSON.stringify({...f,apiVerified:true},null,2),{mode:0o600});
  console.log({bApiWorkflowPassed:true,notificationsCreated:count,emailNotSent:true,fixture:'artifacts/railway-staging/notification-fixture.json'});
}
