import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
// Every fixture below is new synthetic data in the disposable runner database.
export async function verifyMultichurchExtraHttp(pool:Pool,makeClient:()=>Client){
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name,/^wechurch_integrity_[a-f0-9]{32}$/);
  const churches=['IM 行動教會','桃園WeChurch','火樂'];
  const fixture=async(church:string|null,role?:string)=>{
    const base=makeClient(),email=`extra-${randomUUID()}@example.test`;
    const registration=await base('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Synthetic scoped fixture'});assert.equal(registration.status,200);
    const id=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    await pool.query('UPDATE users SET church=$2 WHERE id=$1',[id,church]);
    if(role)await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
    const origin=new URL(registration.url).origin,cookies=new Map<string,string>();
    const remember=(r:Response)=>{for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}};remember(registration);
    const client=async(path:string,method='GET',body?:unknown,scope?:string)=>{const r=await fetch(origin+path,{method,redirect:'manual',headers:{origin,'Content-Type':'application/json',cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(scope?{'X-WeChurch-Church':encodeURIComponent(scope)}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(r);return r;};
    return {id,client,origin};
  };
  const members=await Promise.all(churches.map(c=>fixture(c))),pending=await fixture(null),admin=await fixture(churches[0],'admin');
  const templates:string[]=[];
  for(let i=0;i<3;i++){
    const id=(await pool.query("INSERT INTO reading_plan_templates(name,duration_days,is_public,church) VALUES('Synthetic public template',1,true,$1) RETURNING id",[churches[i]])).rows[0].id;templates.push(id);
    await pool.query("INSERT INTO reading_plan_template_items(template_id,day_number,scripture_reference) VALUES($1,1,'詩篇 23')",[id]);
  }
  const subscribe=(templateId:string)=>({name:'Synthetic personal plan',startDate:'2038-03-17',templateId});
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(i!==j){
    const before=(await pool.query('SELECT count(*)::int AS n FROM user_reading_plans WHERE user_id=$1',[members[i].id])).rows[0].n;
    assert.equal((await members[i].client('/api/user-reading-plans','POST',subscribe(templates[j]))).status,404);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM user_reading_plans WHERE user_id=$1',[members[i].id])).rows[0].n,before,'foreign subscription leaves no plan');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM user_reading_progress WHERE user_id=$1',[members[i].id])).rows[0].n,0,'foreign subscription leaves no progress');
  }
  assert.equal((await pending.client('/api/user-reading-plans','POST',subscribe(templates[0]))).status,404);
  const custom=await pending.client('/api/user-reading-plans','POST',{name:'Synthetic private pending',startDate:'2038-03-17',bookSelections:[{bookName:'詩篇',chapterStart:1,chapterEnd:2}],chaptersPerDay:1});
  assert.equal(custom.status,201,await custom.clone().text());const customPlan=await custom.json();
  assert.equal((await pool.query('SELECT church,is_public,created_by FROM reading_plan_templates WHERE id=$1',[customPlan.templateId])).rows[0].church,null,'unassigned private template is not silently iM');
  const items=await pending.client(`/api/user-reading-plans/${customPlan.id}/items`);assert.equal(items.status,200);assert.equal((await items.json()).length,2);
  assert.equal((await members[0].client(`/api/user-reading-plans/${customPlan.id}/items`)).status,404,'owner template items reject another member');
  const own=await members[0].client('/api/user-reading-plans','POST',subscribe(templates[0]));assert.equal(own.status,201);const ownPlan=await own.json();
  await pool.query('UPDATE users SET church=$2 WHERE id=$1',[members[0].id,churches[1]]);
  assert.equal((await members[0].client(`/api/user-reading-plans/${ownPlan.id}/items`)).status,200,'original personal joined plan retained after move');
  assert.equal((await members[0].client(`/api/reading-plans/${templates[0]}`)).status,404,'personal history does not expose foreign template catalog');
  // Cross-church administrative management is not a membership or local appointment.
  const created=await admin.client('/api/life-groups/management','POST',{name:'Synthetic foreign catalog',church:churches[2]},churches[2]);
  assert.equal(created.status,201,await created.clone().text());const family=await created.json();
  const row=(await pool.query('SELECT leader_user_id,co_leader_user_id,pastor_user_id FROM small_groups WHERE id=$1',[family.id])).rows[0];assert.deepEqual(row,{leader_user_id:null,co_leader_user_id:null,pastor_user_id:null});
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM small_group_members WHERE group_id=$1',[family.id])).rows[0].n,0);
  // Same private prayer can have immutable publications in two churches; withdrawal targets one exact copy.
  const actor=members[1],source=(await pool.query("INSERT INTO personal_prayers(user_id,title,prayer) VALUES($1,'Synthetic prayer','PRIVATE synthetic source') RETURNING id",[actor.id])).rows[0].id;
  const share={items:[{sourceId:source,title:'Synthetic delivery',body:'Synthetic body'}],publicWall:true,anonymous:false,consent:true};
  assert.equal((await actor.client('/api/prayer-sharing','POST',share)).status,200);
  await pool.query('UPDATE users SET church=$2 WHERE id=$1',[actor.id,churches[2]]);
  assert.equal((await actor.client('/api/prayer-sharing','POST',share)).status,200);
  const copies=(await pool.query('SELECT church,post_id FROM personal_prayer_shares WHERE prayer_id=$1 ORDER BY church',[source])).rows;assert.equal(copies.length,2);
  assert.equal((await members[2].client(`/api/prayer-sharing/${source}/public?deliveryChurch=${encodeURIComponent(churches[1])}`,'DELETE')).status,404,'another actor cannot withdraw original owner history');
  assert.equal((await actor.client(`/api/prayer-sharing/${source}/public`,'DELETE')).status,200);
  const old=(await pool.query('SELECT church,post_id FROM personal_prayer_shares WHERE prayer_id=$1',[source])).rows;assert.equal(old.length,1);assert.equal(old[0].church,churches[1]);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM prayers WHERE id=$1',[old[0].post_id])).rows[0].n,1);
  assert.equal((await actor.client(`/api/prayer-sharing/${source}/public?deliveryChurch=${encodeURIComponent(churches[1])}`,'DELETE')).status,200);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM personal_prayer_shares WHERE prayer_id=$1',[source])).rows[0].n,0);
  // Material catalogs are church scoped; explicit invitation code and current game card retain guest semantics.
  const cardIds:string[]=[];
  for(let i=0;i<3;i++)cardIds.push((await pool.query("INSERT INTO card_questions(content_text,level,church) VALUES($1,'L1',$2) RETURNING id",[`Synthetic card ${i}`,churches[i]])).rows[0].id);
  for(let i=0;i<3;i++){
    // members[0]/[1] moved above, so use admin-selected catalog scope for every church.
    const deck=await admin.client('/api/icebreaker/cards','GET',undefined,churches[i]);assert.equal(deck.status,200);const body=JSON.stringify(await deck.json());assert(body.includes(cardIds[i]));for(let j=0;j<3;j++)if(i!==j)assert(!body.includes(cardIds[j]));
  }
  const game=(await pool.query("INSERT INTO icebreaker_games(room_code,church,current_card_id,current_drawer_card_id,used_card_ids) VALUES($1,$2,$3,$4,$5) RETURNING id",[randomUUID(),churches[0],cardIds[0],cardIds[0],[cardIds[1]]])).rows[0].id;
  const guest=(path:string)=>fetch(admin.origin+path);
  assert.equal((await guest(`/api/icebreaker/cards/${cardIds[0]}?gameId=${game}`)).status,200);
  assert.equal((await guest(`/api/icebreaker/cards/${cardIds[1]}?gameId=${game}`)).status,403,'historical/foreign card cannot be retrieved via game');
  await pool.query('UPDATE icebreaker_games SET current_card_id=NULL WHERE id=$1',[game]);
  assert.equal((await guest(`/api/icebreaker/cards/${cardIds[0]}?gameId=${game}`)).status,200,'current drawer card remains available');
  const shortCode=`invite-${randomUUID()}`;
  await pool.query("INSERT INTO message_cards(title,short_code,image_path,church) VALUES('Synthetic invited material',$1,'synthetic.png',$2)",[shortCode,churches[0]]);
  assert.equal((await guest(`/api/message-cards/${shortCode}`)).status,200);
  assert.equal((await guest('/api/message-cards/all')).status,401);
  for(const church of churches){const list=await admin.client('/api/message-cards/all','GET',undefined,church);assert.equal(list.status,200);assert.equal(JSON.stringify(await list.json()).includes(shortCode),church===churches[0]);}
  const imageName=`foreign-${randomUUID()}.png`,imageCode=`image-${randomUUID()}`;
  const foreignImageCard=(await pool.query("INSERT INTO message_cards(title,short_code,image_path,church) VALUES('Synthetic original image',$1,$2,$3) RETURNING id",[imageCode,imageName,churches[0]])).rows[0].id;
  assert.equal((await admin.client('/api/message-cards','POST',{title:'Synthetic illicit binding',shortCode:randomUUID(),imagePath:imageName},churches[1])).status,404);
  const ownImage=(await pool.query("INSERT INTO message_cards(title,short_code,image_path,church) VALUES('Synthetic other image',$1,'separate.png',$2) RETURNING id",[randomUUID(),churches[1]])).rows[0].id;
  assert.equal((await admin.client(`/api/message-cards/${ownImage}`,'PATCH',{imagePath:imageName},churches[1])).status,404);
  assert.equal((await admin.client(`/api/message-cards/image/${imageName}`,'DELETE',undefined,churches[1])).status,404);
  assert.equal((await pool.query('SELECT image_path FROM message_cards WHERE id=$1',[foreignImageCard])).rows[0].image_path,imageName);
  const postGuest=(body:unknown)=>fetch(admin.origin+'/api/potential-members',{method:'POST',headers:{origin:admin.origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert([400,401].includes((await postGuest({name:'Synthetic lead',email:`missing-${randomUUID()}@example.test`})).status));
  assert.equal((await postGuest({name:'Synthetic lead',email:`invalid-${randomUUID()}@example.test`,shortCode:'nonexistent-fixture',consent:true})).status,404);
  for(let i=0;i<3;i++){
    const code=`lead-${randomUUID()}`,email=`lead-${randomUUID()}@example.test`;
    await pool.query("INSERT INTO message_cards(title,short_code,image_path,church) VALUES('Synthetic invite lead',$1,'synthetic.png',$2)",[code,churches[i]]);
    const valid={name:'Synthetic voluntary lead',email,shortCode:code,consent:true};
    assert.equal((await postGuest({...valid,church:churches[(i+1)%3]})).status,400,'body cannot override invited parent church');
    assert.equal((await postGuest(valid)).status,201);
    const lead=(await pool.query('SELECT church,user_id FROM potential_members WHERE email=$1',[email])).rows[0];assert.deepEqual(lead,{church:churches[i],user_id:null});
    for(let j=0;j<3;j++){const listed=await admin.client('/api/potential-members','GET',undefined,churches[j]);assert.equal(listed.status,200);assert.equal(JSON.stringify(await listed.json()).includes(email),i===j);}
    await pool.query('UPDATE message_cards SET is_active=false WHERE short_code=$1',[code]);
    assert.equal((await postGuest({...valid,email:`disabled-${randomUUID()}@example.test`})).status,404);
  }
  console.log('Multichurch extra HTTP: actual subscription/private history/appointments/delivery withdrawal/material and guest boundaries passed');
}
