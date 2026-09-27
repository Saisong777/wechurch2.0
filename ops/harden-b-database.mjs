import fs from 'node:fs';
import path from 'node:path';
import { inspectStaging, stagingSql, railway, root, target } from '../scripts/railway-staging.mjs';
import { hash, readBackupKey, unseal } from '../scripts/backup-envelope.mjs';

function verifyBackup() {
  const manifestPath = fs.realpathSync(process.env.WECHURCH_BACKUP_MANIFEST || '');
  if (!path.relative(root, manifestPath).startsWith(`..${path.sep}`)) throw new Error('Backup must be outside repository');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const age = Date.now()-Date.parse(manifest.createdAt);
  const entry = manifest.files?.find(file=>file.name==='database.dump.enc');
  if (!manifest.complete || manifest.environment!==target.environment || age<0 || age>3600000 || !entry) throw new Error('Fresh verified B backup required');
  const bytes = fs.readFileSync(path.join(path.dirname(manifestPath),entry.name));
  if (hash(bytes)!==entry.sha256) throw new Error('Backup checksum mismatch');
  const key = readBackupKey(process.env.WECHURCH_BACKUP_KEY_FILE,root);
  try { if (unseal(bytes,key).subarray(0,5).toString()!=='PGDMP') throw new Error('Invalid backup'); }
  finally { key.fill(0); }
}

try {
  const state = inspectStaging();
  verifyBackup();
  if (process.argv[2] !== '--apply') throw new Error('Use --apply for the B-only runtime role change');
  const existing = JSON.parse(stagingSql("SELECT json_build_object('exists',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wechurch_app'))"));
  if (existing.exists) throw new Error('Runtime role already exists; inspect instead of rotating credentials blindly');
  const result = JSON.parse(stagingSql(`BEGIN;
    CREATE TEMP TABLE runtime_secret ON COMMIT DROP AS SELECT replace(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'-','') AS value;
    DO $role$ BEGIN EXECUTE format('CREATE ROLE wechurch_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40 PASSWORD %L',(SELECT value FROM runtime_secret)); END $role$;
    GRANT USAGE ON SCHEMA public TO wechurch_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO wechurch_app;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO wechurch_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO wechurch_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO wechurch_app;
    ALTER ROLE wechurch_app SET statement_timeout='15s';
    ALTER ROLE wechurch_app SET idle_in_transaction_session_timeout='30s';
    DO $check$ BEGIN IF has_schema_privilege('wechurch_app','public','CREATE') OR has_database_privilege('wechurch_app',current_database(),'CREATE') THEN RAISE EXCEPTION 'Unexpected runtime DDL privilege'; END IF; END $check$;
    SELECT json_build_object('password',value) FROM runtime_secret;
    COMMIT;`));
  const url = new URL(state.database.DATABASE_URL);
  url.username='wechurch_app'; url.password=result.password;
  railway(['variable','set','-e',target.environment,'-s',target.app,'--skip-deploys','--stdin','DATABASE_URL'],{input:url.href});
  const after = inspectStaging();
  if (new URL(after.app.DATABASE_URL).username!=='wechurch_app' || after.productionDeployment!==state.productionDeployment) throw new Error('Runtime setting readback failed');
  console.log(JSON.stringify({bRuntimeRoleConfigured:true,requiresVerifiedDeployment:true,productionUnchanged:true,superuser:false,ddl:false,maintenance:'encrypted Railway exec'}));
} catch (error) {
  console.error(error instanceof Error && !('stdout' in error) ? error.message : 'B runtime role operation failed; inspect without printing credentials');
  process.exitCode=1;
}
