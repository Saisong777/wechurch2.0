import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBackupKey, unseal } from './backup-envelope.mjs';
import { verifyAssets, releaseId as bibleReleaseId } from './bible-study-assets.mjs';
import { assertReleaseBaseline, assertKnownMigrations } from './staging-release-baseline.mjs';
import { assertCloudReleaseCheck, assertHomepageOnlyChanges } from './staging-cloud-check.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const target = Object.freeze({ project: '9371f53f-3043-4a19-b25f-a55d891fb46a', environment: 'ae398a3f-4f0e-4617-8c55-838d1c5b47d9', app: 'fef7af7c-e3c3-4977-8294-c3a123a4242e', database: '0d52eb1a-b8e6-4f0f-b8ba-c652ddacebc8', origin: 'https://wechurch-staging-staging.up.railway.app' });
export const bibleVolumePath = `/data/.bible-study/${bibleReleaseId}`;
export const production = Object.freeze({ environment: 'f4b11351-cf4c-4a95-a3c0-45b195e9a0e0', app: 'b5a40406-1614-4d8b-9eaa-f6f0cd32cac6', origin: 'https://www.wechurch.online' });
const evidence = path.join(root, 'artifacts', 'railway-staging');
const sha = data => createHash('sha256').update(data).digest('hex');
export function railway(args, options = {}) {
  return execFileSync('railway', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
}
// Maintenance travels through Railway's authenticated encrypted exec channel, not the public TCP proxy.
export function stagingSql(sql) {
  if (typeof sql !== 'string' || Buffer.byteLength(sql) > 1024 * 1024) throw new Error('Invalid maintenance request');
  const encoded = Buffer.from(sql).toString('base64');
  const command = `printf %s ${encoded} | base64 -d | psql -X -qAt -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE"`;
  try { return railway(['ssh', '-p', target.project, '-e', target.environment, '-s', target.database, '--', 'sh', '-c', `'${command}'`], { timeout: 180000 }).trim(); }
  catch { throw new Error('Encrypted B database maintenance failed; no credentials or SQL are logged'); }
}
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
const json = args => JSON.parse(railway(args));
const vars = (environment, service) => json(['variable', 'list', '-e', environment, '-s', service, '--json']);
export function verifyRemoteBibleAssets(directory) {
  if (directory !== bibleVolumePath) throw new Error('Unexpected B reference asset location');
  const module = Buffer.from(fs.readFileSync(path.join(root, 'scripts/bible-study-assets.mjs'))).toString('base64');
  const code = `const {verifyAssets}=await import("data:text/javascript;base64,${module}");console.log(JSON.stringify(verifyAssets(${JSON.stringify(directory)})))`;
  return JSON.parse(railway(['ssh', '-p', target.project, '-e', target.environment, '-s', target.app, '--', 'node', '--input-type=module', '-e', `'${code}'`]));
}
function save(name, value) {
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(evidence, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}

export function verifyStagingReleaseBase(expected) {
  const deployments = json(['deployment', 'list', '-s', target.app, '-e', target.environment, '--json']);
  if (!['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'].includes(deployments[0]?.status)) {
    throw new Error('Another B deployment is pending; wait for it before validating a new release');
  }
  const live = JSON.parse(railway(['ssh', '-p', target.project, '-e', target.environment, '-s', target.app, '--', 'cat', '/app/release-manifest.json']));
  if (!Array.isArray(live.files) || live.fingerprint !== sha(JSON.stringify(live.files))) throw new Error('Invalid B release manifest');
  const directory = path.join(root, 'design/releases');
  const records = fs.readdirSync(directory).filter(name => /^b-.*\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
  return assertReleaseBaseline({ fingerprint: live.fingerprint, expected, records, origin: target.origin,
    isAncestor: commit => spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: root }).status === 0 });
}

export function assertStagingIsolation({ status, app, database, live }) {
  if (status.id !== target.project) throw new Error('Wrong linked project. No writes performed.');
  const environment = status.environments.edges.map(e => e.node).find(e => e.id === target.environment && e.name === 'staging');
  if (!environment) throw new Error('Expected staging environment missing.');
  const prod = status.environments.edges.map(e => e.node).find(e => e.id === production.environment);
  const prodApp = prod?.serviceInstances.edges.map(e => e.node).find(s => s.serviceId === production.app);
  if (!prodApp?.domains?.customDomains.some(d => d.domain === new URL(production.origin).hostname) ||
      !prodApp.latestDeployment?.id || prodApp.latestDeployment.deploymentStopped ||
      live.RAILWAY_ENVIRONMENT_ID !== production.environment || live.RAILWAY_SERVICE_ID !== production.app ||
      live.PUBLIC_BASE_URL !== production.origin) throw new Error('Current production identity mismatch. No writes performed.');
  if (app.RAILWAY_ENVIRONMENT_ID !== target.environment || database.RAILWAY_ENVIRONMENT_ID !== target.environment || app.RAILWAY_SERVICE_ID !== target.app || database.RAILWAY_SERVICE_ID !== target.database) throw new Error('Service identity mismatch.');
  const appDb = new URL(app.DATABASE_URL || 'invalid:');
  const ownerDb = new URL(database.DATABASE_URL || 'invalid:');
  if (!['postgres:', 'postgresql:'].includes(appDb.protocol) ||
      appDb.hostname !== ownerDb.hostname || appDb.port !== ownerDb.port || appDb.pathname !== ownerDb.pathname ||
      ![ownerDb.username, 'wechurch_app'].includes(appDb.username)) throw new Error('App is not connected to the staging database service.');
  if (new URL(app.DATABASE_URL).hostname === new URL(live.DATABASE_URL).hostname || app.SESSION_SECRET === live.SESSION_SECRET) throw new Error('Staging isolation failed.');
  if (app.PUBLIC_BASE_URL !== target.origin) throw new Error('Unexpected staging origin.');
  if (app.STAGING_GOOGLE_LOGIN_ENABLED === '1') {
    if (!app.GOOGLE_CLIENT_ID || !app.GOOGLE_CLIENT_SECRET || app.GOOGLE_CLIENT_ID !== app.STAGING_GOOGLE_CLIENT_ID ||
        app.GOOGLE_CLIENT_ID === live.GOOGLE_CLIENT_ID || app.GOOGLE_CLIENT_SECRET === live.GOOGLE_CLIENT_SECRET ||
        app.GOOGLE_CALLBACK_URL !== `${target.origin}/api/callback`) throw new Error('Staging Google requires its own client and callback.');
  }
  if (app.STAGING_LINE_LOGIN_ENABLED === '1') {
    const channel = app.LINE_CHANNEL_ID || app.LINE_LOGIN_CHANNEL_ID;
    const secret = app.LINE_CHANNEL_SECRET || app.LINE_LOGIN_CHANNEL_SECRET;
    if (channel === (live.LINE_CHANNEL_ID || live.LINE_LOGIN_CHANNEL_ID) || secret === (live.LINE_CHANNEL_SECRET || live.LINE_LOGIN_CHANNEL_SECRET)) throw new Error('Staging LINE requires its own channel and secret.');
    if (!app.LINE_PROVIDER_ID || (live.LINE_PROVIDER_ID && app.LINE_PROVIDER_ID !== live.LINE_PROVIDER_ID)) throw new Error('LINE provider configuration mismatch.');
  }
  return { app, database, productionDeployment: prodApp.latestDeployment.id };
}

export function inspectStaging() {
  return assertStagingIsolation({
    status: json(['status', '--json']),
    app: vars(target.environment, target.app),
    database: vars(target.environment, target.database),
    live: vars(production.environment, production.app),
  });
}

function configure(app) {
  const code = app.STAGING_ACCESS_CODE || randomBytes(16).toString('hex');
  const settings = {
    APP_ENV: 'staging', NODE_ENV: 'production', LOCAL_INSECURE_COOKIES: '0',
    STAGING_ACCESS_CODE: code, STAGING_EXPECTED_ENVIRONMENT_ID: target.environment,
    STAGING_EXPECTED_DB_HOST: new URL(app.DATABASE_URL).hostname,
    DISABLE_OUTBOUND_EMAIL: app.STAGING_CONTROLLED_EMAIL_ENABLED === '1' && app.DISABLE_OUTBOUND_EMAIL === '0' ? '0' : '1',
    DISABLE_MORNING_BRIEF: '1', UPLOAD_ROOT: '/data',
  };
  for (const [key, value] of Object.entries(settings)) railway(['variable', 'set', '-e', target.environment, '-s', target.app, '--skip-deploys', '--stdin', key], { input: value });
  save('access.txt', `B 測試站：${target.origin}\n測試邀請碼：${code}\n僅分享給受邀測試同工，請勿提交此檔。\n`);
  console.log('Staging safety variables configured. Access details: artifacts/railway-staging/access.txt');
}

function backup() {
  const name = `wechurch-staging-${Date.now()}`;
  // Execute only on the explicitly identified staging database container.
  const command = `pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc -f /tmp/${name}.dump && pg_restore -l /tmp/${name}.dump >/tmp/${name}.toc && base64 /tmp/${name}.dump`;
  const encoded = railway(['ssh', '-p', target.project, '-e', target.environment, '-s', target.database, '--', 'sh', '-c', `'${command}'`]);
  const dump = Buffer.from(encoded.replace(/\s/g, ''), 'base64');
  if (dump.subarray(0, 5).toString() !== 'PGDMP') throw new Error('Backup did not return a valid PostgreSQL archive. No migrations run.');
  save(`${name}.dump`, dump);
  save('backup.json', { file: `${name}.dump`, sha256: sha(dump), createdAt: new Date().toISOString(), environment: target.environment, archiveListVerified: true });
  console.log(`Staging backup verified (${dump.length} bytes); production database not accessed.`);
}

async function migrate(database) {
  if (process.env.WECHURCH_BACKUP_MANIFEST) {
    const manifestPath = fs.realpathSync(process.env.WECHURCH_BACKUP_MANIFEST);
    if (!path.relative(root, manifestPath).startsWith(`..${path.sep}`)) throw new Error('Encrypted backup must be outside the repository.');
    const b = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const age = Date.now() - Date.parse(b.createdAt);
    const entry = b.files?.find(f => f.name === 'database.dump.enc');
    if (b.environment !== target.environment || b.complete !== true || !Number.isFinite(age) || age < 0 || age > 3600_000 || !entry) throw new Error('A verified staging backup from the last hour is required.');
    const encrypted = fs.readFileSync(path.join(path.dirname(manifestPath), entry.name));
    if (sha(encrypted) !== entry.sha256) throw new Error('Encrypted backup checksum mismatch.');
    const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE, root);
    try {
      if (unseal(encrypted, key).subarray(0, 5).toString() !== 'PGDMP') throw new Error('Invalid encrypted database archive.');
    } finally { key.fill(0); }
  } else {
    const b = JSON.parse(fs.readFileSync(path.join(evidence, 'backup.json'), 'utf8'));
    if (b.environment !== target.environment || Date.now() - Date.parse(b.createdAt) > 3600_000 || sha(fs.readFileSync(path.join(evidence, b.file))) !== b.sha256) throw new Error('A verified staging backup from the last hour is required.');
  }
    const applied = JSON.parse(stagingSql("SELECT coalesce(json_agg(t),'[]') FROM (SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at) t"));
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'migrations/meta/_journal.json'), 'utf8')).entries;
    const changed = [];
    const statements = ["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SELECT pg_advisory_xact_lock(937153);"];
    for (const entry of journal) {
      const sql = fs.readFileSync(path.join(root, 'migrations', `${entry.tag}.sql`), 'utf8');
      const hash = sha(sql);
      const existing = applied.find(row => Number(row.created_at) === entry.when);
      if (existing) {
        if (existing.hash !== hash) throw new Error(`Migration drift: ${entry.tag}`);
        statements.push(`DO $wc$ BEGIN IF NOT EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=${Number(entry.when)} AND hash=${sqlLiteral(hash)}) THEN RAISE EXCEPTION 'Migration drift'; END IF; END $wc$;`);
        continue;
      }
      if (applied.some(row => Number(row.created_at) > entry.when)) throw new Error(`Migration history gap: ${entry.tag}`);
      if (entry.idx < 2) throw new Error('Unexpected missing baseline. Refusing automatic bootstrap.');
      statements.push(`DO $wc$ BEGIN IF EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at>=${Number(entry.when)}) THEN RAISE EXCEPTION 'Migration history changed; retry after inspection'; END IF; END $wc$;`);
      statements.push(sql);
      statements.push(`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(${sqlLiteral(hash)},${Number(entry.when)});`);
      changed.push(entry.tag);
    }
    statements.push('COMMIT;');
    stagingSql(statements.join('\n'));
    save('migrations.json', { at: new Date().toISOString(), environment: target.environment, applied: changed });
    console.log({ stagingMigrationsApplied: changed });
}

