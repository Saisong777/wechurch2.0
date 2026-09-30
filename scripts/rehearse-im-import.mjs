import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { readBackupKey,unseal,hash } from './backup-envelope.mjs';
import { root,target } from './railway-staging.mjs';
import { importPrepared,rollbackBatch,verifyImported } from './im-bible-writer.mjs';

const name=`im_restore_${randomUUID().replaceAll('-','')}`;
let pool,key,started=false;
try {
  const [preparedFile,manifestFile]=process.argv.slice(2);
  assert(preparedFile&&manifestFile&&process.argv.length===4);
  key=readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
  const prepared=JSON.parse(unseal(fs.readFileSync(preparedFile),key).toString());
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.environment,target.environment);assert.equal(manifest.complete,true);
  const entry=manifest.files.find(f=>f.name==='database.dump.enc');
  const bytes=fs.readFileSync(path.join(path.dirname(manifestFile),entry.name));
  assert.equal(hash(bytes),entry.sha256);
  const dump=unseal(bytes,key);
  execFileSync('docker',['image','inspect','postgres:17-alpine'],{stdio:'ignore'});
  execFileSync('docker',['run','-d','--rm','--name',name,'-e','POSTGRES_PASSWORD=postgres','-p','127.0.0.1::5432','postgres:17-alpine'],{stdio:'ignore'});started=true;
  for(let i=0;i<60;i++) {
    try {execFileSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'ignore'});break;}
    catch {await new Promise(resolve=>setTimeout(resolve,500));}
  }
  const port=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
  execFileSync('docker',['exec','-i',name,'pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','postgres','-d','postgres'],{input:dump,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024,timeout:180000});
  pool=new pg.Pool({connectionString:`postgresql://postgres:postgres@127.0.0.1:${port}/postgres`});
  const journal=JSON.parse(fs.readFileSync(path.join(root,'migrations/meta/_journal.json'),'utf8')).entries;
  for(const migration of journal) {
    const sql=fs.readFileSync(path.join(root,'migrations',`${migration.tag}.sql`),'utf8');
    const sha=createHash('sha256').update(sql).digest('hex');
    const applied=(await pool.query('SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=$1',[migration.when])).rows[0];
    if(applied){assert.equal(applied.hash,sha);continue;}
    const c=await pool.connect();
    try {await c.query('BEGIN');await c.query(sql);await c.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)',[sha,migration.when]);await c.query('COMMIT');}
    finally {await c.query('ROLLBACK');c.release();}
  }
  const existingUsers=(await pool.query('SELECT id FROM users')).rows.map(r=>r.id);
  const originalRows=(await pool.query('SELECT to_jsonb(u) AS row FROM users u WHERE id=ANY($1)',[existingUsers])).rows;
  const originalRoles=(await pool.query('SELECT user_id,role FROM user_roles ORDER BY user_id,role')).rows;
  const dry=await importPrepared(pool,prepared);assert.equal(dry.ready,true);
  const written=await importPrepared(pool,prepared,{dryRun:false});assert.equal(written.committed,true);
  assert.equal((await verifyImported(pool,prepared)).mismatches,0);
  assert.equal((await importPrepared(pool,prepared,{dryRun:false})).replay,true);
  assert.deepEqual((await pool.query('SELECT to_jsonb(u) AS row FROM users u WHERE id=ANY($1)',[existingUsers])).rows,originalRows);
  assert.deepEqual((await pool.query('SELECT user_id,role FROM user_roles ORDER BY user_id,role')).rows,originalRoles);
  await rollbackBatch(pool,written.batchId);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM im_source_records WHERE batch_id=$1',[written.batchId])).rows[0].n,0);
  assert.equal((await importPrepared(pool,prepared,{dryRun:false})).committed,true);
  const receipt={at:new Date().toISOString(),restored:true,backupSha256:entry.sha256,bundleSha256:prepared.bundle.bundleSha256,
    writerSha256:hash(fs.readFileSync(new URL('./im-bible-writer.mjs',import.meta.url))),
    verification:await verifyImported(pool,prepared),replay:true,rollback:true,reimport:true,existingUsersAndRolesPreserved:true,productionUntouched:true};
  const receiptFile=path.join(path.dirname(manifestFile),`im-import-rehearsal-${Date.now()}.json`);
  fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({...receipt,receiptFile}));
} catch {console.error('Isolated migration rehearsal failed; private source data not printed.');process.exitCode=1;}
finally {await pool?.end();if(started)execFileSync('docker',['stop',name],{stdio:'ignore'});key?.fill(0);}
