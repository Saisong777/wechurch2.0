// B-only recovery set: transactional DB, private uploads, settings and pinned reference assets.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inspectStaging, railway, root, target, verifyRemoteBibleAssets } from '../scripts/railway-staging.mjs';
import { verifyAssets } from '../scripts/bible-study-assets.mjs';
import { readBackupKey, seal, unseal, hash } from '../scripts/backup-envelope.mjs';

export async function tableProof(client) {
  await client.query("SET TIME ZONE 'UTC'");
  const tables = (await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname,tablename")).rows;
  const proof = [];
  for (const {schemaname,tablename} of tables) {
    if (!/^[a-z_][a-z0-9_]*$/.test(schemaname) || !/^[a-z_][a-z0-9_]*$/.test(tablename)) throw new Error('Unexpected table name');
    const value = (await client.query(`SELECT count(*)::int AS rows, md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(row_to_json(t)::text) AS h FROM "${schemaname}"."${tablename}" t) v`)).rows[0];
    proof.push({schema:schemaname,table:tablename,...value});
  }
  return proof;
}

async function main() {
  process.umask(0o077);
  const destination = fs.realpathSync(process.env.WECHURCH_BACKUP_DIR || '');
  if (!path.isAbsolute(destination) || !path.relative(root,destination).startsWith('../')) throw new Error('Backup must be outside checkout');
  const state = inspectStaging();
  if (state.app.UPLOAD_ROOT !== '/data') throw new Error('Unexpected volume');
  const assets = verifyAssets(path.join(root,'bible-study-data'));
  if (JSON.stringify(verifyRemoteBibleAssets(state.app.BIBLE_STUDY_DIR)) !== JSON.stringify(assets)) throw new Error('Reference assets not active');
  const directory = path.join(destination,`b-recovery-${Date.now()}`);
  fs.mkdirSync(directory,{mode:0o700});
  const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
  const client = new pg.Client({connectionString:state.database.DATABASE_PUBLIC_URL,connectionTimeoutMillis:10000});
  const manifest = {format:2,environment:target.environment,createdAt:new Date().toISOString(),referenceRelease:assets.releaseId,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:[],complete:false};
  const save = (name,bytes) => {
    const encrypted = seal(bytes,key);
    if (hash(unseal(encrypted,key)) !== hash(bytes)) throw new Error('Encryption verification failed');
    const file = `${name}.enc`;
    fs.writeFileSync(path.join(directory,file),encrypted,{flag:'wx',mode:0o600});
    if (hash(fs.readFileSync(path.join(directory,file))) !== hash(encrypted)) throw new Error('Disk readback failed');
    manifest.files.push({name:file,bytes:encrypted.length,sha256:hash(encrypted)});
  };
  const remote = (service,command,limit=32*1024*1024) => {
    try { return railway(['ssh','-p',target.project,'-e',target.environment,'-s',service,'--','sh','-c',`'${command.replaceAll("'", "'\\''")}'`],{maxBuffer:limit,timeout:180000}); }
    catch { throw new Error('B backup transport failed; no partial backup is marked complete'); }
  };
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    if (!/^[0-9A-F-]+$/.test(snapshot)) throw new Error('Invalid snapshot id');
    const tables = await tableProof(client);
    const id = randomUUID();
    const temp = `/tmp/wechurch-recovery-${id}.dump`;
    const dump = Buffer.from(remote(target.database,`trap 'rm -f ${temp}' EXIT; pg_dump --snapshot=${snapshot} -U "$PGUSER" -d "$PGDATABASE" -Fc -f ${temp} && pg_restore -l ${temp} >/dev/null && base64 ${temp}`).replace(/\s/g,''),'base64');
    if (dump.subarray(0,5).toString() !== 'PGDMP') throw new Error('Invalid DB dump');
    save('database.dump',dump);
    await client.query('COMMIT');
    console.log('Consistent B database snapshot encrypted and verified.');
    const inventoryCode = `const fs=require('fs'),p=require('path'),c=require('crypto');const result=[];function walk(dir){for(const n of fs.readdirSync(dir).sort()){if(dir==='/data'&&n==='.bible-study')continue;const f=p.join(dir,n),s=fs.lstatSync(f);if(s.isSymbolicLink())throw Error('Links rejected');if(s.isDirectory())walk(f);else if(s.isFile())result.push({file:p.relative('/data',f),sha256:c.createHash('sha256').update(fs.readFileSync(f)).digest('hex')});else throw Error('Unsupported file');}}walk('/data');console.log(JSON.stringify(result));`;
    const inventoryCommand = `node -e 'eval(Buffer.from("${Buffer.from(inventoryCode).toString('base64')}","base64").toString())'`;
    const before = JSON.parse(remote(target.app,inventoryCommand));
    const archive = `/tmp/wechurch-recovery-${id}.tgz`;
    const uploads = Buffer.from(remote(target.app,`trap 'rm -f ${archive}' EXIT; tar --exclude='./.bible-study' -czf ${archive} -C /data . && tar -tzf ${archive} >/dev/null && base64 ${archive}`,128*1024*1024).replace(/\s/g,''),'base64');
    const after = JSON.parse(remote(target.app,inventoryCommand));
    if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Uploads changed during backup; retry required');
    save('uploads.tgz',uploads);
    save('settings.json',Buffer.from(JSON.stringify({app:state.app,database:state.database})));
    save('proof.json',Buffer.from(JSON.stringify({tables,uploads:before,assets,snapshot,productionDeployment:state.productionDeployment})));
    const reference = execFileSync('tar',['-czf','-','-C',path.join(root,'bible-study-data'),'SHA256SUMS',...assets.files.map(f=>f.file)],{maxBuffer:512*1024*1024,timeout:180000,env:{...process.env,COPYFILE_DISABLE:'1'}});
    save('reference.tgz',reference);
    manifest.complete=true;
    fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify({complete:true,directory,encryptedFiles:manifest.files.length,referenceRelease:assets.releaseId,productionUnchanged:true}));
  } finally {key.fill(0);await client.end();}
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main().catch(()=>{console.error('Recovery backup did not complete. Inspect only sanitized progress; partial folders are not valid backups.');process.exitCode=1;});
