import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readBackupKey, unseal, hash} from '../scripts/backup-envelope.mjs';
import {root} from '../scripts/railway-staging.mjs';
import {assertReplacementTarget} from './production-replacement-policy.mjs';
import {sendReplacementFile} from './production-relay.mjs';

process.umask(0o077);
const [command, preparedFile] = process.argv.slice(2);
if (!['data', 'files', 'legacy', 'smoke', 'privacy'].includes(command) || process.env.WECHURCH_ALLOW_PRODUCTION_REPLACEMENT !== '2026-09-30') throw new Error('Authorized verification required');
const directory = fs.realpathSync(process.env.WECHURCH_PRODUCTION_PRIVATE_DIR || '');
if (!path.relative(root, directory).startsWith('../')) throw new Error('Private evidence directory required');
const stateFile = path.join(directory, 'replacement.json');
const state = JSON.parse(fs.readFileSync(stateFile));
const initial = structuredClone(state);
const save = () => {
  const latest = JSON.parse(fs.readFileSync(stateFile));
  for (const [field, value] of Object.entries(state)) if (JSON.stringify(value) !== JSON.stringify(initial[field])) latest[field] = value;
  assertReplacementTarget(latest, latest.app, 'app');
  fs.writeFileSync(stateFile, JSON.stringify(latest, null, 2), {mode: 0o600});
};
assertReplacementTarget(state, state.app, 'app');
const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
try {
  const proof = JSON.parse(unseal(fs.readFileSync(path.join(state.bBackup, 'proof.json.enc')), key));
  let code = `import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import pg from '/app/node_modules/pg/lib/index.js';
assert.equal(process.env.RAILWAY_ENVIRONMENT_ID,${JSON.stringify(state.environment)});assert.equal(process.env.RAILWAY_SERVICE_ID,${JSON.stringify(state.app)});
const digest=x=>createHash('sha256').update(x).digest('hex');
`;
  if (command === 'data') {
    code += `const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});try{
console.log('WC_CHECK runtime_role');
const role=(await db.query('SELECT current_user,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls FROM pg_roles r WHERE rolname=current_user')).rows[0];assert.equal(role.current_user,'wechurch_app');assert.equal(role.rolsuper,false);assert.equal(role.rolcreatedb,false);assert.equal(role.rolcreaterole,false);assert.equal(role.rolbypassrls,false);
await db.query("SET TIME ZONE 'UTC'");
for(const expected of ${JSON.stringify(proof.tables.filter(t=>t.schema==='public'&&!['auth_sessions','sessions'].includes(t.table)))}){
console.log('WC_CHECK '+expected.table);
const value=(await db.query(${JSON.stringify("SELECT count(*)::int AS rows, md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(row_to_json(t)::text) AS h FROM \"public\".\"")}+expected.table+${JSON.stringify('" t) v')})).rows[0];assert.equal(value.rows,expected.rows);assert.equal(value.digest,expected.digest);}
const sessions=(await db.query('SELECT (SELECT count(*) FROM auth_sessions)+(SELECT count(*) FROM sessions) AS total')).rows[0];assert.equal(Number(sessions.total),0);
assert.equal(process.env.DISABLE_OUTBOUND_EMAIL,'1');assert.equal(process.env.DAILY_EMAIL_SCHEDULER_ENABLED,'0');assert.equal(process.env.APP_ENV,'production');assert.equal(process.env.STAGING_ACCESS_CODE,undefined);
}finally{await db.end();}`;
  }
  if (command === 'files') {
    if (!state.filesRestored) throw new Error('Restore files first');
    const verifier = fs.readFileSync(path.join(root, 'scripts/bible-study-assets.mjs')).toString('base64');
    code += `const {verifyAssets}=await import('data:text/javascript;base64,${verifier}');assert.deepEqual(verifyAssets(process.env.BIBLE_STUDY_DIR),${JSON.stringify(proof.assets)});
const inventory=[];function walk(dir){for(const n of fs.readdirSync(dir).sort()){if(dir==='/data'&&n==='.bible-study')continue;const f=path.join(dir,n),s=fs.lstatSync(f);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())walk(f);else if(s.isFile())inventory.push({file:path.relative('/data',f),sha256:digest(fs.readFileSync(f))});else throw Error('Unsupported file');}}walk('/data');assert.deepEqual(inventory,${JSON.stringify(proof.uploads)});`;
  }
  if (command === 'legacy') {
    if (!state.dataVerified) throw new Error('Verify restored data before source reconciliation');
    const prepared = JSON.parse(unseal(fs.readFileSync(preparedFile), key));
    const rehearsal = JSON.parse(fs.readFileSync(path.join(directory, 'latest-source-rehearsal.json')));
    if (!rehearsal.ready || rehearsal.sourceExportedAt !== prepared.sourceExportedAt) throw new Error('Matching successful rehearsal required');
    if (state.legacyImportAttempted) throw new Error('Inspect attempted import before retrying');
    state.legacyImportAttempted = new Date().toISOString();
    save();
    code += `import {importPrepared,verifyImported} from '/app/scripts/im-bible-writer.mjs';const prepared=${JSON.stringify(prepared)};
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});try{
const plan=await importPrepared(db,prepared,{dryRun:true});assert.equal(plan.ready,true);assert.equal(plan.issues.length,0);
const result=await importPrepared(db,prepared,{dryRun:false});assert.equal(result.committed,true);
const verification=await verifyImported(db,prepared);assert.equal(verification.mismatches,0);assert.equal(verification.editedNotes,0);
const replay=await importPrepared(db,prepared,{dryRun:false});assert.equal(replay.replay,true);assert.equal(replay.counts['note:insert']||0,0);
}finally{await db.end();}`;
    state.legacyPreparedSha256 = hash(fs.readFileSync(preparedFile));
    state.legacySourceExportedAt = prepared.sourceExportedAt;
  }
  if (command === 'smoke') {
    code += `for(const pathname of ['/','/learn/bible','/learn/church-reading','/learn/my-notes','/share','/groups','/login']){
const response=await fetch('http://127.0.0.1:8080'+pathname,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);const html=await response.text();assert(html.includes('id="root"'));assert(html.includes('type="module"'));}
for(const pathname of ['/api/auth/user','/api/devotional-notes','/api/users']){const response=await fetch('http://127.0.0.1:8080'+pathname,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,401);}
const health=await fetch('http://127.0.0.1:8080/__healthcheck');assert.equal(health.status,200);
const options=await(await fetch('http://127.0.0.1:8080/api/auth/options')).json();assert.equal(options.google,true);
const manifest=JSON.parse(fs.readFileSync('/app/release-manifest.json'));assert.equal(manifest.fingerprint,${JSON.stringify(state.fingerprint)});assert.equal(digest(JSON.stringify(manifest.files)),manifest.fingerprint);for(const file of manifest.files)assert.equal(digest(fs.readFileSync(path.join('/app',file.file))),file.sha256);
assert.equal(process.env.PUBLIC_BASE_URL,'https://www.wechurch.online');assert.equal(process.env.GOOGLE_CALLBACK_URL,'https://www.wechurch.online/api/callback');`;
  }
  if (command === 'privacy') {
    if (!state.legacyVerified || !state.smokeVerified) throw new Error('Import and internal smoke verification required');
    if (!/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(state.preview || '')) throw new Error('Verified public preview required');
    code += `import {randomUUID,createHmac} from 'node:crypto';
const preview=${JSON.stringify(state.preview)};
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const actors=[0,1].map(i=>({id:randomUUID(),auth:randomUUID(),note:randomUUID(),sid:'cutover-proof-'+randomUUID(),email:'cutover-'+randomUUID()+'@example.test'}));
const expire=new Date(Date.now()+300000);
let privacyPhase='fixture_insert',privacyFailure;
const phase=name=>{privacyPhase=name;console.log('WC_CHECK '+name);};
const client=async(actor,url,method='GET',body)=>{
const signature=createHmac('sha256',process.env.SESSION_SECRET).update(actor.sid).digest('base64').replace(/=+$/,'');
return fetch(preview+url,{method,headers:{Cookie:'connect.sid='+encodeURIComponent('s:'+actor.sid+'.'+signature),Origin:preview,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});};
try{
assert.equal(process.env.DISABLE_OUTBOUND_EMAIL,'1');
for(const a of actors){
await db.query('INSERT INTO users(id,email,display_name,church) VALUES($1,$2,$3,$4)',[a.id,a.email,'Cutover privacy fixture','IM 行動教會']);
await db.query('INSERT INTO auth_users(id,email,first_name) VALUES($1,$2,$3)',[a.auth,a.email,'Cutover fixture']);
await db.query('INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,observation) VALUES($1,$2,$3,$4,$5)',[a.note,a.id,'創世記 1:1','Synthetic scripture fixture','Synthetic private fixture']);
const sess={cookie:{originalMaxAge:300000,expires:expire.toISOString(),secure:true,httpOnly:true,sameSite:'lax',path:'/'},passport:{user:{claims:{sub:a.auth,email:a.email},sessionVersion:0,sessionUserId:a.id,expires_at:Math.floor(expire.getTime()/1000)}}};
await db.query('INSERT INTO auth_sessions(sid,sess,expire) VALUES($1,$2,$3)',[a.sid,sess,expire]);}
for(const a of actors){
phase('session_auth');
assert.equal((await client(a,'/api/auth/user')).status,200);
phase('own_note_list');
const notesResponse=await client(a,'/api/devotional-notes');assert.equal(notesResponse.status,200);const notes=await notesResponse.json();assert.equal(notes.length,1);assert.equal(notes[0].id,a.note);assert.equal(notes[0].userId,a.id);
phase('own_note_detail');
assert.equal((await client(a,'/api/devotional-notes/'+a.note)).status,200);
const other=actors.find(b=>b.id!==a.id);
phase('other_note_read');
assert.equal((await client(a,'/api/devotional-notes/'+other.note)).status,404);
phase('other_note_delete');
assert.equal((await client(a,'/api/devotional-notes/'+other.note,'DELETE',{version:1})).status,404);
phase('crm_forbidden');
assert.equal((await client(a,'/api/users')).status,403);
phase('history_private');
const history=await client(a,'/api/im-reading-history');assert.equal(history.status,200);assert.deepEqual(await history.json(),[]);
}
assert.equal(Number((await db.query('SELECT count(*) AS total FROM devotional_notes WHERE id=ANY($1::uuid[])',[actors.map(a=>a.note)])).rows[0].total),2);
}catch(error){privacyFailure={error,phase:privacyPhase};}finally{
console.log('WC_CHECK fixture_cleanup');
await db.query('BEGIN');
try{
await db.query('DELETE FROM auth_sessions WHERE sid=ANY($1::text[])',[actors.map(a=>a.sid)]);
await db.query('DELETE FROM devotional_notes WHERE id=ANY($1::uuid[]) AND user_id=ANY($2::uuid[])',[actors.map(a=>a.note),actors.map(a=>a.id)]);
await db.query('DELETE FROM auth_users WHERE id=ANY($1::text[]) AND email=ANY($2::text[])',[actors.map(a=>a.auth),actors.map(a=>a.email)]);
await db.query('DELETE FROM users WHERE id=ANY($1::uuid[]) AND email=ANY($2::text[])',[actors.map(a=>a.id),actors.map(a=>a.email)]);
await db.query('COMMIT');
assert.equal(Number((await db.query('SELECT count(*) AS total FROM users WHERE id=ANY($1::uuid[])',[actors.map(a=>a.id)])).rows[0].total),0);
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}}
if(privacyFailure){console.log('WC_CHECK '+privacyFailure.phase);throw privacyFailure.error;}
`;
  }
  if (spawnSync(process.execPath, ['--input-type=module', '--check'], {input: code}).status !== 0) throw new Error('Generated verifier syntax invalid');
  await sendReplacementFile(state, 'app', Buffer.from(code), file => `node --input-type=module < ${file}`);
  state[`${command}Verified`] = new Date().toISOString();
  save();
  console.log(JSON.stringify({verified: command, memberContentsNotLogged: true, originalAAndBUnchanged: true}));
} catch (error) {
  console.error(JSON.stringify({errorType: error.name, check: /^[a-z_]+$/.test(error.check || '') ? error.check : undefined}));
  console.error('Production verification stopped; inspect private state without logging member content.');
  process.exitCode = 1;
} finally {key.fill(0);}
