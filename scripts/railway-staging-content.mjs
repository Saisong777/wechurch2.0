import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';
import content from './content-tables.cjs';
import { root, target, railway, inspectStaging } from './railway-staging.mjs';

const source = Object.freeze({ environment: 'f4b11351-cf4c-4a95-a3c0-45b195e9a0e0', database: '9c98580e-5740-4860-80ac-de741b0d2561' });
const evidence = path.join(root, 'artifacts/railway-staging');
const columns = names => names.split(' ').map(name => [name, name]);
export const tables = [
  ...content.TABLES,
  { table: 'reading_plan_templates', orderBy: 'id', columns: columns('id name description category duration_days is_public created_by created_at updated_at') },
  { table: 'reading_plan_template_items', orderBy: 'template_id, day_number, id', columns: columns('id template_id day_number title book_name chapter_start chapter_end verse_start verse_end scripture_reference notes') },
];
const allowed = new Set(['chinese_union_trad', 'blessing_verses', 'jesus_4seasons', 'reading_plan_templates', 'reading_plan_template_items']);
const quote = name => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid identifier');
  return `"${name}"`;
};
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function selectSql(table, fromSource = false) {
  if (!allowed.has(table.table)) throw new Error('Table is not public reference content');
  const fields = table.columns.map(([, name]) => fromSource && name === 'created_by' ? 'NULL::uuid AS created_by' : quote(name));
  let filter = '';
  if (fromSource && table.table === 'reading_plan_templates') filter = ' WHERE is_public = true';
  if (fromSource && table.table === 'reading_plan_template_items') filter = ' WHERE template_id IN (SELECT id FROM reading_plan_templates WHERE is_public = true)';
  return `SELECT ${fields.join(',')} FROM ${quote(table.table)}${filter} ORDER BY ${table.orderBy}`;
}
export function actionFor(existing, incoming) {
  if (digest(existing) === digest(incoming)) return 'unchanged';
  if (existing.length) throw new Error('Destination contains different content; refusing to overwrite');
  return 'insert';
}
export function validateBible(rows) {
  const books = new Set(), chapters = new Set(), ids = new Set(), locations = new Set();
  const knownEmptyVerses = [];
  for (const row of rows) {
    const location = JSON.stringify([row.book_name, row.chapter, row.verse]);
    // Observed source defect: preserve it exactly instead of silently inventing Scripture.
    const knownEmpty = row.verse_id === 26382 && row.book_name === '\u7d04\u7ff0\u798f\u97f3' && row.chapter === 7 && row.verse === 53 && row.text === '';
    if (knownEmpty) knownEmptyVerses.push({ verseId: row.verse_id, book: row.book_name, chapter: row.chapter, verse: row.verse });
    if (!row.book_name?.trim() || (!row.text?.trim() && !knownEmpty) || !Number.isInteger(row.verse_id) || !Number.isInteger(row.chapter) || row.chapter < 1 || !Number.isInteger(row.verse) || row.verse < 1 || ids.has(row.verse_id) || locations.has(location)) throw new Error('Invalid or duplicate Bible verse');
    books.add(row.book_name); chapters.add(JSON.stringify([row.book_name, row.chapter])); ids.add(row.verse_id); locations.add(location);
  }
  if (books.size !== 66 || chapters.size !== 1189 || rows.length !== 31102) throw new Error('Expected complete traditional Union Bible (66 books, 1189 chapters, 31102 verses)');
  return { books: books.size, chapters: chapters.size, verses: rows.length, knownEmptyVerses };
}
function verifyBackup() {
  const backup = JSON.parse(fs.readFileSync(path.join(evidence, 'backup.json'), 'utf8'));
  const age = Date.now() - Date.parse(backup.createdAt);
  if (backup.environment !== target.environment || !backup.archiveListVerified || !Number.isFinite(age) || age < 0 || age > 3600000 || path.basename(backup.file) !== backup.file) throw new Error('A verified B backup from the last hour is required');
  const bytes = fs.readFileSync(path.join(evidence, backup.file));
  if (bytes.subarray(0, 5).toString() !== 'PGDMP' || createHash('sha256').update(bytes).digest('hex') !== backup.sha256) throw new Error('Backup integrity check failed');
  return backup.sha256;
}
function connect(url) {
  // Preserve PostgreSQL timestamp precision so the complete readback hash is exact.
  return new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000, query_timeout: 65000, types: { getTypeParser: (oid, format) => [1082, 1114, 1184].includes(oid) ? value => value : pg.types.getTypeParser(oid, format) } });
}
function save(name, value) {
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
export async function main(command = 'check') {
  if (!['check', 'apply'].includes(command)) throw new Error('Usage: node scripts/railway-staging-content.mjs [check|apply]');
  const state = inspectStaging();
  const sourceVars = JSON.parse(railway(['variable', 'list', '-e', source.environment, '-s', source.database, '--json']));
  if (sourceVars.RAILWAY_ENVIRONMENT_ID !== source.environment || sourceVars.RAILWAY_SERVICE_ID !== source.database || !sourceVars.DATABASE_PUBLIC_URL || !state.database.DATABASE_PUBLIC_URL || sourceVars.DATABASE_PUBLIC_URL === state.database.DATABASE_PUBLIC_URL || new URL(sourceVars.DATABASE_URL).hostname === new URL(state.database.DATABASE_URL).hostname) throw new Error('Source/destination identity check failed');
  const backupSha256 = command === 'apply' ? verifyBackup() : null;
  const a = connect(sourceVars.DATABASE_PUBLIC_URL);
  const b = connect(state.database.DATABASE_PUBLIC_URL);
  let bConnected = false;
  try {
    await a.connect();
    await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await a.query("SET LOCAL statement_timeout = '60s'");
    await a.query("SET LOCAL TIME ZONE 'UTC'");
    const snapshot = {};
    for (const table of tables) snapshot[table.table] = (await a.query(selectSql(table, true))).rows;
    const bible = validateBible(snapshot.chinese_union_trad);
    await a.query('ROLLBACK');
    save('public-content-snapshot.json', snapshot);
    console.log('Public source snapshot validated; checking B.');
    await b.connect();
    bConnected = true;
    await b.query(command === 'apply' ? 'BEGIN' : 'BEGIN READ ONLY');
    await b.query("SET LOCAL lock_timeout = '5s'");
    await b.query("SET LOCAL statement_timeout = '60s'");
    await b.query("SET LOCAL TIME ZONE 'UTC'");
    if (command === 'apply') {
      await b.query('SELECT pg_advisory_xact_lock(937154)');
      // Block concurrent edits only to these public tables while verifying/importing.
      await b.query(`LOCK TABLE ${tables.map(t => quote(t.table)).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    }
    const result = [];
    for (const table of tables) {
      const incoming = snapshot[table.table];
      const existing = (await b.query(selectSql(table))).rows;
      result.push({ table: table.table, before: existing.length, after: incoming.length, action: actionFor(existing, incoming), sha256: digest(incoming) });
    }
    if (command === 'apply') {
      for (const table of tables) {
        if (result.find(r => r.table === table.table).action !== 'insert') continue;
        const fields = table.columns.map(([, name]) => name);
        const incoming = snapshot[table.table];
        for (let start = 0; start < incoming.length; start += 500) {
          const batch = incoming.slice(start, start + 500);
          const values = batch.flatMap(row => fields.map(field => row[field]));
          const placeholders = batch.map((_, i) => `(${fields.map((_, j) => `$${i * fields.length + j + 1}`).join(',')})`);
          await b.query(`INSERT INTO ${quote(table.table)} (${fields.map(quote).join(',')}) VALUES ${placeholders.join(',')}`, values);
        }
      }
      for (const table of tables) {
        if (digest((await b.query(selectSql(table))).rows) !== digest(snapshot[table.table])) throw new Error(`Readback mismatch: ${table.table}`);
      }
      for (const table of ['blessing_verses', 'jesus_4seasons']) {
        if (result.find(r => r.table === table).action === 'insert') await b.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT max(id) FROM ${quote(table)}), true)`, [table]);
      }
      await b.query('COMMIT');
    } else await b.query('ROLLBACK');
    const report = { at: new Date().toISOString(), command, destination: target.environment, backupSha256, sourceReadOnly: true, productionDeployment: state.productionDeployment, bible, tables: result };
    save(`public-content-${command}.json`, report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (bConnected) await b.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await a.end().catch(() => {});
    await b.end().catch(() => {});
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) { console.error('No target override is supported'); process.exitCode = 1; }
  else main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
