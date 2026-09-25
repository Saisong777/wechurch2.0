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

let phase='manifest';
async function main() {
  process.umask(0o077);
  const directory=fs.realpathSync(process.argv[2]);
  assert(path.relative(root,directory).startsWith('../'));
  const fileSchema=z.object({name:z.enum(['database.dump.enc','uploads.tgz.enc','settings.json.enc','proof.json.enc','reference.tgz.enc']),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive()}).strict();
  const manifest=z.object({format:z.literal(2),environment:z.literal(target.environment),createdAt:z.string().datetime(),referenceRelease:z.string(),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),files:z.array(fileSchema).length(5),complete:z.literal(true)}).strict().parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))));
  assert.equal(new Set(manifest.files.map(f=>f.name)).size,5);
  const restore=path.join(path.dirname(directory),`restore-${randomUUID()}`);
  fs.mkdirSync(restore,{mode:0o700});
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
  assert.equal(settings.app.DATABASE_URL,settings.database.DATABASE_URL);
  for(const kind of ['uploads','reference']){phase=`extract ${kind}`;execFileSync('python3',['ops/extract-recovery-archive.py',path.join(restore,`${kind}.tgz`),path.join(restore,kind)],{cwd:root,stdio:'pipe'});}
  phase='reference assets';
  assert.deepEqual(verifyAssets(path.join(restore,'reference')),proof.assets);
  const inventory=[];
  function walk(dir){for(const name of fs.readdirSync(dir).sort()){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isDirectory())walk(p);else{assert(s.isFile());inventory.push({file:path.relative(path.join(restore,'uploads'),p),sha256:hash(fs.readFileSync(p))});}}}
  phase='upload inventory';
  walk(path.join(restore,'uploads'));assert.deepEqual(inventory,proof.uploads);
  const container=`wechurch_restore_${randomUUID().replaceAll('-','')}`;
  const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,...options});
  phase='local restore container';
  docker(['image','inspect','postgres:17-alpine']);
  docker(['run','-d','--rm','--name',container,'-e','POSTGRES_PASSWORD=restore-test','-p','127.0.0.1::5432','postgres:17-alpine']);
  let db;
  try {
    let ready=false;for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
    assert(ready);
    const port=JSON.parse(docker(['inspect',container]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
    phase='database restore';
    docker(['exec','-i',container,'pg_restore','--exit-on-error','--no-owner','--no-privileges','-h','127.0.0.1','-U','postgres','-d','postgres'],{input:fs.readFileSync(path.join(restore,'database.dump'))});
    db=new pg.Client({connectionString:`postgresql://postgres:restore-test@127.0.0.1:${port}/postgres`});await db.connect();
    phase='table digests';
    assert.deepEqual(await tableProof(db),proof.tables);
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
    const result={verifiedAt:new Date().toISOString(),manifestSha256:hash(fs.readFileSync(path.join(directory,'manifest.json'))),restoredTables:proof.tables.length,allTableContentDigestsMatch:true,uploadHashesMatch:true,checkedUploadReferences:references,referenceAssetsMatch:true,settingsIdentityMatch:true,restoreDirectory:restore,productionUntouched:true};
    fs.writeFileSync(path.join(directory,'restore-verification.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(result));
  }finally{if(db)await db.end();docker(['stop',container]);}
}
main().catch(error=>{console.error(JSON.stringify({verified:false,phase,errorType:error.name,productionAndStagingUntouched:true}));process.exitCode=1;});
