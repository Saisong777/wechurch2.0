import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {railway, root} from '../scripts/railway-staging.mjs';
import {readBackupKey, seal, unseal, hash} from '../scripts/backup-envelope.mjs';
import {productionSettings, assertReplacementTarget} from './production-replacement-policy.mjs';
import {sendReplacementFile} from './production-relay.mjs';

process.umask(0o077);
const command = process.argv[2];
if (!['database', 'upload', 'files'].includes(command) || process.env.WECHURCH_ALLOW_PRODUCTION_REPLACEMENT !== '2026-09-30') throw new Error('Authorized replacement action required');
const directory = fs.realpathSync(process.env.WECHURCH_PRODUCTION_PRIVATE_DIR || '');
if (!path.relative(root, directory).startsWith('../')) throw new Error('Private operator directory required');
const stateFile = path.join(directory, 'replacement.json');
const state = JSON.parse(fs.readFileSync(stateFile));
assertReplacementTarget(state, state.app, 'app'); assertReplacementTarget(state, state.database, 'database');
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), {mode: 0o600});
const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'))).user?.token;
async function query(query, variables) {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(45000)});
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error('Railway replacement operation failed');
  return result.data;
}
try {
  if (command === 'database') {
    if (state.databaseRestoreAttempted) throw new Error('Inspect previous restore before retrying');
    const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
    const manifest = JSON.parse(fs.readFileSync(path.join(state.bBackup, 'manifest.json')));
    const entry = manifest.files.find(file => file.name === 'database.dump.enc');
    const bytes = fs.readFileSync(path.join(state.bBackup, entry.name));
    if (hash(bytes) !== entry.sha256) throw new Error('Backup checksum mismatch');
    const dump = unseal(bytes, key); key.fill(0);
    state.databaseRestoreAttempted = new Date().toISOString(); save();
    await sendReplacementFile(state, 'database', dump, file => `
test "$(psql -XqAt -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" = 0
pg_restore --exit-on-error --no-owner --no-privileges -U "$PGUSER" -d "$PGDATABASE" ${file}
`);
    state.databaseRestored = new Date().toISOString(); save();
    console.log(JSON.stringify({databaseRestored: true, originalIdsPreserved: true, oldAAndBUntouched: true}));
  }
  if (command === 'upload') {
    if (!state.databaseRestored || state.uploadAttempted) throw new Error('Restored database and new upload required');
    const vars = JSON.parse(railway(['variable', 'list', '-e', state.environment, '-s', state.database, '--json']));
    const old = JSON.parse(railway(['variable', 'list', '-e', state.environment, '-s', state.oldApp, '--json']));
    const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
    let b, runtimePassword, sessionSecret;
    try {
      b = JSON.parse(unseal(fs.readFileSync(path.join(state.bBackup, 'settings.json.enc')), key)).app;
      const credentialsFile = path.join(directory, 'replacement-credentials.enc');
      if (!fs.existsSync(credentialsFile)) {
        const credentials = {runtimePassword: randomBytes(48).toString('hex'), sessionSecret: randomBytes(64).toString('hex')};
        fs.writeFileSync(credentialsFile, seal(Buffer.from(JSON.stringify(credentials)), key), {flag: 'wx', mode: 0o600});
      }
      ({runtimePassword, sessionSecret} = JSON.parse(unseal(fs.readFileSync(credentialsFile), key)));
      if (!/^[a-f0-9]{96}$/.test(runtimePassword) || !/^[a-f0-9]{128}$/.test(sessionSecret)) throw new Error('Invalid protected credentials');
    }
    finally {key.fill(0);}
    const sql = `BEGIN; REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE CREATE ON DATABASE railway FROM PUBLIC;
CREATE ROLE wechurch_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40 PASSWORD '${runtimePassword}';
GRANT USAGE ON SCHEMA public TO wechurch_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO wechurch_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO wechurch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO wechurch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO wechurch_app;
ALTER ROLE wechurch_app SET statement_timeout='15s';
ALTER ROLE wechurch_app SET idle_in_transaction_session_timeout='30s';
DELETE FROM auth_sessions; DELETE FROM sessions; COMMIT;`;
    if (!state.runtimeRoleConfigured) {
      if (state.runtimeRoleAttempted) throw new Error('Inspect ambiguous role creation before retrying');
      state.runtimeRoleAttempted = new Date().toISOString(); save();
      await sendReplacementFile(state, 'database', Buffer.from(sql), file => `psql -Xq -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" -f ${file}`);
      state.runtimeRoleConfigured = new Date().toISOString(); save();
    }
    const url = new URL(`postgresql://wechurch_app:${runtimePassword}@${vars.RAILWAY_PRIVATE_DOMAIN}:5432/railway`);
    const settings = {...productionSettings(b, old, url.href), SESSION_SECRET: sessionSecret};
    await query('mutation($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}',
      {input: {projectId: state.project, environmentId: state.environment, serviceId: state.app, variables: settings, skipDeploys: true}});
    await query('mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$serviceId,environmentId:$environmentId,input:$input)}',
      {serviceId: state.app, environmentId: state.environment, input: {dockerfilePath: '/Dockerfile', healthcheckPath: '/__healthcheck',
        restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10, sleepApplication: false, numReplicas: 1, region: 'asia-southeast1-eqsg3a'}});
    const release = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/railway-staging/release.json')));
    const manifest = JSON.parse(fs.readFileSync(path.join(release.directory, 'release-manifest.json')));
    if (hash(JSON.stringify(manifest.files)) !== release.fingerprint) throw new Error('Source fingerprint mismatch');
    for (const file of manifest.files) {
      if (path.isAbsolute(file.file) || file.file.split('/').includes('..') || hash(fs.readFileSync(path.join(release.directory, file.file))) !== file.sha256) throw new Error('Source snapshot changed');
    }
    const bytes = execFileSync('tar', ['-czf', '-', '-C', release.directory, 'release-manifest.json', 'bible-study-asset-manifest.json', ...manifest.files.map(file => file.file)],
      {maxBuffer: 32 * 1024 * 1024, env: {...process.env, COPYFILE_DISABLE: '1'}});
    const address = new URL(`https://backboard.railway.com/project/${state.project}/environment/${state.environment}/up`);
    address.searchParams.set('serviceId', state.app); address.searchParams.set('message', `Production replacement ${release.fingerprint.slice(0, 16)}`);
    state.uploadAttempted = new Date().toISOString(); state.fingerprint = release.fingerprint; save();
    await new Promise((resolve, reject) => {
      const request = https.request(address, {method: 'POST', headers: {Authorization: `Bearer ${token}`,
        'Content-Type': 'application/gzip', 'Content-Length': bytes.length}}, response => {
        let body = ''; response.on('data', chunk => {body += chunk;});
        response.on('end', () => {
          clearTimeout(deadline);
          if (response.statusCode !== 200) return reject(new Error('Snapshot upload failed; inspect before retrying'));
          try {const result = JSON.parse(body); state.deploymentId = result.deploymentId; save(); resolve();}
          catch {reject(new Error('Unknown upload outcome'));}
        });
      });
      const deadline = setTimeout(() => request.destroy(new Error('Snapshot upload timeout')), 180000);
      request.on('error', error => {clearTimeout(deadline); reject(error);}); request.end(bytes);
    });
    console.log(JSON.stringify({deploymentId: state.deploymentId, fingerprint: state.fingerprint, domainCutover: false, outgoingEmailDisabled: true}));
  }
  if (command === 'files') {
    if (!state.deploymentId || state.filesRestored) throw new Error('Running replacement required');
    const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(state.bBackup, 'manifest.json')));
      for (const [name, destination] of [['uploads.tgz.enc', '/data'], ['reference.tgz.enc', '/data/.bible-study/public-20260926-v3']]) {
        const entry = manifest.files.find(file => file.name === name);
        const encrypted = fs.readFileSync(path.join(state.bBackup, name));
        if (hash(encrypted) !== entry.sha256) throw new Error('Asset backup checksum mismatch');
        const bytes = unseal(encrypted, key);
        const members = execFileSync('tar', ['-tzf', '-'], {input: bytes, maxBuffer: 8 * 1024 * 1024}).toString().split('\n').filter(Boolean);
        if (members.some(member => path.isAbsolute(member) || member.split('/').includes('..'))) throw new Error('Unsafe archive path');
        const types = execFileSync('tar', ['-tvzf', '-'], {input: bytes, maxBuffer: 8 * 1024 * 1024}).toString().split('\n').filter(Boolean);
        if (types.some(line => !['-', 'd'].includes(line[0]))) throw new Error('Unsafe archive member type');
        await sendReplacementFile(state, 'app', bytes, file => `mkdir -p ${destination}\ntar -xzf ${file} -C ${destination}`);
        console.log(JSON.stringify({restoredArchive: name, destination}));
      }
    } finally {key.fill(0);}
    state.filesRestored = new Date().toISOString(); save();
  }
} catch {
  console.error('Replacement deployment stopped. Inspect the private journal; no original A/B data was overwritten.');
  process.exitCode = 1;
}
