import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {railway, inspectStaging, root} from '../scripts/railway-staging.mjs';
import {readBackupKey, seal, unseal, hash} from '../scripts/backup-envelope.mjs';
import {productionTarget as target} from './production-replacement-policy.mjs';

process.umask(0o077);
const command = process.argv[2];
if (!['backup-a', 'create', 'inspect'].includes(command)) throw new Error('Use backup-a, create or inspect');
if (process.env.WECHURCH_ALLOW_PRODUCTION_REPLACEMENT !== '2026-09-30') throw new Error('Explicit production replacement authorization required');
const privateRoot = fs.realpathSync(process.env.WECHURCH_PRODUCTION_PRIVATE_DIR || '');
if (!path.relative(root, privateRoot).startsWith('../') || (fs.statSync(privateRoot).mode & 0o077)) throw new Error('Private operator directory required');
const stateFile = path.join(privateRoot, 'replacement.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {...target, createdAt: new Date().toISOString()};
if (state.project !== target.project || state.environment !== target.environment) throw new Error('Unexpected replacement target');
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', {mode: 0o600});
const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'))).user?.token;
async function query(query, variables) {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(45000)});
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error('Railway operation failed; inspect private state before retrying');
  return result.data;
}
function remote(service, script, limit = 64 * 1024 * 1024) {
  if (![target.oldApp, target.oldDatabase].includes(service)) throw new Error('Old A read-only backup target required');
  const encoded = Buffer.from(script).toString('base64');
  try { return railway(['ssh', '-p', target.project, '-e', target.environment, '-s', service,
    '--', 'sh', '-c', `'printf %s ${encoded} | base64 -d | sh'`], {timeout: 180000, maxBuffer: limit}); }
  catch { throw new Error('Old A backup transport failed; partial backup is not valid'); }
}

