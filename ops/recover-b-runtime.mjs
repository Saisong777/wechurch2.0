import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inspectStaging, root, target } from '../scripts/railway-staging.mjs';

if (['create', 'configure', 'upload'].includes(process.argv[2]) && process.env.WECHURCH_ALLOW_RUNTIME_RECOVERY !== '1') {
  throw new Error('Recovery changes require explicit operator authorization; this is not the normal release tool');
}
const journalPath = path.join(root, 'artifacts/railway-staging/runtime-recovery.json');
const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'))).user?.token;
if (!token) throw new Error('Railway CLI login required');
const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath)) : { target, startedAt: new Date().toISOString() };
if (JSON.stringify(journal.target) !== JSON.stringify(target)) throw new Error('Unexpected recovery target');
const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
async function query(query, variables) {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(45000),
  });
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error(`Railway operation failed: ${JSON.stringify(result.errors || response.status)}`);
  return result.data;
}

if (process.argv[2] === 'create') {
  if (journal.serviceId || journal.creationAttemptedAt) throw new Error('Inspect the existing recovery service before retrying creation');
  const { productionDeployment } = inspectStaging();
  journal.productionDeployment = productionDeployment;
  journal.creationAttemptedAt = new Date().toISOString(); save();
  const created = await query('mutation($input:ServiceCreateInput!){serviceCreate(input:$input){id name}}', {
    input: { projectId: target.project, environmentId: target.environment, name: 'wechurch-staging-recovery' },
  });
  journal.serviceId = created.serviceCreate.id; save();
}
if (['create', 'configure'].includes(process.argv[2])) {
  if (!journal.serviceId) throw new Error('Recovery service missing');
  const { app } = inspectStaging();
  // Platform-generated identity is supplied by Railway, never copied from the old service.
  const variables = Object.fromEntries(Object.entries(app).filter(([key]) => !key.startsWith('RAILWAY_')));
  variables.DISABLE_OUTBOUND_EMAIL = '1'; variables.DISABLE_MORNING_BRIEF = '1';
  await query('mutation($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}', {
    input: { projectId: target.project, environmentId: target.environment, serviceId: journal.serviceId, variables, skipDeploys: true },
  });
  await query('mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$serviceId,environmentId:$environmentId,input:$input)}', {
    serviceId: journal.serviceId, environmentId: target.environment,
    input: { dockerfilePath: '/Dockerfile', healthcheckPath: '/__healthcheck', restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10, sleepApplication: false, numReplicas: 1, region: 'asia-southeast1-eqsg3a' },
  });
  journal.configuredAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ serviceId: journal.serviceId, configured: true, volumeAttached: false, publicDomain: false }));
} else if (process.argv[2] === 'upload') {
  if (!journal.configuredAt || journal.uploadAttemptedAt) throw new Error('Recovery not configured or upload already attempted; inspect remote state');
  const release = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/railway-staging/release.json')));
  const directory = fs.realpathSync(release.directory);
  if (!directory.startsWith(path.join(root, 'artifacts/railway-staging/release-'))) throw new Error('Invalid snapshot location');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'release-manifest.json')));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (manifest.fingerprint !== release.fingerprint || hash(JSON.stringify(manifest.files)) !== manifest.fingerprint) throw new Error('Invalid release fingerprint');
  for (const entry of manifest.files) {
    if (path.isAbsolute(entry.file) || entry.file.split('/').some(p => p === '..' || p === '.') || entry.file.startsWith('-')) throw new Error('Invalid snapshot path');
    if (hash(fs.readFileSync(path.join(directory, entry.file))) !== entry.sha256) throw new Error('Snapshot changed');
  }
  const bytes = execFileSync('tar', ['-czf', '-', '-C', directory, 'release-manifest.json', 'bible-study-asset-manifest.json', ...manifest.files.map(f => f.file)], { maxBuffer: 32 * 1024 * 1024, env: { ...process.env, COPYFILE_DISABLE: '1' } });
  const url = new URL(`https://backboard.railway.com/project/${target.project}/environment/${target.environment}/up`);
  url.searchParams.set('serviceId', journal.serviceId); url.searchParams.set('message', `B recovery ${manifest.fingerprint.slice(0, 16)}`);
  journal.uploadAttemptedAt = new Date().toISOString(); journal.fingerprint = manifest.fingerprint; save();
  await new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/gzip', 'Content-Length': bytes.length } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        clearTimeout(deadline);
        if (response.statusCode !== 200) { reject(new Error(`Upload HTTP ${response.statusCode}; inspect before retrying`)); return; }
        try { const result = JSON.parse(body); journal.deploymentId = result.deploymentId; save(); console.log(JSON.stringify({ deploymentId: result.deploymentId })); resolve(); }
        catch { reject(new Error('Invalid upload response; inspect before retrying')); }
      });
    });
    const deadline = setTimeout(() => request.destroy(new Error('Upload timeout; inspect remote state before retrying')), 180000);
    request.on('error', error => { clearTimeout(deadline); reject(error); }); request.end(bytes);
  });
} else {
  console.log(JSON.stringify({ serviceId: journal.serviceId, deploymentId: journal.deploymentId, fingerprint: journal.fingerprint }));
}
