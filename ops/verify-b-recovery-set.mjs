import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { z } from 'zod';
import { readBackupKey,unseal,hash } from '../scripts/backup-envelope.mjs';
import { root,target } from '../scripts/railway-staging.mjs';
import { verifyAssets } from '../scripts/bible-study-assets.mjs';
import { tableProof } from './seal-b-recovery-set.mjs';

const tableProofSchema=z.array(z.object({
  schema:z.enum(['public','drizzle']),
  table:z.string().regex(/^[a-z_][a-z0-9_]*$/),
  rows:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  digest:z.string().regex(/^[a-f0-9]{32}$/),
}).strict());

function proofByTable(value) {
  const tables=new Map();
  for(const entry of tableProofSchema.parse(value)) {
    const name=`${entry.schema}.${entry.table}`;
    if(tables.has(name))throw new Error('Duplicate table in recovery proof');
    tables.set(name,entry);
  }
  return tables;
}

export function assertTableProofMatches(actual,expected) {
  const restored=proofByTable(actual),saved=proofByTable(expected);
  // Table order is presentation, not evidence: pg_catalog name and text collations differ.
  const names=[...new Set([...saved.keys(),...restored.keys()])].sort();
  const mismatches=[];
  for(const table of names) {
    const a=restored.get(table),e=saved.get(table);
    if(!a||!e||a.rows!==e.rows||a.digest!==e.digest) {
      mismatches.push({table,expectedRows:e?.rows??null,actualRows:a?.rows??null,expectedHash:e?.digest??null,actualHash:a?.digest??null});
    }
  }
  if(mismatches.length) {
    const error=new Error('Restored table content does not match recovery proof');
    error.name='TableProofMismatchError';
    error.tableMismatches=mismatches;
    throw error;
  }
}