try {
  if (command === 'backup-a') {
    if (state.oldABackup) throw new Error('An A backup already exists; inspect before replacing it');
    const staging = inspectStaging();
    const app = JSON.parse(railway(['variable', 'list', '-e', target.environment, '-s', target.oldApp, '--json']));
    const database = JSON.parse(railway(['variable', 'list', '-e', target.environment, '-s', target.oldDatabase, '--json']));
    if (app.RAILWAY_SERVICE_ID !== target.oldApp || database.RAILWAY_SERVICE_ID !== target.oldDatabase ||
      app.RAILWAY_ENVIRONMENT_ID !== target.environment || new URL(app.DATABASE_URL).hostname !== new URL(database.DATABASE_URL).hostname) throw new Error('Old A identity mismatch');
    const directory = path.join(privateRoot, `a-recovery-${Date.now()}`);
    fs.mkdirSync(directory, {mode: 0o700});
    const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
    const files = [];
    const encrypted = (name, bytes) => {
      const value = seal(bytes, key);
      if (!unseal(value, key).equals(bytes)) throw new Error('Backup encryption verification failed');
      fs.writeFileSync(path.join(directory, name), value, {flag: 'wx', mode: 0o600});
      if (hash(fs.readFileSync(path.join(directory, name))) !== hash(value)) throw new Error('Backup disk readback failed');
      files.push({name, bytes: value.length, sha256: hash(value)});
    };
    try {
      const dump = Buffer.from(remote(target.oldDatabase, `set -eu\numask 077\nf=$(mktemp)\ntrap 'rm -f "$f"' EXIT\npg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$f"\npg_restore -l "$f" >/dev/null\nbase64 "$f"`).replace(/\s/g, ''), 'base64');
      if (dump.subarray(0, 5).toString() !== 'PGDMP') throw new Error('Invalid A archive');
      encrypted('database.dump.enc', dump);
      console.log('Old A database archive encrypted and verified.');
      encrypted('settings.json.enc', Buffer.from(JSON.stringify({app, database,
        environmentConfig: JSON.parse(railway(['environment', 'config', '-e', target.environment, '--json']))})));
      console.log('Old A settings encrypted and verified.');
      state.oldADatabaseBackup = directory;
      state.oldADeployment = staging.productionDeployment;
      save();
      const uploadRoot = app.UPLOAD_ROOT || '/app/uploads';
      if (!/^\/(?:app\/uploads|data)$/.test(uploadRoot)) throw new Error('Inspect unexpected A upload path');
      const uploads = Buffer.from(remote(target.oldApp, `set -eu\numask 077\nf=$(mktemp)\ntrap 'rm -f "$f"' EXIT\nif [ -d ${uploadRoot} ]; then tar -czf "$f" -C ${uploadRoot} .; else d=$(mktemp -d); tar -czf "$f" -C "$d" .; rmdir "$d"; fi\ntar -tzf "$f" >/dev/null\nbase64 "$f"`, 128 * 1024 * 1024).replace(/\s/g, ''), 'base64');
      encrypted('uploads.tgz.enc', uploads);
      const manifest = {format: 'wechurch-old-a-recovery-v1', createdAt: new Date().toISOString(),
        project: target.project, environment: target.environment, app: target.oldApp, database: target.oldDatabase,
        deployment: staging.productionDeployment, files, complete: true};
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), {mode: 0o600, flag: 'wx'});
      state.oldABackup = directory; state.oldADeployment = staging.productionDeployment; save();
      console.log(JSON.stringify({oldABackupComplete: true, directory, encryptedFiles: files.length, productionUnchanged: true}));
    } finally {key.fill(0);}
  }
  if (command === 'create') {
    if (!state.oldABackup && !state.oldADatabaseBackup) throw new Error('Old A encrypted database backup required');
    const backup = fs.realpathSync(process.env.WECHURCH_B_BACKUP_DIR || '');
    const verified = JSON.parse(fs.readFileSync(path.join(backup, 'restore-verification.json')));
    const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json')));
    if (!manifest.complete || !verified.allTableContentDigestsMatch || verified.manifestSha256 !== hash(fs.readFileSync(path.join(backup, 'manifest.json'))) ||
      Date.now() - Date.parse(manifest.createdAt) > 3600000) throw new Error('Fresh restored B backup required');
    state.bBackup = backup; save();
    for (const [kind, name] of [['database', 'wechurch-production-v2-db'], ['app', 'wechurch-production-v2']]) {
      if (!state[kind]) {
        if (state[`${kind}CreateAttempted`]) throw new Error('Inspect ambiguous service creation before retrying');
        state[`${kind}CreateAttempted`] = new Date().toISOString(); save();
        const created = await query('mutation($input:ServiceCreateInput!){serviceCreate(input:$input){id name}}',
          {input: {projectId: target.project, environmentId: target.environment, name}});
        state[kind] = created.serviceCreate.id; save();
      }
      if (!state[`${kind}Volume`]) {
        if (state[`${kind}VolumeAttempted`]) throw new Error('Inspect ambiguous volume creation before retrying');
        state[`${kind}VolumeAttempted`] = new Date().toISOString(); save();
        const created = await query('mutation($input:VolumeCreateInput!){volumeCreate(input:$input){id}}',
          {input: {projectId: target.project, environmentId: target.environment, serviceId: state[kind],
            mountPath: kind === 'app' ? '/data' : '/var/lib/postgresql/data', region: 'asia-southeast1-eqsg3a'}});
        state[`${kind}Volume`] = created.volumeCreate.id; save();
      }
    }
    if (!state.databaseConfigured) {
      const password = randomBytes(48).toString('hex');
      await query('mutation($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}',
        {input: {projectId: target.project, environmentId: target.environment, serviceId: state.database, skipDeploys: true,
          variables: {POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: password, POSTGRES_DB: 'railway',
            PGUSER: 'postgres', PGPASSWORD: password, PGDATABASE: 'railway', PGDATA: '/var/lib/postgresql/data/pgdata'}}});
      await query('mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$serviceId,environmentId:$environmentId,input:$input)}',
        {serviceId: state.database, environmentId: target.environment, input: {source: {image: 'postgres:17-alpine'},
          restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10, sleepApplication: false, numReplicas: 1, region: 'asia-southeast1-eqsg3a'}});
      state.databaseConfigured = new Date().toISOString(); save();
    }
    console.log(JSON.stringify({replacementProvisioned: true, app: state.app, database: state.database,
      independentVolumes: true, publicDomainsChanged: false, databaseImported: false}));
  }
  if (command === 'inspect') console.log(JSON.stringify(state));
} catch {
  console.error('Production preparation stopped safely. Inspect the private operator journal; no secret values are logged.');
  process.exitCode = 1;
}