function snapshot(referenceAssets, baseFingerprint) {
  const release = path.join(evidence, `release-${Date.now()}`);
  fs.mkdirSync(release, { recursive: true, mode: 0o700 });
  const entries = ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json', 'index.html', 'components.json', 'vite.config.ts', 'vitest.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'drizzle.config.ts', 'eslint.config.js', 'nixpacks.toml', 'src', 'server', 'shared', 'public', 'migrations', 'scripts'];
  const manifest = [];
  function copy(relative) {
    if (/^(public\/message-cards)(\/|$)/.test(relative)) return;
    const source = path.join(root, relative);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Symlinks are not accepted in a release: ${relative}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(path.join(release, relative), { recursive: true });
      for (const child of fs.readdirSync(source).sort()) copy(`${relative}/${child}`);
    } else {
      if (/(^|\/)(\.env($|\.)|\.DS_Store$)|\.(log|pem|key|dump|tsbuildinfo)$/.test(relative)) throw new Error(`Unexpected private/generated file: ${relative}`);
      const bytes = fs.readFileSync(source);
      fs.copyFileSync(source, path.join(release, relative));
      manifest.push({ file: relative, sha256: sha(bytes) });
    }
  }
  for (const entry of entries) copy(entry);
  // Large read-only reference assets are delivered separately, never committed to Git.
  if (referenceAssets) fs.writeFileSync(path.join(release, 'bible-study-asset-manifest.json'), JSON.stringify(referenceAssets, null, 2));
  const fingerprint = sha(JSON.stringify(manifest));
  fs.writeFileSync(path.join(release, 'release-manifest.json'), JSON.stringify({ fingerprint, files: manifest }, null, 2));
  save('release.json', { directory: release, fingerprint, baseFingerprint, createdAt: new Date().toISOString(), target, files: manifest.length });
  return { release, fingerprint };
}

