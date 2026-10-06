import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import type {Pool} from 'pg';
type Client=(path:string,method?:string,body?:unknown)=>Promise<Response>;
// Test-only interception of the exact synthetic actor SQL; no runtime hooks or debug HTTP endpoints.
export async function verifyMultichurchRacesHttp(pool:Pool,makeClient:()=>Client){
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name,/^wechurch_integrity_[a-f0-9]{32}$/);
  const im='IM 行動教會',fire='火樂';
  const fixture=async(role:string)=>{
    const base=makeClient(),email=`race-${randomUUID()}@example.test`;
    const registered=await base('/api/auth/register','POST',{email,password:randomUUID(),displayName:'Synthetic race fixture'});assert.equal(registered.status,200);
    const id=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    await pool.query('UPDATE users SET church=$2 WHERE id=$1',[id,im]);await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role]);
    return {id,email,client:base};
  };
  const actor=await fixture('leader'),admin=await fixture('admin');
  const original=pg.Client.prototype.query;
  const deadline=<T>(value:Promise<T>)=>Promise.race([value,new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Synthetic race deadline')),5000);timer.unref();})]);
  const count=async(table:string)=>(await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
  const operations=[
    {path:'/api/prayers',body:{content:'Synthetic stale race',category:'other',isAnonymous:false},table:'prayers',success:201},
    {path:'/api/sessions',body:{verseReference:'Synthetic stale race'},table:'sessions',success:201},
    {path:'/api/icebreaker/games',body:{mode:'standalone',currentLevel:'L1'},table:'icebreaker_games',success:200},
    {path:'/api/message-cards',body:{title:'Synthetic stale race',imagePath:`race-${randomUUID()}.png`},table:'message_cards',success:201},
  ];
  const move=()=>admin.client(`/api/users/${actor.id}/profile`,'PATCH',{church:fire,expectedChurch:im});
  for(const operation of operations){
    for(const order of ['move-first','write-first']){
      await pool.query('UPDATE users SET church=$2 WHERE id=$1',[actor.id,im]);const before=await count(operation.table);
      let reach!:()=>void,release!:()=>void;const reached=new Promise<void>(resolve=>{reach=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});let intercepted=false;
      // Nonmatching calls preserve pg's exact callback/Promise API; matching calls use Promise query form.
      pg.Client.prototype.query=function(this:pg.Client,...args:unknown[]){
        const first=args[0] as {text?:string;values?:unknown[]}|string,text=typeof first==='string'?first:first?.text;
        const values=(Array.isArray(args[1])?args[1]:typeof first==='object'?first.values:[]) as unknown[];
        if(!intercepted&&text?.includes('FROM users u WHERE u.id=')&&text.includes('FOR SHARE OF u')&&values?.[0]===actor.id){
          intercepted=true;
          return (async()=>{if(order==='move-first'){reach();await gate;return Reflect.apply(original,this,args);}const result=await Reflect.apply(original,this,args);reach();await gate;return result;})();
        }
        return Reflect.apply(original,this,args);
      } as typeof original;
      let write:Promise<Response>|undefined,change:Promise<Response>|undefined;
      try{
        write=actor.client(operation.path,'POST',operation.body);await deadline(reached);
        if(order==='move-first'){
          assert.equal((await deadline(move())).status,200);release();assert.equal((await deadline(write)).status,409);
          assert.equal(await count(operation.table),before,'old request cannot publish after completed affiliation move');
        }else{
          let moveFinished=false;change=move().then(response=>{moveFinished=true;return response;});
          let blocked=false;
          for(let attempt=0;attempt<200;attempt++){
            blocked=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE query='SELECT * FROM users WHERE id=$1 FOR UPDATE' AND cardinality(pg_blocking_pids(pid))>0) AS blocked")).rows[0].blocked;
            if(blocked)break;await new Promise(resolve=>setTimeout(resolve,5));
          }
          assert.equal(blocked,true,'affiliation writer actually waits on actor SHARE lock');assert.equal(moveFinished,false);
          release();assert.equal((await deadline(write)).status,operation.success);assert.equal((await deadline(change)).status,200);
          assert.equal(await count(operation.table),before+1);
        }
        assert.equal((await pool.query('SELECT church FROM users WHERE id=$1',[actor.id])).rows[0].church,fire);
      }finally{release();pg.Client.prototype.query=original;await Promise.allSettled([write,change].filter(Boolean));}
    }
  }
  // The original invitation/browser participant capability is portable; game snapshots follow its actual parent.
  const parentResponse=await admin.client('/api/sessions','POST',{verseReference:'Synthetic original invitation'});assert.equal(parentResponse.status,201);const parent=await parentResponse.json();
  const participantResponse=await actor.client(`/api/sessions/${parent.id}/participants`,'POST',{name:'Synthetic original participant',email:actor.email,gender:'male'});assert.equal(participantResponse.status,201);const participant=await participantResponse.json();
  assert.equal((await admin.client(`/api/participants/${participant.id}`,'PATCH',{groupNumber:1})).status,200);
  const roomResponse=await actor.client('/api/icebreaker/games','POST',{mode:'session',bibleStudySessionId:parent.id,groupNumber:1,currentLevel:'L1'});assert.equal(roomResponse.status,200);const room=await roomResponse.json();
  assert.equal(room.church,im);assert.equal((await pool.query('SELECT church FROM sessions WHERE id=$1',[room.bibleStudySessionId])).rows[0].church,room.church);
  console.log('PASS actual multichurch races: four root writes in both lock orders, stale requests 409/zero publication, affiliation waits for actor SHARE, portable invitation game preserves parent snapshot');
}
