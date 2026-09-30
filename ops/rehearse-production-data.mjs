import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {root} from '../scripts/railway-staging.mjs';
import {readBackupKey, unseal, hash} from '../scripts/backup-envelope.mjs';
import {tableProof} from './seal-b-recovery-set.mjs';
import {assertTableProofMatches} from './verify-b-recovery-set.mjs';
import {importPrepared, verifyImported} from '../scripts/im-bible-writer.mjs';
import {productionTarget} from './production-replacement-policy.mjs';

process.umask(0o077);
const [kind, directory, input] = process.argv.slice(2);
if (!['old-a', 'old-a-database', 'b-delta'].includes(kind)) throw new Error('Use old-a, old-a-database or b-delta');
if (!path.relative(root, fs.realpathSync(directory)).startsWith('../')) throw new Error('Private backup directory required');
const databaseOnly = kind === 'old-a-database';
if (databaseOnly && process.env.WECHURCH_ALLOW_PRODUCTION_REPLACEMENT !== '2026-09-30') throw new Error('Authorized database-only rehearsal required');
const manifest = databaseOnly ? null : JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
if (!databaseOnly && !manifest.complete) throw new Error('Complete backup required');
const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
const container = `wc_production_rehearsal_${randomUUID().replaceAll('-', '')}`;
const docker = (args, options = {}) => execFileSync('docker', args, {encoding: 'utf8',
  timeout: 180000, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options});
let db, attempted = false;
try {
  if (databaseOnly) {
    const settings = JSON.parse(unseal(fs.readFileSync(path.join(directory, 'settings.json.enc')), key));
    if (settings.app.RAILWAY_SERVICE_ID !== productionTarget.oldApp || settings.database.RAILWAY_SERVICE_ID !== productionTarget.oldDatabase ||
      settings.app.RAILWAY_ENVIRONMENT_ID !== productionTarget.environment || settings.database.RAILWAY_ENVIRONMENT_ID !== productionTarget.environment) throw new Error('Old A database backup identity mismatch');
  }
  const file = databaseOnly ? {name: 'database.dump.enc'} : manifest.files.find(file => file.name === 'database.dump.enc');
  const encrypted = fs.readFileSync(path.join(directory, file.name));
  if (!databaseOnly && hash(encrypted) !== file.sha256) throw new Error('Backup checksum mismatch');
  const dump = unseal(encrypted, key);
  if (dump.subarray(0, 5).toString() !== 'PGDMP') throw new Error('Invalid database backup archive');
  docker(['image', 'inspect', 'postgres:17-alpine']);
  attempted = true;
  docker(['run', '-d', '--rm', '--pull=never', '--name', container, '-e', 'POSTGRES_PASSWORD=rehearsal',
    '-p', '127.0.0.1::5432', 'postgres:17-alpine']);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break;}
    catch {await new Promise(resolve => setTimeout(resolve, 500));}
  }
  if (!ready) throw new Error('Disposable database unavailable');
  const port = JSON.parse(docker(['inspect', container]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
  docker(['exec', '-i', container, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges',
    '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres'], {input: dump});
  db = new pg.Pool({connectionString: `postgresql://postgres:rehearsal@127.0.0.1:${port}/postgres`, max: 2});
  const before = await tableProof(db);
  let result = {kind, restored: true, tables: before.length, ...(databaseOnly ? {
    scope: 'database-only', encryptedDatabaseSha256: hash(encrypted), uploadsVerified: false, completeARecoveryVerified: false,
  } : {manifestSha256: hash(fs.readFileSync(path.join(directory, 'manifest.json')))})};
  if (kind === 'b-delta') {
    const proof = JSON.parse(unseal(fs.readFileSync(path.join(directory, 'proof.json.enc')), key));
    assertTableProofMatches(before, proof.tables);
    const prepared = JSON.parse(unseal(fs.readFileSync(input), key));
    const dryRun = await importPrepared(db, prepared, {dryRun: true});
    result = {...result, sourceExportedAt: prepared.sourceExportedAt, dryRun};
    if (dryRun.ready === true && dryRun.issues.length === 0) {
      result.import = await importPrepared(db, prepared, {dryRun: false});
      result.verification = await verifyImported(db, prepared);
      result.replay = await importPrepared(db, prepared, {dryRun: false});
      result.ready = result.verification.mismatches === 0;
    } else result.ready = false;
  }
  const output = kind === 'old-a' ? path.join(directory, 'restore-verification.json') : databaseOnly
    ? path.join(directory, 'database-restore-verification.json') : path.join(path.dirname(input), 'latest-source-rehearsal.json');
  fs.writeFileSync(output, JSON.stringify({...result, at: new Date().toISOString(), liveDataUnchanged: true}, null, 2), {mode: 0o600});
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({rehearsalFailed: true, kind, errorType: error.name,
    code: error.code && /^[A-Z_]+$/.test(error.code) ? error.code : undefined, liveDataUnchanged: true}));
  process.exitCode = 1;
} finally {
  key.fill(0);
  await db?.end();
  if (attempted) {try {docker(['stop', container]);} catch {docker(['rm', '-f', '-v', container]);}}
}
