import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { NotificationFeed } from '../shared/notifications';
import { runInteractionEmails, buildInteractionEmail } from '../server/notificationEmail';
import type { SendEmailOptions } from '../server/resend';

type Client = (path:string,method?:string,body?:unknown) => Promise<Response>;
export async function verifyNotificationsHttp(pool:Pool,makeClient:() => Client) {
  const actors: {id:string;client:Client}[]=[];
  for (let i=0;i<3;i++) {
    const client=makeClient(),email=`notifications-${randomUUID()}@example.test`;
    assert.equal((await client('/api/auth/register','POST',{email,password:randomUUID(),displayName:`通知驗證${i}`})).status,200);
    actors.push({id:(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id,client});
  }
  const [a,b,c]=actors;
  const feed = async(actor=a,cursor?:string):Promise<NotificationFeed> => {
    const r=await actor.client('/api/notifications'+(cursor ? '?cursor='+encodeURIComponent(cursor) : ''));assert.equal(r.status,200);return r.json();
  };
  assert.equal((await makeClient()('/api/notifications')).status,401);
  assert.equal((await a.client('/api/notifications?cursor=bad')).status,400);
  const created=await a.client('/api/prayers','POST',{content:'只留在站內的測試代禱',isAnonymous:true});assert.equal(created.status,201);
  const prayer=(await created.json()).id;
  for (const actor of [a,b,b]) assert.equal((await actor.client(`/api/prayers/${prayer}/amen`,'POST',{})).status,201);
  assert.equal((await feed()).unreadCount,1);
  for (const selected of [true,true,false,true]) assert.equal((await b.client(`/api/prayers/${prayer}/reactions/heart`,'PUT',{selected})).status,200);
  assert.equal((await feed()).unreadCount,2);
  const receipt=randomUUID();
  for(let i=0;i<2;i++) assert.equal((await b.client(`/api/prayers/${prayer}/comments`,'POST',{content:'鼓勵內容',requestId:receipt})).status,201);
  const current=await feed();assert.equal(current.unreadCount,3);assert.equal(current.items.filter(n => n.kind==='prayer_comment').length,1);
  assert(!JSON.stringify(current).includes(a.id));assert(!JSON.stringify(current).includes('只留在站內'));assert(!JSON.stringify(current).includes('通知驗證'));
  const commentId=new URL(current.items.find(n => n.kind==='prayer_comment')!.href,'https://example.test').searchParams.get('comment')!;
  assert.equal((await c.client(`/api/notifications/${current.items[0].id}/read`,'POST',{})).status,404);
  assert.equal((await a.client(`/api/notifications/${current.items[0].id}/read`,'POST',{})).status,200);
  assert.equal((await feed()).unreadCount,2);
  assert.equal((await a.client(`/api/prayers/${prayer}/comments`,'POST',{content:'匿名本人回覆'})).status,201);
  assert.equal((await feed(b)).unreadCount,1);assert.equal((await feed(c)).unreadCount,0);
  const comments=await (await b.client(`/api/prayers/${prayer}/comments`)).json();
  assert.equal(comments.at(-1).authorName,'匿名發文者');assert.equal(comments.at(-1).userId,null);
  const snapshot=(await feed()).snapshotAt;
  assert.equal((await c.client(`/api/prayers/${prayer}/comments`,'POST',{content:'稍後的新回應'})).status,201);
  assert.equal((await a.client('/api/notifications/read-all','POST',{before:snapshot})).status,200);
  assert.equal((await feed()).unreadCount,1);
  assert.equal((await b.client(`/api/prayers/${prayer}/comments/${commentId}`,'DELETE')).status,200);
  assert(!(await feed()).items.some(n => n.href.includes(commentId)));
  assert.equal((await a.client(`/api/prayers/${prayer}`,'PATCH',{isClosed:true})).status,200);
  assert.equal((await b.client(`/api/prayers/${prayer}`)).status,404);
  assert.equal((await a.client(`/api/prayers/${prayer}`)).status,200);
  assert.equal((await feed(b)).unreadCount,0);

  const group=(await pool.query("INSERT INTO small_groups(name,church,leader_user_id) VALUES('通知測試小家','IM 行動教會',$1) RETURNING id",[a.id])).rows[0].id;
  await pool.query("INSERT INTO small_group_members(group_id,user_id,history_from) VALUES($1,$2,now()-interval '1 day')",[group,b.id]);
  const share=randomUUID(),path=`/api/life-groups/${group}/shares/${share}`;
  assert.equal((await a.client(path,'PUT',{kind:'prayer',title:'小家代禱',body:'小家私密內容',anonymous:true,consent:true})).status,200);
  assert.equal((await b.client(path+'/prayed','PUT',{})).status,200);
  const familyComment=randomUUID();
  for(let i=0;i<2;i++) assert.equal((await b.client(path+'/comments/'+familyComment,'PUT',{body:'小家鼓勵'})).status,200);
  const familyItems=(await feed()).items.filter(n => n.kind.startsWith('family'));assert.equal(familyItems.length,2);
  assert(familyItems.some(n => n.href===`/groups/${group}?share=${share}&comment=${familyComment}`));
  assert.equal((await c.client(path)).status,404);assert.equal((await c.client(path+'/comments/'+familyComment)).status,404);
  assert.equal((await b.client(path)).status,200);assert.equal((await b.client(path+'/comments/'+familyComment)).status,200);
  const reply=randomUUID();assert.equal((await a.client(path+'/comments/'+reply,'PUT',{body:'匿名回覆'})).status,200);
  const anonymousReply=await (await b.client(path+'/comments/'+reply)).json();assert.equal(anonymousReply.authorId,null);assert.equal(anonymousReply.authorName,'匿名發文者');
  assert.equal((await feed(b)).unreadCount,1);
  await pool.query('UPDATE small_group_members SET is_active=false WHERE group_id=$1 AND user_id=$2',[group,b.id]);
  assert.equal((await feed(b)).unreadCount,0);assert.equal((await b.client(path+'/comments/'+reply)).status,404);
  assert.equal((await a.client(path+'/comments/'+familyComment,'DELETE')).status,200);
  assert(!(await feed()).items.some(n => n.href.includes(familyComment)));
  assert.equal((await a.client(path,'DELETE')).status,200);assert(!(await feed()).items.some(n => n.kind.startsWith('family')));

  await pool.query('DELETE FROM interaction_notifications WHERE user_id=ANY($1::uuid[])',[actors.map(u => u.id)]);
  await pool.query(`INSERT INTO interaction_notifications(user_id,actor_id,kind,event_key,prayer_id,created_at)
    SELECT $1,$2,'prayer_amen','pagination/'||i,$3,now()-interval '1 hour'+i*interval '1 microsecond' FROM generate_series(1,65) i`,[a.id,b.id,prayer]);
  const ids=new Set<string>();let cursor:string | null=null;
  do { const page=await feed(a,cursor || undefined);for(const n of page.items){assert(!ids.has(n.id));ids.add(n.id);}cursor=page.nextCursor; } while(cursor);
  assert.equal(ids.size,65);

  const savedEnv={...process.env};
  try {
    Object.assign(process.env,{INTERACTION_EMAIL_SCHEDULER_ENABLED:'1',RESEND_API_KEY:'test-only',RESEND_FROM_EMAIL:'sender@example.test',RESEND_REPLY_TO:'reply@example.test',DISABLE_OUTBOUND_EMAIL:'0',STAGING_CONTROLLED_EMAIL_ENABLED:'1'});
    const sendLog:SendEmailOptions[]=[];
    const send = async(input:SendEmailOptions) => {sendLog.push(input);return {data:{id:'mock-accepted'},error:null};};
    assert.equal((await runInteractionEmails({dryRun:false,userIds:[a.id],send})).accepted,0);
    assert.equal((await a.client('/api/email-preferences','PATCH',{interactionEmailEnabled:true})).status,200);
    const consent=await (await a.client('/api/email-preferences')).json();assert(consent.interactionEmailConsentAt);assert(consent.interactionEmailEnabled);
    assert.equal((await runInteractionEmails({dryRun:false,userIds:[a.id],send})).accepted,0,'never email pre-consent backlog');
    const now=new Date(Date.now()+10*60_000);
    await pool.query(`UPDATE interaction_notifications SET created_at=now(),read_at=NULL WHERE user_id=$1`,[a.id]);
    assert.equal((await runInteractionEmails({userIds:[a.id],now,send})).eligible,1);assert.equal(sendLog.length,0,'dry run is read only');
    await Promise.all([runInteractionEmails({dryRun:false,userIds:[a.id],now,send}),runInteractionEmails({dryRun:false,userIds:[a.id],now,send})]);
    await runInteractionEmails({dryRun:false,userIds:[a.id],now,send});
    assert.equal(sendLog.length,1);assert.equal(sendLog[0].purpose,'self');assert(!JSON.stringify(sendLog).includes('小家私密'));assert(!JSON.stringify(sendLog).includes('只留在站內'));
    assert(buildInteractionEmail().text.includes('/notifications'));
    await pool.query("INSERT INTO interaction_notifications(user_id,actor_id,kind,event_key,prayer_id) VALUES($1,$2,'prayer_amen','email/uncertain',$3)",[a.id,b.id,prayer]);
    let uncertainSends=0;
    const uncertainNow=new Date(now.getTime()+3600_000);
    const failed=await runInteractionEmails({dryRun:false,userIds:[a.id],now:uncertainNow,send:async() => { uncertainSends++; throw new Error('provider timeout'); }});
    assert.equal(failed.unconfirmed,1);assert.equal(uncertainSends,1);
    await runInteractionEmails({dryRun:false,userIds:[a.id],now:new Date(uncertainNow.getTime()+3600_000),send});
    assert.equal(sendLog.length,1,'uncertain delivery must not be resent automatically');
    await pool.query("INSERT INTO interaction_notifications(user_id,actor_id,kind,event_key,prayer_id) VALUES($1,$2,'prayer_amen','email/optout',$3)",[a.id,b.id,prayer]);
    assert.equal((await a.client('/api/email-preferences','PATCH',{interactionEmailEnabled:false})).status,200);
    assert.equal((await runInteractionEmails({dryRun:false,userIds:[a.id],now:new Date(now.getTime()+3600_000),send})).accepted,0);
    assert.equal(sendLog.length,1);
  } finally {
    for(const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env,savedEnv);
  }
  assert.equal((await a.client(`/api/prayers/${prayer}`,'DELETE')).status,200);
  assert.equal((await feed()).items.length,0);
  console.log('PASS notifications: recipient ownership, anonymous replies, participants, retry deduplication, withdrawal, closed source, family exit, old-target lookup, exact keyset pagination, consent, generic hourly email and opt-out');
}
