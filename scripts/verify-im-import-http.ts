import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { prepareImportBundle } from './im-bible-import-plan.mjs';
import { importPrepared, rollbackBatch, verifyImported } from './im-bible-writer.mjs';
import { SOURCE_PROJECT, sha256 } from './im-bible-migration.mjs';
import { resolveGoogleIdentity } from '../server/googleIdentityRepository';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
export async function verifyImImportHttp(pool: Pool,a: Client,b: Client,guest: Client,ids: string[]) {
  const members=[];
  for(let index=0;index<2;index++) {
    const user=(await pool.query('SELECT email FROM users WHERE id=$1',[ids[index]])).rows[0];
    const auth=(await pool.query('SELECT id FROM auth_users WHERE email=$1',[user.email])).rows[0];
    const subject=`941000${index}`;
    await pool.query('INSERT INTO google_account_links(google_subject,user_id,auth_user_id) VALUES ($1,$2,$3)',[subject,ids[index],auth.id]);
    members.push({uid:`fixture-${index}`,email:user.email,name:'Synthetic import',emailVerified:true,disabled:false,providerData:[{providerId:'google.com',uid:subject}]});
  }
  const source={format:'wechurch-im-bible-source-v2',projectId:SOURCE_PROJECT,exportedAt:'2026-09-24T12:00:00Z',
    scope:{auth:'all-default-tenant-users',firestore:'collection-group:data',firestoreReadTime:'2026-09-24T12:00:00Z'},
    planSource:{commit:'a'.repeat(40),content:'test',sha256:sha256('test')},members,
    documents:members.map((member,index)=>({name:`projects/${SOURCE_PROJECT}/databases/(default)/documents/users/${member.uid}/data/main`,
      fields:{notes:{mapValue:{fields:{'july-0':{stringValue:`  PRIVATE-${index}\n原文不變  `}}}},readDays:{arrayValue:{values:[{stringValue:'july-0'}]}}}}))};
  const calendar={format:'wechurch-im-bible-calendar-v1',sourceCommit:source.planSource.commit,sourceSha256:source.planSource.sha256,
    reviewedBy:'Synthetic',reviewedOn:'2026-09-24',entries:[{key:'july-0',date:'2026-07-01',reference:'約翰福音 1',planTitle:'Synthetic calendar'}]};
  const prepared={format:'wechurch-im-bible-prepared-v1',sourceExportedAt:source.exportedAt,calendar,bundle:prepareImportBundle(source,calendar).bundle};
  const beforeRoles=(await pool.query('SELECT user_id,role FROM user_roles ORDER BY user_id,role')).rows;
  const dry=await importPrepared(pool,prepared);assert.equal(dry.ready,true);assert.equal(dry.committed,false);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_source_records')).rows[0].n,0);
  await pool.query(`CREATE FUNCTION fail_import_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.observation LIKE '%PRIVATE-1%' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_import_fixture BEFORE INSERT ON devotional_notes FOR EACH ROW EXECUTE FUNCTION fail_import_fixture()`);
  const failedSource=structuredClone(source);
  failedSource.members.push({uid:'new-fixture',email:'new-import@example.test',name:'Synthetic new member',emailVerified:true,disabled:false,providerData:[{providerId:'google.com',uid:'9410009'}]});
  const usersBefore=(await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  await assert.rejects(importPrepared(pool,{...prepared,bundle:prepareImportBundle(failedSource,calendar).bundle},{dryRun:false}));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n,usersBefore);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_source_accounts')).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_import_batches')).rows[0].n,0);
  await pool.query('DROP TRIGGER fail_import_fixture ON devotional_notes; DROP FUNCTION fail_import_fixture()');
  const result=await importPrepared(pool,prepared,{dryRun:false});assert.equal(result.committed,true);
  assert.equal(result.verification.mismatches,0);
  assert.equal((await importPrepared(pool,prepared,{dryRun:false})).replay,true);
  assert.deepEqual((await pool.query('SELECT user_id,role FROM user_roles ORDER BY user_id,role')).rows,beforeRoles);
  for(const [index,client] of [a,b].entries()) {
    const identity=await resolveGoogleIdentity(pool,{provider:'google',id:members[index].providerData[0].uid,emails:[{value:members[index].email,verified:true}]});
    assert.equal(identity.userId,ids[index]);
    const notes=await (await client('/api/devotional-notes')).json();
    const mine=notes.find((n:{sourceLabel?: string})=>n.sourceLabel==='iM 讀經 App');
    assert.equal(mine.observation,`  PRIVATE-${index}\n原文不變  `);
    assert.equal(mine.sourceDevotionalDate,'2026-07-01');
    assert(!JSON.stringify(notes).includes(`PRIVATE-${1-index}`));
    const other=(await pool.query('SELECT note_id FROM im_source_records WHERE user_id=$1 AND kind=\'note\'',[ids[1-index]])).rows[0].note_id;
    assert.equal((await client(`/api/devotional-notes/${other}`)).status,404);
    assert.equal((await client(`/api/devotional-notes/${other}`,'PATCH',{observation:'not mine',version:1})).status,409);
    assert.equal((await client(`/api/devotional-notes/${other}/hidden`,'PATCH',{hidden:true})).status,404);
    const history=await (await client(`/api/im-reading-history?userId=${ids[1-index]}`)).json();
    assert.equal(history.length,1);assert.equal(history[0].date,'2026-07-01');
    assert.equal((await pool.query('SELECT user_id FROM user_reading_progress WHERE id=$1',[history[0].id])).rows[0].user_id,ids[index]);
  }
  assert.equal((await guest('/api/im-reading-history')).status,401);
  assert.equal((await guest('/api/devotional-notes')).status,401);
  const records=(await pool.query('SELECT * FROM im_source_records')).rows;
  assert.equal(records.length,4);
  const owned=records.find(r=>r.kind==='note'&&r.user_id===ids[0]);
  const shared=(await pool.query(`INSERT INTO devotion_wall_posts(source_note_id,user_id,published_day,title,body,reference,expires_at)
    VALUES ($1,$2,current_date,'Synthetic','Explicit synthetic excerpt','John 1',now()+interval '1 day') RETURNING id`,[owned.note_id,ids[0]])).rows[0];
  await assert.rejects(rollbackBatch(pool,result.batchId),/SHARED_OR_REFERENCED_ROLLBACK_BLOCKED/);
  await pool.query('DELETE FROM devotion_wall_posts WHERE id=$1',[shared.id]);
  await rollbackBatch(pool,result.batchId);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_source_records')).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_source_accounts')).rows[0].n,2);
  const again=await importPrepared(pool,prepared,{dryRun:false});assert.equal(again.committed,true);
  const note=(await pool.query('SELECT n.* FROM devotional_notes n JOIN im_source_records r ON r.note_id=n.id WHERE r.user_id=$1',[ids[0]])).rows[0];
  await a(`/api/devotional-notes/${note.id}`,'PATCH',{observation:'Edited after migration',version:1});
  assert.equal((await importPrepared(pool,prepared,{dryRun:false})).replay,true);
  assert.equal((await pool.query('SELECT observation FROM devotional_notes WHERE id=$1',[note.id])).rows[0].observation,'Edited after migration');
  await assert.rejects(rollbackBatch(pool,again.batchId),/TARGET_CHANGED_ROLLBACK_BLOCKED/);
  const verification=await verifyImported(pool,prepared);assert.equal(verification.mismatches,0);assert.equal(verification.editedNotes,1);
  const newer=structuredClone(source);
  Object.assign(newer.documents[0],{updateTime:'2026-09-25T00:00:00Z'});
  const refreshed={...prepared,bundle:prepareImportBundle(newer,calendar).bundle};
  assert.equal((await importPrepared(pool,refreshed,{dryRun:false})).committed,true);
  assert.equal((await verifyImported(pool,refreshed)).mismatches,0);
  const changed=structuredClone(source);changed.documents[0].fields.notes.mapValue.fields['july-0'].stringValue='Source changed';
  assert.equal((await importPrepared(pool,{...prepared,bundle:prepareImportBundle(changed,calendar).bundle},{dryRun:false})).ready,false);
  const collision=structuredClone(source);collision.members[0].providerData[0].uid='999999999';
  assert.equal((await importPrepared(pool,{...prepared,bundle:prepareImportBundle(collision,calendar).bundle},{dryRun:false})).ready,false);
  console.log('PASS IM import: transaction rollback, replay, original dates/text, Google identity, owner-only HTTP, edit protection, safe batch reversal');
}
