import fs from 'node:fs';
import path from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { inspectStaging,railway,root,target } from './railway-staging.mjs';
import { verifyAssets } from './bible-study-assets.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const snapshotSchema=z.object({fingerprint:sha,files:z.array(z.object({file:z.string(),sha256:sha}).strict())}).strict();
const release=JSON.parse(fs.readFileSync(path.join(root,'artifacts/railway-staging/release.json'),'utf8'));
const snapshot=snapshotSchema.parse(JSON.parse(fs.readFileSync(path.join(release.directory,'release-manifest.json'),'utf8')));
if(snapshot.fingerprint!==digest(JSON.stringify(snapshot.files))||snapshot.fingerprint!==release.fingerprint)throw new Error('Snapshot fingerprint mismatch');
for(const file of snapshot.files){
  if(path.isAbsolute(file.file)||file.file.split('/').includes('..'))throw new Error('Unsafe manifest path');
  if(digest(fs.readFileSync(path.join(release.directory,file.file)))!==file.sha256)throw new Error('Snapshot changed since deployment');
}
const state=inspectStaging();
const deployments=()=>JSON.parse(railway(['deployment','list','--service',target.app,'--environment',target.environment,'--json']));
const live=deployments()[0];
if(live?.status!=='SUCCESS')throw new Error('Latest B deployment is not successful');
const remote=snapshotSchema.parse(JSON.parse(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.app,'--','cat','/app/release-manifest.json'])));
if(remote.fingerprint!==snapshot.fingerprint)throw new Error('B is not running this snapshot');
let referenceAssets;
if(fs.existsSync(path.join(release.directory,'bible-study-data'))){
  const assets=verifyAssets(path.join(release.directory,'bible-study-data'));
  const liveAssets=JSON.parse(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.app,'--','node','scripts/bible-study-assets.mjs','--verify','bible-study-data']));
  if(JSON.stringify(liveAssets)!==JSON.stringify(assets))throw new Error('Live reference assets differ from snapshot');
  referenceAssets={releaseId:assets.releaseId,databaseHash:assets.databaseHash,inventoryHash:assets.inventoryHash,liveVerified:true};
}
const health=await fetch(`${target.origin}/__healthcheck`,{signal:AbortSignal.timeout(15000)});
if(!health.ok||deployments()[0]?.id!==live.id)throw new Error('B health failed or deployment changed during verification');
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0'));
const matchesWorking=snapshot.files.every(f=>fs.existsSync(path.join(root,f.file))&&digest(fs.readFileSync(path.join(root,f.file)))===f.sha256);
const allTracked=snapshot.files.every(f=>tracked.has(f.file));
const clean=spawnSync('git',['diff','--quiet','HEAD','--',...snapshot.files.map(f=>f.file)],{cwd:root}).status===0;
const commit=matchesWorking&&allTracked&&clean?baseCommit:null;
const record={format:1,environment:'staging',origin:target.origin,deploymentId:live.id,verifiedAt:new Date().toISOString(),fingerprint:snapshot.fingerprint,
  sourceCommit:commit,baseCommit,sourceMatchesCommit:!!commit,productionApproved:false,
  migrations:snapshot.files.filter(f=>/^migrations\/[^/]+\.sql$/.test(f.file)),
  checks:{railwaySuccess:true,health:true,liveFingerprintMatches:true,uiAcceptance:'separate evidence required'},
  productionDeploymentObserved:state.productionDeployment};
if(referenceAssets)record.referenceAssets=referenceAssets;
const safe=z.object({format:z.literal(1),environment:z.literal('staging'),origin:z.literal(target.origin),deploymentId:z.string().uuid(),verifiedAt:z.string().datetime(),fingerprint:sha,
  sourceCommit:z.string().regex(/^[a-f0-9]{40}$/).nullable(),baseCommit:z.string().regex(/^[a-f0-9]{40}$/),sourceMatchesCommit:z.boolean(),productionApproved:z.literal(false),
  migrations:z.array(z.object({file:z.string().regex(/^migrations\/[^/]+\.sql$/),sha256:sha}).strict()),
  checks:z.object({railwaySuccess:z.literal(true),health:z.literal(true),liveFingerprintMatches:z.literal(true),uiAcceptance:z.literal('separate evidence required')}).strict(),
  productionDeploymentObserved:z.string().uuid(),referenceAssets:z.object({releaseId:z.literal('public-20260925-v1'),databaseHash:sha,inventoryHash:sha,liveVerified:z.literal(true)}).strict().optional()}).strict().parse(record);
const destination=path.join(root,'design/releases');fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,`b-${live.id}.json`),JSON.stringify(safe,null,2)+'\n',{flag:'wx'});
console.log({recorded:true,sourceMatchesCommit:!!commit,productionApproved:false});
