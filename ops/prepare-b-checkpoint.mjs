import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parse } from 'dotenv';
import { inspectStaging,railway,target } from '../scripts/railway-staging.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const branch=process.argv[2];
if(process.argv.length!==3||!/^codex\/b-checkpoint-\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+)?$/.test(branch||''))throw new Error('Provide a new codex/b-checkpoint-YYYY-MM-DD branch');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(args,input,env={})=>execFileSync('git',args,{cwd:root,input,encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,env:{...process.env,...env}}).trim();
const statusBefore=git(['status','--porcelain=v1','-uall']);
const base=git(['rev-parse','HEAD']);
const schema=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),files:z.array(z.object({file:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1)}).strict();
const release=JSON.parse(fs.readFileSync(path.join(root,'artifacts/railway-staging/release.json'),'utf8'));
const snapshot=fs.realpathSync(release.directory);
if(!snapshot.startsWith(fs.realpathSync(path.join(root,'artifacts/railway-staging'))+path.sep))throw new Error('Release must be an existing local staging snapshot');
const manifestBytes=fs.readFileSync(path.join(snapshot,'release-manifest.json'));
const manifest=schema.parse(JSON.parse(manifestBytes));
if(manifest.fingerprint!==sha(JSON.stringify(manifest.files))||manifest.fingerprint!==release.fingerprint)throw new Error('Release fingerprint mismatch');
const state=inspectStaging();
const deployment=JSON.parse(railway(['deployment','list','--service',target.app,'--environment',target.environment,'--json']))[0];
if(deployment?.status!=='SUCCESS')throw new Error('B must be successfully deployed before checkpointing');
const remote=schema.parse(JSON.parse(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.app,'--','cat','/app/release-manifest.json'])));
if(remote.fingerprint!==manifest.fingerprint)throw new Error('Snapshot does not match live B');
const entries=new Map();
function add(name,bytes){
  if(path.isAbsolute(name)||name.split('/').some(p=>p==='..'||p==='.')||/[\x00-\x1f\\]/.test(name)||entries.has(name))throw new Error('Unsafe or duplicate checkpoint path');
  if(/^(?:artifacts|uploads|exports|output|\.vite|public\/message-cards)\//.test(name)||/\.(?:dump|pem|key|sqlite3?|log)$/.test(name)||/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')throw new Error(`Private path excluded: ${name}`);
  entries.set(name,bytes);
}
for(const entry of manifest.files){
  if(path.isAbsolute(entry.file)||entry.file.split('/').includes('..')||/[\x00-\x1f\\]/.test(entry.file))throw new Error('Unsafe snapshot path');
  const source=path.join(snapshot,entry.file);
  if(!fs.lstatSync(source).isFile())throw new Error('Only regular files are allowed');
  const bytes=fs.readFileSync(source);
  if(sha(bytes)!==entry.sha256)throw new Error(`Snapshot changed: ${entry.file}`);
  add(entry.file,bytes);
}
add('release-manifest.json',manifestBytes);
for(const file of ['.gitignore','.env.example','ops/verify-b-checkpoint.mjs','ops/verify-b-checkpoint.test.mjs','ops/prepare-b-checkpoint.mjs','design/staging-encrypted-backup-2026-09-13.md','design/b-checkpoint-readme-2026-09-13.md','DESIGN.md','design/ui-ux-refresh-2026-09-13.md','ops/audit-ui-surfaces.mjs','ops/verify-together-ux.mjs'])add(file,fs.readFileSync(path.join(root,file)));
// Keep the committed CI unchanged; workflow updates require separate authorization.
add('.github/workflows/ci.yml',execFileSync('git',['show',`${base}:.github/workflows/ci.yml`],{cwd:root}));
add('README.md',fs.readFileSync(path.join(root,'design/b-checkpoint-readme-2026-09-13.md')));

// Compare values in memory only. Never print or store credential values.
const localSets=fs.readdirSync(root).filter(f=>/^\.env(?:\.|$)/.test(f)&&!f.endsWith('example')).map(f=>parse(fs.readFileSync(path.join(root,f))));
const secrets=[state.app,state.database,...localSets].flatMap(s=>Object.entries(s).filter(([key,value])=>/(?:SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_CODE|DATABASE.*URL)/.test(key)&&typeof value==='string'&&value.length>=12));
for(const [name,bytes]of entries){
  if(secrets.some(([,value])=>bytes.includes(Buffer.from(value))))throw new Error(`Credential match in ${name}`);
  if(!bytes.includes(0)&&/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,}|AKIA[A-Z0-9]{16})\b/.test(bytes.toString()))throw new Error(`Possible secret in ${name}`);
}
const evidence=path.join(root,'artifacts/railway-staging');
const scratch=fs.mkdtempSync(path.join(evidence,'git-checkpoint-'));
fs.chmodSync(scratch,0o700);
const env={GIT_INDEX_FILE:path.join(scratch,'index')};
git(['read-tree','--empty'],undefined,env);
const index=[];
for(const [name,bytes]of entries){
  // File-backed input avoids a stalled synchronous pipe for large binary assets.
  const blobFile=path.join(scratch,'blob');
  fs.writeFileSync(blobFile,bytes,{mode:0o600});
  const blob=git(['hash-object','-w','--',blobFile]);
  index.push(`100644 ${blob}\t${name}\n`);
}
git(['update-index','--index-info'],index.join(''),env);
const tree=git(['write-tree'],undefined,env);
const commit=git(['commit-tree',tree,'-p',base,'-m',`backup: checkpoint verified B ${deployment.id}\n\nRuntime fingerprint: ${manifest.fingerprint}\nNo database, uploads or secrets included.`]);
for(const entry of manifest.files){
  const bytes=execFileSync('git',['show',`${commit}:${entry.file}`],{cwd:root,maxBuffer:16*1024*1024});
  if(sha(bytes)!==entry.sha256)throw new Error('Git tree does not match B');
}
if(base!==git(['rev-parse','HEAD'])||statusBefore!==git(['status','--porcelain=v1','-uall']))throw new Error('Working tree changed during checkpoint; inspect before continuing');
git(['update-ref',`refs/heads/${branch}`,commit,'0000000000000000000000000000000000000000']);
const result={format:1,branch,commit,baseCommit:base,tree,deploymentId:deployment.id,fingerprint:manifest.fingerprint,runtimeFiles:manifest.files.length,checkpointFiles:entries.size,productionDeployment:state.productionDeployment,pushed:false,createdAt:new Date().toISOString()};
fs.writeFileSync(path.join(evidence,'github-checkpoint.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(result));
