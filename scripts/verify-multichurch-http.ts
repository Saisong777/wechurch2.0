import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
type ScopedClient = (path: string, method?: string, body?: unknown, church?: string) => Promise<Response>;
const churches = ['IM 行動教會', '桃園WeChurch', '火樂'];

// Synthetic HTTP fixtures run only in the disposable integrity database.
export async function verifyMultichurchHttp(pool: Pool, makeClient: () => Client) {
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name, /^wechurch_integrity_[a-f0-9]{32}$/);
  const fixture = async (church: string | null, role?: string) => {
    const base = makeClient(), email = `church-${randomUUID()}@example.test`;
    const registration = await base('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Synthetic church fixture' });
    assert.equal(registration.status, 200);
    const id = (await pool.query('SELECT id,church FROM users WHERE email=$1', [email])).rows[0].id as string;
    assert.equal((await pool.query('SELECT church FROM users WHERE id=$1', [id])).rows[0].church, null, 'new registrations await approval');
    await pool.query('UPDATE users SET church=$2 WHERE id=$1', [id, church]);
    if (role) await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id, role]);
    const origin = new URL(registration.url).origin;
    const cookies = new Map<string,string>();
    const remember = (response: Response) => { for (const line of response.headers.getSetCookie()) { const pair = line.split(';')[0], at = pair.indexOf('='); cookies.set(pair.slice(0,at),pair.slice(at+1)); } };
    remember(registration);
    const client: ScopedClient = async (path, method='GET', body, selected) => {
      const response = await fetch(origin + path, { method, redirect: 'manual', headers: {
        origin, 'Content-Type':'application/json', cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join('; '),
        ...(selected ? { 'X-WeChurch-Church': encodeURIComponent(selected) } : {}),
      }, body: body === undefined ? undefined : JSON.stringify(body) });
      remember(response); return response;
    };
    return {id,client,church};
  };
  const members = await Promise.all(churches.map(c=>fixture(c)));
  const leaders = await Promise.all(churches.map(c=>fixture(c,'senior_pastor')));
  const admin = await fixture(churches[0],'admin'), pending = await fixture(null);
  const ownNote = async (client: ScopedClient) => {
    const result = await client('/api/devotional-notes','POST',{verseReference:'詩篇 23',verseText:'Synthetic scripture',observation:'PRIVATE church fixture',clientMutationId:randomUUID()});
    assert.equal(result.status,201); return (await result.json()).id as string;
  };
  const denies = async (response: Response, label: string) => assert([403,404].includes(response.status), `${label}: expected 403/404, got ${response.status} ${await response.text()}`);
  const posts: string[]=[], prayers: string[]=[], groups: string[]=[], schedules: string[]=[], receipts: string[]=[], shareInputs: unknown[]=[];
  const date = '2038-03-17';
  for (let i=0;i<churches.length;i++) {
    const member=members[i], leader=leaders[i], church=churches[i];
    const context=await member.client('/api/church-context'); assert.equal(context.status,200);
    const json=await context.json(); assert.equal(json.selectedChurch,church); assert.equal(json.requiresApproval,false); assert.deepEqual(json.allowedOptions.map((c:{id:string})=>c.id),[church]);
    const group=(await pool.query('INSERT INTO small_groups(name,church,leader_user_id,co_leader_user_id) VALUES($1,$2,$3,$4) RETURNING id',[`Synthetic ${i}`,church,leader.id,member.id])).rows[0].id;
    await pool.query('INSERT INTO small_group_members(group_id,user_id) VALUES($1,$2)',[group,member.id]); groups.push(group);
    const dayResult=await member.client('/api/devotion-wall/window');assert.equal(dayResult.status,200);const day=(await dayResult.json()).day;
    const input={sourceId:await ownNote(member.client),title:`Synthetic tenant ${i}`,body:`Tenant body ${i}`,reference:'詩篇 23',consent:true,group:{groupId:group},wall:{day,anonymous:true}};
    const receipt=randomUUID(), shared=await member.client(`/api/devotion-wall/shares/${receipt}`,'PUT',input); assert.equal(shared.status,201,await shared.text());
    posts.push(receipt); receipts.push(receipt); shareInputs.push(input);
    const prayer=await member.client('/api/prayers','POST',{content:`Synthetic church prayer ${i}`,category:'other',isAnonymous:false}); assert.equal(prayer.status,201); prayers.push((await prayer.json()).id);
    const created=await leader.client('/api/admin/church-devotions','POST',{date,planName:`Synthetic ${i}`,dayNumber:1,scriptureReference:'詩篇 23',scriptureText:'Synthetic scripture',devotionalTitle:`Tenant ${i}`,devotionalText:`Tenant lesson ${i}`,prayer:'',loveAction:'',status:'published'});
    assert.equal(created.status,201,await created.clone().text());schedules.push((await created.json()).id);
  }
  // Six directed church pairs cover both reads and mutations through parent IDs.
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(i!==j) {
    const user=members[i].client, leader=leaders[i].client, tag=`${i}->${j}`;
    const wall=await user('/api/devotion-wall');assert.equal(wall.status,200);assert(!JSON.stringify(await wall.json()).includes(posts[j]),`${tag} wall leakage`);
    const prayersResult=await user('/api/prayers');assert.equal(prayersResult.status,200);assert(!JSON.stringify(await prayersResult.json()).includes(prayers[j]),`${tag} prayer leakage`);
    const personal=await user('/api/life-groups');assert.equal(personal.status,200);assert(!JSON.stringify(await personal.json()).includes(groups[j]),`${tag} group leakage`);
    await denies(await user(`/api/life-groups/${groups[j]}`),`${tag} group detail`);
    await denies(await user(`/api/life-groups/${groups[j]}/shares?kind=all`),`${tag} group shares`);
    await denies(await user(`/api/prayers/${prayers[j]}/comments`),`${tag} comments read`);
    await denies(await user(`/api/prayers/${prayers[j]}/comments`,'POST',{content:'Cross church forbidden',kind:'encouragement',requestId:randomUUID()}),`${tag} comments write`);
    await denies(await user(`/api/prayers/${prayers[j]}/reactions/heart`,'PUT',{selected:true}),`${tag} reaction`);
    await denies(await user(`/api/prayers/${prayers[j]}/amen`,'POST'),`${tag} amen`);
    await denies(await leader(`/api/prayers/${prayers[j]}`,'DELETE'),`${tag} senior delete`);
    await denies(await user(`/api/devotion-wall/${posts[j]}`,'DELETE'),`${tag} wall delete`);
    const history=await leader(`/api/admin/church-devotions/${schedules[j]}/history`);
    if(history.status===200)assert.deepEqual(await history.json(),[],`${tag} schedule history leak`);else await denies(history,`${tag} schedule history`);
    await denies(await user('/api/devotion-wall','GET',undefined,churches[j]),`${tag} forged header`);
    await denies(await user(`/api/life-groups/directory?church=${encodeURIComponent(churches[j])}`),`${tag} forged query`);
    const attempt=randomUUID(), note=await ownNote(user);
    await denies(await user(`/api/devotion-wall/shares/${attempt}`,'PUT',{...(shareInputs[i] as object),sourceId:note,group:{groupId:groups[j]}}),`${tag} forged group and body`);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM devotion_share_requests WHERE request_id=$1',[attempt])).rows[0].n,0,'forbidden multi-share is atomic');
  }
  for(let i=0;i<3;i++) {
    const listed=await admin.client(`/api/admin/church-devotions?from=${date}&to=${date}`,'GET',undefined,churches[i]);assert.equal(listed.status,200);
    const data=JSON.stringify(await listed.json());assert(data.includes(schedules[i]));for(let j=0;j<3;j++)if(i!==j)assert(!data.includes(schedules[j]));
    const context=await admin.client('/api/church-context','GET',undefined,churches[i]);assert.equal((await context.json()).selectedChurch,churches[i]);
  }
  const conflict=await admin.client(`/api/church-context?church=${encodeURIComponent(churches[1])}`,'GET',undefined,churches[2]);assert.equal(conflict.status,400,'conflicting selectors rejected');
  const pendingContext=await pending.client('/api/church-context');assert.equal((await pendingContext.json()).requiresApproval,true);
  for(const path of ['/api/devotion-wall','/api/prayers','/api/life-groups','/api/reading-plans']) {
    const result=await pending.client(path);assert.equal(result.status,403);assert.equal((await result.json()).code,'CHURCH_APPROVAL_REQUIRED');
  }
  const privateNote=await ownNote(pending.client);assert(privateNote);
  // Moving an author cannot move historical content or replay it into the new church.
  const selfMove=await members[0].client(`/api/users/${members[0].id}/profile`,'PATCH',{church:churches[1],expectedChurch:churches[0]});assert.equal(selfMove.status,403,'member cannot choose own church');
  const seniorMove=await leaders[0].client(`/api/users/${members[0].id}/profile`,'PATCH',{church:churches[1],expectedChurch:churches[0]});assert.equal(seniorMove.status,403,'senior cannot approve church changes');
  const moved=await admin.client(`/api/users/${members[0].id}/profile`,'PATCH',{church:churches[1],expectedChurch:churches[0]});assert.equal(moved.status,200,await moved.text());
  const stale=await admin.client(`/api/users/${members[0].id}/profile`,'PATCH',{church:churches[2],expectedChurch:churches[0]});assert.equal(stale.status,409,'stale church approval cannot overwrite a newer decision');
  const oldMembership=(await pool.query('SELECT is_active FROM small_group_members WHERE group_id=$1 AND user_id=$2',[groups[0],members[0].id])).rows[0];assert.equal(oldMembership.is_active,false);
  assert.equal((await pool.query('SELECT co_leader_user_id FROM small_groups WHERE id=$1',[groups[0]])).rows[0].co_leader_user_id,null,'old appointment removed');
  assert.equal((await pool.query('SELECT count(*)::int n FROM church_affiliation_events WHERE user_id=$1',[members[0].id])).rows[0].n,1);
  const replay=await members[0].client(`/api/devotion-wall/shares/${receipts[0]}`,'PUT',shareInputs[0]);assert([403,404,409].includes(replay.status),'old-church receipt replay must reject after move');
  assert.equal((await pool.query('SELECT church FROM devotion_wall_posts WHERE id=$1',[posts[0]])).rows[0].church,churches[0]);
  assert.equal((await pool.query('SELECT church FROM prayers WHERE id=$1',[prayers[0]])).rows[0].church,churches[0]);
  assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[(shareInputs[0] as {sourceId:string}).sourceId])).rows[0].observation,'PRIVATE church fixture');
  console.log('PASS multi-church HTTP: three actual accounts/scopes, six directed parent/read/write isolation pairs, senior boundary, encoded header/query forgery, per-church same-date plans, global admin selection, unassigned private notes, atomic forbidden share, immutable history and receipt replay');
}
