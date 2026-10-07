import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Only a newly-created disposable localhost database may receive fixture writes.
const url = new URL(process.env.INTEGRITY_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Integrity tests require localhost Postgres');
async function runStage(label, onboardingOnly = false) {
const stageUrl = new URL(url.href);
const admin = new pg.Client({ connectionString: stageUrl.href });
const name = `wechurch_integrity_${randomUUID().replaceAll('-', '')}`;
let created = false;
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wechurch-integrity-uploads-'));
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  stageUrl.pathname = `/${name}`;
  console.log(`Integrity stage ${label}: fresh disposable localhost database`);
  // Do not forward provider credentials or Railway variables into tests.
  const env = Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT'].filter(key => process.env[key]).map(key => [key,process.env[key]]));
  const result = spawnSync('node', ['--import', 'tsx', 'scripts/verify-integrity-worker.ts'], {
    env: { ...env, DATABASE_URL: stageUrl.href, NODE_ENV: 'test', LOCAL_INSECURE_COOKIES: '1',
      SESSION_SECRET: randomUUID()+randomUUID(), DISABLE_OUTBOUND_EMAIL: '1', DISABLE_MORNING_BRIEF: '1',
      UPLOAD_ROOT: uploadRoot, RUN_CAPACITY_BENCHMARK: process.env.RUN_CAPACITY_BENCHMARK === '1' ? '1' : '0',
      RUN_CHURCH_ONBOARDING_ONLY: onboardingOnly || process.env.RUN_CHURCH_ONBOARDING_ONLY === '1' ? '1' : '0',
      RUN_READING_HISTORY_ONLY: process.env.RUN_READING_HISTORY_ONLY === '1' ? '1' : '0',
      RUN_MULTICHURCH_ONLY: process.env.RUN_MULTICHURCH_ONLY === '1' ? '1' : '0',
      RUN_CHURCH_SIMULATION: process.env.RUN_CHURCH_SIMULATION === '1' ? '1' : '0',
      RUN_CHURCH_HISTORY: process.env.RUN_CHURCH_HISTORY === '1' ? '1' : '0',
      RUN_SECURITY_BROWSER: process.env.RUN_SECURITY_BROWSER === '1' ? '1' : '0',
      SECURITY_BROWSER_OUTPUT_ROOT: process.env.SECURITY_BROWSER_OUTPUT_ROOT || '',
      ...(process.env.RUN_CHURCH_SIMULATION === '1' ? {} : { API_RATE_LIMIT_MAX:'10000', API_WRITE_RATE_LIMIT_MAX:'10000' }) },
    stdio: 'inherit', timeout: 600000,
  });
  if (result.error || result.status !== 0) throw new Error(`Isolated integrity stage ${label} failed (worker status ${result.status})`);
  console.log(`PASS integrity stage ${label}: worker exit 0`);
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('Disposable database cleanup failed');
    console.log('PASS disposable database removed and absence verified');
  }
  await admin.end();
  fs.rmSync(uploadRoot, { recursive: true, force: true });
}

}
const customMode = ['RUN_READING_HISTORY_ONLY','RUN_CHURCH_ONBOARDING_ONLY','RUN_MULTICHURCH_ONLY','RUN_CHURCH_SIMULATION','RUN_CHURCH_HISTORY','RUN_SECURITY_BROWSER','RUN_CAPACITY_BENCHMARK'].some(key=>process.env[key]==='1');
await runStage(customMode?'custom':'original');
if (!customMode) await runStage('church-onboarding', true);
