import fs from 'node:fs';
import path from 'node:path';
import { inspectStaging, railway, root, target } from './railway-staging.mjs';
import { readBackupKey, seal, unseal, hash } from './backup-envelope.mjs';

// No key is generated or uploaded automatically. A restore requires this same key.
const key=readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
const destination=process.env.WECHURCH_BACKUP_DIR;
if(!destination||!path.isAbsolute(destination))throw new Error('Set WECHURCH_BACKUP_DIR to the approved encrypted backup destination');
const relative=path.relative(root,fs.realpathSync(destination));
if(!relative.startsWith(`..${path.sep}`))throw new Error('Durable backups must be outside the repository');
const state=inspectStaging();
if(state.app.UPLOAD_ROOT!=='/data'||state.app.RAILWAY_VOLUME_MOUNT_PATH!=='/data')throw new Error('Expected B upload volume is missing');
const stamp=Date.now(),directory=path.join(destination,`wechurch-b-${stamp}`);
fs.mkdirSync(directory,{mode:0o700});
const manifest={format:1,environment:target.environment,createdAt:new Date().toISOString(),files:[],complete:false};
const saveEncrypted=(name,bytes)=>{
  const encrypted=seal(bytes,key);
  if(hash(unseal(encrypted,key))!==hash(bytes))throw new Error('Backup encryption verification failed');
  const output=path.join(directory,`${name}.enc`);
  fs.writeFileSync(output,encrypted,{flag:'wx',mode:0o600});
  if(hash(fs.readFileSync(output))!==hash(encrypted))throw new Error('Encrypted backup readback failed');
  manifest.files.push({name:`${name}.enc`,sha256:hash(encrypted),bytes:encrypted.length});
};
try {
  const dumpName=`wechurch-sealed-${stamp}.dump`;
  const dbCommand=`trap 'rm -f /tmp/${dumpName}' EXIT; pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc -f /tmp/${dumpName} && pg_restore -l /tmp/${dumpName} >/dev/null && base64 /tmp/${dumpName}`;
  const dump=Buffer.from(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.database,'--','sh','-c',`'${dbCommand.replaceAll("'", "'\\''")}'`],{maxBuffer:128*1024*1024}).replace(/\s/g,''),'base64');
  if(dump.subarray(0,5).toString()!=='PGDMP')throw new Error('Invalid database archive');
  saveEncrypted('database.dump',dump);
  const fileName=`wechurch-sealed-${stamp}.tgz`;
  const uploadCommand=`trap 'rm -f /tmp/${fileName}' EXIT; tar -czf /tmp/${fileName} -C /data . && tar -tzf /tmp/${fileName} >/dev/null && base64 /tmp/${fileName}`;
  const uploads=Buffer.from(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.app,'--','sh','-c',`'${uploadCommand.replaceAll("'", "'\\''")}'`],{maxBuffer:128*1024*1024}).replace(/\s/g,''),'base64');
  if(uploads[0]!==0x1f||uploads[1]!==0x8b)throw new Error('Invalid upload archive');
  saveEncrypted('uploads.tgz',uploads);
  saveEncrypted('settings.json',Buffer.from(JSON.stringify({app:state.app,database:state.database})));
  manifest.complete=true;
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
  console.log('B database, uploads and settings encrypted and read back. Full restore and off-device durability must be verified separately.');
} finally { key.fill(0); }
