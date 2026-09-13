import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Only a newly-created disposable localhost database may receive fixture writes.
const url = new URL(process.env.INTEGRITY_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Integrity tests require localhost Postgres');
const admin = new pg.Client({ connectionString: url.href });
const name = `wechurch_integrity_${randomUUID().replaceAll('-', '')}`;
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  url.pathname = `/${name}`;
  // Do not forward provider credentials or Railway variables into tests.
  const env = Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT'].filter(key => process.env[key]).map(key => [key,process.env[key]]));
  const result = spawnSync('node', ['--import', 'tsx', 'scripts/verify-integrity-worker.ts'], {
    env: { ...env, DATABASE_URL: url.href, NODE_ENV: 'test', LOCAL_INSECURE_COOKIES: '1',
      SESSION_SECRET: randomUUID()+randomUUID(), DISABLE_OUTBOUND_EMAIL: '1', DISABLE_MORNING_BRIEF: '1',
      API_RATE_LIMIT_MAX:'10000', API_WRITE_RATE_LIMIT_MAX:'10000' },
    stdio: 'inherit', timeout: 240000,
  });
  if (result.error || result.status !== 0) throw new Error('Isolated integrity tests failed');
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
