import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
if(!Array.isArray(manifest.files)||!manifest.files.length||manifest.fingerprint!==sha(JSON.stringify(manifest.files)))throw new Error('Invalid release manifest');
const seen=new Set();
for(const entry of manifest.files){
  if(typeof entry.file!=='string'||!entry.file||path.isAbsolute(entry.file)||entry.file.split('/').some(p=>p==='..'||p==='.')||/[\x00-\x1f\\]/.test(entry.file)||seen.has(entry.file)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw new Error('Unsafe or duplicate manifest entry');
  seen.add(entry.file);
  const source=path.join(root,entry.file);
  if(!fs.lstatSync(source).isFile()||sha(fs.readFileSync(source))!==entry.sha256)throw new Error(`Checkpoint mismatch: ${entry.file}`);
}
console.log(JSON.stringify({verified:true,files:seen.size,fingerprint:manifest.fingerprint,dataBackupIncluded:false}));