async function main() {
  const command = process.argv[2] || 'check';
  if (!['check', 'configure', 'backup', 'migrate', 'deploy', 'deploy-ci'].includes(command) || process.argv.length > 3) throw new Error('Usage: tsx scripts/railway-staging.mjs [check|configure|backup|migrate|deploy|deploy-ci]. Production is intentionally unsupported.');
  const { app, database, productionDeployment } = inspectStaging();
  if (command === 'check') console.log({ stagingIsolated: true, target, productionDeployment });
  if (command === 'configure') configure(app);
  if (command === 'backup') backup();
  if (command === 'migrate') await migrate(database);
  if (command === 'deploy' || command === 'deploy-ci') {
    if (command === 'deploy-ci') {
      const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
      if (git(['status', '--porcelain'])) throw new Error('Cloud-verified release requires a clean committed checkout');
      const commit = git(['rev-parse', 'HEAD']);
      const gh = args => JSON.parse(execFileSync('gh', args, { cwd: root, encoding: 'utf8' }));
      const runs = gh(['run', 'list', '--workflow', 'ci.yml', '--commit', commit, '--json', 'databaseId,status,conclusion']);
      const run = runs.find(item => item.status === 'completed' && item.conclusion === 'success');
      if (!run) throw new Error('No successful GitHub CI run for this source commit');
      const details = gh(['run', 'view', String(run.databaseId), '--json', 'headSha,event,status,conclusion,jobs,url']);
      assertCloudReleaseCheck(details, commit);
      save('cloud-verification.json', { sourceCommit: commit, runId: run.databaseId, url: details.url, verifiedAt: new Date().toISOString() });
    }
    const { assertDeploymentSafety } = await import('../server/deploymentSafety.ts');
    assertDeploymentSafety(app);
    const config = json(['environment', 'config', '-e', target.environment, '--json']);
    const source = config.services[target.app]?.source;
    if (source?.branch && source.branch !== 'integration') throw new Error('B must not auto-deploy from the production branch.');
    const baseFingerprint = verifyStagingReleaseBase();
    if (command === 'deploy-ci') {
      const records = fs.readdirSync(path.join(root, 'design/releases')).filter(name => /^b-.*\.json$/.test(name))
        .map(name => JSON.parse(fs.readFileSync(path.join(root, 'design/releases', name), 'utf8')));
      const base = records.find(record => record.fingerprint === baseFingerprint && record.sourceMatchesCommit &&
        spawnSync('git', ['merge-base', '--is-ancestor', record.sourceCommit, 'HEAD'], { cwd: root }).status === 0);
      if (!base) throw new Error('No ancestor source for the verified live B baseline');
      const changed = execFileSync('git', ['diff', '--name-only', base.sourceCommit, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      assertHomepageOnlyChanges(changed);
    }
      const applied = JSON.parse(stagingSql("SELECT coalesce(json_agg(t),'[]') FROM (SELECT hash,created_at FROM drizzle.__drizzle_migrations) t"));
      const journal = JSON.parse(fs.readFileSync(path.join(root, 'migrations/meta/_journal.json'), 'utf8')).entries;
      assertKnownMigrations(applied, journal.map(entry => ({ when: entry.when, hash: sha(fs.readFileSync(path.join(root, 'migrations', `${entry.tag}.sql`))) })));
      for (const entry of journal) if (!applied.some(row => Number(row.created_at) === entry.when && row.hash === sha(fs.readFileSync(path.join(root, 'migrations', `${entry.tag}.sql`))))) throw new Error(`Run staging:backup and staging:migrate first: ${entry.tag}`);
    for (const step of command === 'deploy-ci' ? [] : ['typecheck', 'test', 'test:deployment', 'test:integrity', 'build']) {
      const result = spawnSync('npm', ['run', step], { cwd: root, stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`Release check failed: ${step}`);
    }
    let referenceAssets;
    if (fs.existsSync(path.join(root, 'bible-study-data'))) {
      referenceAssets = verifyAssets(path.join(root, 'bible-study-data'));
      if (JSON.stringify(verifyRemoteBibleAssets(app.BIBLE_STUDY_DIR)) !== JSON.stringify(referenceAssets)) throw new Error('B volume does not contain the verified reference assets');
    } else if (app.BIBLE_STUDY_DIR) throw new Error('Local reference assets required to verify this release');
    const { fingerprint } = snapshot(referenceAssets, baseFingerprint);
    save('production-before.json', { deployment: productionDeployment });
    // The CLI's 30-second upload deadline is too short for this verified snapshot.
    const upload = spawnSync(process.execPath, [path.join(root, 'ops/upload-verified-b-snapshot.mjs')], { cwd: root, stdio: 'inherit' });
    if (upload.status !== 0) throw new Error('Snapshot upload failed; inspect Railway deployment state before retrying.');
    console.log(`Uploaded immutable staging snapshot ${fingerprint}. Verify deployment and live flows before reporting completion.`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
