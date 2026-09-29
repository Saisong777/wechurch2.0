// Explicit, one-time B membership assignment. No registration defaults or roles change.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectStaging, stagingSql, root, target } from '../scripts/railway-staging.mjs';
import { readBackupKey, seal, unseal, hash } from '../scripts/backup-envelope.mjs';

const tables = ['users', 'persons', 'potential_members'];
const church = 'IM 行動教會';
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const rowsSql = table => `SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'church',church,'updatedAt',updated_at) ORDER BY id),'[]'::jsonb) FROM ${table}`;
const protectedSql = table => `SELECT md5(coalesce(string_agg(md5((to_jsonb(t)-'church'-'updated_at')::text),'' ORDER BY id),'')) FROM ${table} t`;
const state = inspectStaging();
const before = Object.fromEntries(tables.map(table => [table, JSON.parse(stagingSql(rowsSql(table)))]));
const counts = Object.fromEntries(tables.map(table => [table, {
  total: before[table].length, changes: before[table].filter(row => row.church !== church).length,
}]));
console.log(JSON.stringify({ environment: 'B', counts, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);
// Stop rather than silently including people added since Sai's inspected request.
assert.equal(before.users.length, 68, 'Membership changed; inspect again before assignment');
assert.equal(before.persons.length, 0, 'Pastoral records changed; inspect associations first');
assert.equal(before.potential_members.length, 0, 'Prospect records changed; inspect associations first');
assert(before.users.every(row => row.church === null || row.church === church), 'Unexpected church; review before assignment');

process.umask(0o077);
const directory = path.join(os.homedir(), '.local/share/wechurch-migration/private-maintenance', `im-assignment-${randomUUID()}`);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const key = readBackupKey(path.join(os.homedir(), '.config/wechurch-im-migration/backup.key'), root);
const backup = Buffer.from(JSON.stringify({ format: 1, environment: target.environment, church, before, createdAt: new Date().toISOString() }));
try {
  const encrypted = seal(backup, key);
  const file = path.join(directory, 'membership-before.json.enc');
  fs.writeFileSync(file, encrypted, { flag: 'wx', mode: 0o600 });
  assert.equal(hash(unseal(fs.readFileSync(file), key)), hash(backup));
} finally { key.fill(0); }

const transaction = `BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL TIME ZONE 'UTC';
LOCK TABLE users,persons,potential_members IN SHARE ROW EXCLUSIVE MODE;
${tables.map(table => `DO $guard$ BEGIN
IF (${rowsSql(table)}) <> ${literal(JSON.stringify(before[table]))}::jsonb THEN
RAISE EXCEPTION 'Membership changed since encrypted backup'; END IF; END $guard$;`).join('\n')}
CREATE TEMP TABLE protected_before AS ${tables.map(table => `SELECT '${table}' AS name,(${protectedSql(table)}) AS digest`).join(' UNION ALL ')};
${tables.map(table => `UPDATE ${table} SET church=${literal(church)},updated_at=now() WHERE church IS DISTINCT FROM ${literal(church)};`).join('\n')}
${tables.map(table => `DO $verify$ BEGIN
IF EXISTS(SELECT 1 FROM ${table} WHERE church IS DISTINCT FROM ${literal(church)}) OR
(${protectedSql(table)}) <> (SELECT digest FROM protected_before WHERE name='${table}') THEN
RAISE EXCEPTION 'Assignment invariant failed'; END IF; END $verify$;`).join('\n')}
SELECT json_build_object('assigned',true,'protectedFieldsUnchanged',true,'users',(SELECT count(*) FROM users),'persons',(SELECT count(*) FROM persons),'potentialMembers',(SELECT count(*) FROM potential_members));
COMMIT;`;
const result = JSON.parse(stagingSql(transaction));
const readback = Object.fromEntries(tables.map(table => [table, JSON.parse(stagingSql(`SELECT json_build_object('total',count(*),'assigned',count(*) FILTER(WHERE church=${literal(church)})) FROM ${table}`))]));
for (const value of Object.values(readback)) assert.equal(value.total, value.assigned);
assert.equal(inspectStaging().productionDeployment, state.productionDeployment);
const evidence = { ...result, readback, backupVerified: true, productionUnchanged: true, at: new Date().toISOString() };
fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(evidence, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ ...evidence, backupDirectory: directory }));
