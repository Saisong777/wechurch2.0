import { randomUUID } from 'node:crypto';
import { railway, target } from '../scripts/railway-staging.mjs';

export const snapshotProofSql = `CREATE TEMP TABLE backup_proof(schema text,"table" text,rows integer,digest text);
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '__SNAPSHOT__';
SET TIME ZONE 'UTC';
DO $proof$ DECLARE t record; n integer; d text; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname::text COLLATE "C",tablename::text COLLATE "C" LOOP
EXECUTE format($query$SELECT count(*)::int,md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5(row_to_json(t)::text) AS h FROM %I.%I t) v$query$,t.schemaname,t.tablename) INTO n,d;
INSERT INTO backup_proof VALUES(t.schemaname,t.tablename,n,d);
END LOOP; END $proof$;
SELECT json_agg(t ORDER BY schema COLLATE "C","table" COLLATE "C") FROM backup_proof t;
COMMIT;`;

// Both the dump and table proofs import one snapshot held inside the B database container.
export function encryptedDatabaseSnapshot() {
  const directory = `/tmp/wechurch-snapshot-${randomUUID()}`;
  const script = `set -eu
umask 077
mkdir ${directory}
keeper=''
trap 'if [ -n "$keeper" ]; then kill "$keeper" 2>/dev/null || true; wait "$keeper" 2>/dev/null || true; fi; rm -rf ${directory}' EXIT
psql -XqAt -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" >${directory}/snapshot <<'SQL' &
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT pg_export_snapshot();
SELECT pg_sleep(180);
SQL
keeper=$!
i=0
while [ ! -s ${directory}/snapshot ]; do i=$((i+1)); [ "$i" -lt 30 ] || exit 1; sleep 1; done
snapshot=$(head -n 1 ${directory}/snapshot)
case "$snapshot" in ''|*[!0-9A-F-]*) exit 1;; esac
printf %s ${Buffer.from(snapshotProofSql).toString('base64')} | base64 -d | sed "s/__SNAPSHOT__/$snapshot/" | psql -XqAt -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" >${directory}/proof
pg_dump --snapshot="$snapshot" -U "$PGUSER" -d "$PGDATABASE" -Fc -f ${directory}/database.dump
pg_restore -l ${directory}/database.dump >/dev/null
printf '{"snapshot":"%s","tables":' "$snapshot"
cat ${directory}/proof
printf ',"dump":"'
base64 ${directory}/database.dump | tr -d '\\n'
printf '"}'
`;
  try {
    const command = `printf %s ${Buffer.from(script).toString('base64')} | base64 -d | sh`;
    const data = JSON.parse(railway(['ssh','-p',target.project,'-e',target.environment,'-s',target.database,'--','sh','-c',`'${command}'`],{timeout:180000,maxBuffer:64*1024*1024}));
    const dump = Buffer.from(data.dump,'base64');
    if (dump.subarray(0,5).toString()!=='PGDMP' || !Array.isArray(data.tables)) throw new Error('Invalid snapshot');
    return {dump,tables:data.tables,snapshot:data.snapshot};
  } catch { throw new Error('Encrypted B snapshot transport failed; no partial backup is valid'); }
}