export async function withDisposableRestore(parent,verify) {
  const restore=path.join(fs.realpathSync(parent),`restore-${randomUUID()}`);
  fs.mkdirSync(restore,{mode:0o700});
  const owned=fs.lstatSync(restore);
  let result,failure;
  try { result=await verify(restore); }
  catch(error) { failure=error instanceof Error?error:new Error('Restore verification failed'); }
  try {
    let current;
    try { current=fs.lstatSync(restore); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    if(current) {
      // Never recurse into a replacement directory or link at the generated path.
      assert(current.isDirectory()&&!current.isSymbolicLink()&&current.dev===owned.dev&&current.ino===owned.ino);
      fs.rmSync(restore,{recursive:true,force:false});
    }
    let removed=false;
    try { fs.lstatSync(restore); }
    catch(error) { if(error.code!=='ENOENT')throw error;removed=true; }
    assert(removed);
  } catch {
    const error=new Error('Temporary restore plaintext cleanup failed');
    error.name='RestoreCleanupError';
    error.temporaryPlaintextRemoved=false;
    throw error;
  }
  if(failure) { failure.temporaryPlaintextRemoved=true;throw failure; }
  return {...result,temporaryPlaintextRemoved:true};
}

let phase='manifest';
async function main() {
  process.umask(0o077);
  const directory=fs.realpathSync(process.argv[2]);
  assert(path.relative(root,directory).startsWith('../'));
  const fileSchema=z.object({name:z.enum(['database.dump.enc','uploads.tgz.enc','settings.json.enc','proof.json.enc','reference.tgz.enc']),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive()}).strict();
  const manifest=z.object({format:z.literal(2),environment:z.literal(target.environment),createdAt:z.string().datetime(),referenceRelease:z.string(),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),files:z.array(fileSchema).length(5),complete:z.literal(true)}).strict().parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))));
  assert.equal(new Set(manifest.files.map(f=>f.name)).size,5);
  const result=await withDisposableRestore(path.dirname(directory),async restore=>{
  const key=readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
  let proof,settings;
  phase='decrypt';
  try {
    for(const file of manifest.files){
      const encrypted=fs.readFileSync(path.join(directory,file.name));
      assert.equal(encrypted.length,file.bytes);assert.equal(hash(encrypted),file.sha256);
      const bytes=unseal(encrypted,key);
      if(file.name==='settings.json.enc')settings=JSON.parse(bytes);
      else if(file.name==='proof.json.enc')proof=JSON.parse(bytes);
      else fs.writeFileSync(path.join(restore,file.name.slice(0,-4)),bytes,{flag:'wx',mode:0o600});
    }
  } finally {key.fill(0);}
  phase='settings identity';
  assert.equal(settings.app.APP_ENV,'staging');assert.equal(settings.app.RAILWAY_SERVICE_ID,target.app);
  assert.equal(settings.database.RAILWAY_SERVICE_ID,target.database);
  const appDatabase=new URL(settings.app.DATABASE_URL),ownerDatabase=new URL(settings.database.DATABASE_URL);
  assert.equal(appDatabase.host,ownerDatabase.host);assert.equal(appDatabase.pathname,ownerDatabase.pathname);
  assert(['wechurch_app',ownerDatabase.username].includes(appDatabase.username));
  for(const kind of ['uploads','reference']){phase=`extract ${kind}`;execFileSync('python3',['ops/extract-recovery-archive.py',path.join(restore,`${kind}.tgz`),path.join(restore,kind)],{cwd:root,stdio:'pipe'});}
  phase='reference assets';
  assert.deepEqual(verifyAssets(path.join(restore,'reference')),proof.assets);
  const inventory=[];
  function walk(dir){for(const name of fs.readdirSync(dir).sort()){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isDirectory())walk(p);else{assert(s.isFile());inventory.push({file:path.relative(path.join(restore,'uploads'),p),sha256:hash(fs.readFileSync(p))});}}}
  phase='upload inventory';
  walk(path.join(restore,'uploads'));assert.deepEqual(inventory,proof.uploads);
  const container=`wechurch_restore_${randomUUID().replaceAll('-','')}`;
  const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,...options});
  let db,containerAttempted=false;
  try {
    phase='local restore container';
    docker(['image','inspect','postgres:17-alpine']);
    containerAttempted=true;
    docker(['run','-d','--rm','--pull=never','--name',container,'-e','POSTGRES_PASSWORD=restore-test','-p','127.0.0.1::5432','postgres:17-alpine']);
    let ready=false;for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
    assert(ready);
    const port=JSON.parse(docker(['inspect',container]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
    phase='database restore';
    docker(['exec','-i',container,'pg_restore','--exit-on-error','--no-owner','--no-privileges','-h','127.0.0.1','-U','postgres','-d','postgres'],{input:fs.readFileSync(path.join(restore,'database.dump'))});
    db=new pg.Client({connectionString:`postgresql://postgres:restore-test@127.0.0.1:${port}/postgres`});await db.connect();
    phase='table digests';
    assertTableProofMatches(await tableProof(db),proof.tables);
    phase='upload references';
    let references=0;
    for(const {schema,table} of proof.tables){
      if(schema!=='public')continue;
      const rows=(await db.query(`SELECT row_to_json(t) AS value FROM "${schema}"."${table}" t`)).rows;
      const inspect=value=>{if(typeof value==='string'){
        for(const match of value.matchAll(/(?:https:\/\/wechurch-staging-staging\.up\.railway\.app)?\/uploads\/[^\s"'<>]+/g)){
          const pathname=new URL(match[0],target.origin).pathname;
          const relative=decodeURIComponent(pathname.slice('/uploads/'.length));
          const resolved=path.resolve(restore,'uploads',relative);
          assert(resolved.startsWith(path.join(restore,'uploads')+path.sep));
          assert(fs.existsSync(resolved),'Upload reference not present in restored files');references++;
        }
      }else if(value&&typeof value==='object')Object.values(value).forEach(inspect);};
      rows.forEach(row=>inspect(row.value));
    }
    return {verifiedAt:new Date().toISOString(),manifestSha256:hash(fs.readFileSync(path.join(directory,'manifest.json'))),restoredTables:proof.tables.length,allTableContentDigestsMatch:true,uploadHashesMatch:true,checkedUploadReferences:references,referenceAssetsMatch:true,settingsIdentityMatch:true,productionUntouched:true};
  }finally{
    try { if(db)await db.end(); }
    finally {
      if(containerAttempted) {
        try { docker(['stop',container]); }
        catch { docker(['rm','-f','-v',container]); }
      }
    }
  }
  });
  phase='verification record';
  fs.writeFileSync(path.join(directory,'restore-verification.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  main().catch(error=>{console.error(JSON.stringify({verified:false,phase:error.name==='RestoreCleanupError'?'temporary plaintext cleanup':phase,errorType:error.name,...(error.name==='TableProofMismatchError'?{tableMismatches:error.tableMismatches}:{}),temporaryPlaintextRemoved:error.temporaryPlaintextRemoved===true,productionAndStagingUntouched:true}));process.exitCode=1;});
}
