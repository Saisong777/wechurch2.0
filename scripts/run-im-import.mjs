import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { inspectStaging, root, target } from './railway-staging.mjs';
import { readBackupKey, unseal, seal, hash } from './backup-envelope.mjs';
import { importPrepared, readTarget, verifyImported, rollbackBatch, ImportError } from './im-bible-writer.mjs';

let pool,key;
try {
  const [command,input,confirmation]=process.argv.slice(2);
  if(!['dry-run','import','verify','rollback'].includes(command) || !input || process.argv.length>5)throw new Error('INVALID_ARGS');
  key=readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
  const prepared=JSON.parse(unseal(fs.readFileSync(input),key).toString('utf8'));
  const state=inspectStaging();
  if(state.app.APP_ENV!=='staging' || state.app.DISABLE_OUTBOUND_EMAIL!=='1' || state.app.DISABLE_MORNING_BRIEF!=='1')throw new Error('STAGING_SAFETY');
  const directory=fs.realpathSync(process.env.WECHURCH_IMPORT_AUDIT_DIR||'');
  if(!path.relative(root,directory).startsWith(`..${path.sep}`) || (fs.statSync(directory).mode&0o077)!==0)throw new Error('PRIVATE_AUDIT_DIRECTORY_REQUIRED');
  const backupPath=process.env.WECHURCH_BACKUP_MANIFEST;
  if(['import','rollback'].includes(command)) {
    if(command==='import' && confirmation!==prepared.bundle.bundleSha256)throw new Error('BUNDLE_CONFIRMATION_REQUIRED');
    const manifest=JSON.parse(fs.readFileSync(backupPath,'utf8'));
    const age=Date.now()-Date.parse(manifest.createdAt);
    if(!manifest.complete || manifest.environment!==target.environment || !Number.isFinite(age) || age<0 || age>3600000)throw new Error('FRESH_BACKUP_REQUIRED');
    for(const entry of manifest.files) {
      if(!['database.dump.enc','uploads.tgz.enc','settings.json.enc'].includes(entry.name))throw new Error('INVALID_BACKUP');
      const bytes=fs.readFileSync(path.join(path.dirname(backupPath),entry.name));
      if(hash(bytes)!==entry.sha256)throw new Error('BACKUP_HASH');
      unseal(bytes,key);
    }
    if(manifest.files.length!==3)throw new Error('INCOMPLETE_BACKUP');
    if(command==='import') {
      const proof=JSON.parse(fs.readFileSync(process.env.WECHURCH_IMPORT_REHEARSAL||path.join(path.dirname(backupPath),'im-import-rehearsal.json'),'utf8'));
      if(proof.backupSha256!==manifest.files.find(f=>f.name==='database.dump.enc').sha256 ||
        proof.bundleSha256!==prepared.bundle.bundleSha256 || !proof.restored || !proof.replay || !proof.rollback ||
        !proof.existingUsersAndRolesPreserved || proof.verification?.mismatches!==0 ||
        proof.writerSha256!==hash(fs.readFileSync(new URL('./im-bible-writer.mjs',import.meta.url))))throw new Error('RESTORE_REHEARSAL_REQUIRED');
    }
  }
  pool=new pg.Pool({connectionString:state.database.DATABASE_PUBLIC_URL,max:2});
  const metadata=await readTarget(pool);
  const audit=path.join(directory,`im-${command}-${Date.now()}`);
  fs.writeFileSync(`${audit}-before.enc`,seal(Buffer.from(JSON.stringify(metadata)),key),{flag:'wx',mode:0o600});
  let result;
  if(command==='verify')result=await verifyImported(pool,prepared);
  else if(command==='rollback') {
    if(!/^[a-f0-9-]{36}$/.test(confirmation||''))throw new Error('BATCH_ID_REQUIRED');
    result=await rollbackBatch(pool,confirmation);
  } else result=await importPrepared(pool,prepared,{dryRun:command!=='import'});
  const receipt={at:new Date().toISOString(),environment:target.environment,sourceExportedAt:prepared.sourceExportedAt,
    bundleSha256:prepared.bundle.bundleSha256,productionDeployment:state.productionDeployment,command,result};
  fs.writeFileSync(`${audit}-receipt.json`,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify(receipt));
  if(result.ready===false || result.mismatches>0)process.exitCode=2;
} catch(error) {
  console.error(error instanceof ImportError?error.code:'Import operation failed; no private data printed. Check the private inputs, B guard, backup and schema.');
  process.exitCode=1;
} finally {await pool?.end();key?.fill(0);}
