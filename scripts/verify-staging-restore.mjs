import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { target } from './railway-staging.mjs';

const directory = new URL('../artifacts/railway-staging/', import.meta.url);
const metadata = JSON.parse(fs.readFileSync(new URL('backup.json', directory), 'utf8'));
assert.equal(metadata.environment, target.environment);
assert.match(metadata.file, /^wechurch-staging-\d+\.dump$/);
const dump = fs.readFileSync(new URL(metadata.file, directory));
assert.equal(createHash('sha256').update(dump).digest('hex'), metadata.sha256);
const name = `wechurch_restore_${randomUUID().replaceAll('-', '')}`;
execFileSync('docker', ['image', 'inspect', 'postgres:17-alpine'], { stdio: 'ignore' });
execFileSync('docker', ['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_PASSWORD=postgres', '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { stdio: 'ignore' });
const port = JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
const admin = new pg.Pool({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres` });
let restored;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  assert(ready, 'Disposable restore database failed to start');
  await admin.query(`CREATE DATABASE "${name}"`);
  // Reuse an already-present Postgres image; never connect a restore command to Railway.
  execFileSync('docker', ['exec', '-i', name, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', name],
  { input: dump, maxBuffer: 8 * 1024 * 1024, timeout: 180000 });
  restored = new pg.Pool({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/${name}` });
  const tables = (await restored.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const counts = {};
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z0-9_]+$/);
    counts[tablename] = Number((await restored.query(`SELECT count(*) FROM "${tablename}"`)).rows[0].count);
  }
  const applied = (await restored.query('SELECT created_at,hash FROM drizzle.__drizzle_migrations')).rows;
  const journal = JSON.parse(fs.readFileSync(new URL('../migrations/meta/_journal.json', import.meta.url), 'utf8')).entries;
  const changed = [];
  await restored.query('BEGIN');
  for (const entry of journal) {
    const sql = fs.readFileSync(new URL(`../migrations/${entry.tag}.sql`, import.meta.url), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const existing = applied.find(row => Number(row.created_at) === entry.when);
    if (existing) { assert.equal(existing.hash, hash, `Migration drift ${entry.tag}`); continue; }
    await restored.query(sql);
    await restored.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)', [hash, entry.when]);
    changed.push(entry.tag);
  }
  await restored.query('COMMIT');
  for (const [table, count] of Object.entries(counts)) assert.equal(Number((await restored.query(`SELECT count(*) FROM "${table}"`)).rows[0].count), count, `Row count changed: ${table}`);
  const evidence = { at: new Date().toISOString(), source: 'verified B backup', backupSha256: metadata.sha256,
    localRestoreSucceeded: true, migrationRehearsal: changed, preservedTables: tables.length, rowCountsUnchanged: true, productionUntouched: true };
  fs.writeFileSync(new URL('restore-verification.json', directory), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(evidence));
} finally {
  if (restored) await restored.end();
  await admin.end();
  execFileSync('docker', ['stop', name], { stdio: 'ignore' });
}
