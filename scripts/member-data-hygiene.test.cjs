const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateManifest, loadOptions, createCandidateTables, main } = require('./member-data-hygiene.cjs');

const id = '10000000-0000-0000-0000-000000000001';
const manifest = (extra = {}) => ({ version: 1, reviewed: true, sessionIds: [id], participantIds: [], potentialMemberIds: [], personIds: [], ...extra });

test('execute requires explicit reviewed, valid and nonempty targets', () => {
  assert.throws(() => loadOptions(['--execute']), /--manifest/);
  assert.throws(() => validateManifest(manifest({ reviewed: false }), true), /reviewed/);
  assert.throws(() => validateManifest(manifest({ sessionIds: [] }), true), /non-empty/);
  assert.throws(() => validateManifest(manifest({ sessionIds: [id, id] }), true), /sessionIds/);
  assert.throws(() => validateManifest(manifest({ personIds: ['test'] }), true), /personIds/);
  assert.throws(() => validateManifest(manifest({ name: 'load-test' }), true), /manifest/);
  assert.deepEqual(validateManifest(manifest(), true), manifest());
});

function fakeDatabase({ unreviewed = false, failDelete = false } = {}) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (failDelete && sql.includes('DELETE FROM')) throw new Error('delete failed');
      if (sql.includes('FOR UPDATE') && Array.isArray(params?.[0])) return { rows: params[0].map(id => ({ id })) };
      if (sql.includes('AND NOT (id = ANY')) return { rows: unreviewed ? [{ id: 'unreviewed' }] : [] };
      if (sql.includes('COUNT(*)')) return { rows: [{ count: 0 }] };
      return { rows: [] };
    },
    release() {},
  };
  return { client, queries, pool: { async connect() { return client; }, async end() {} } };
}

test('candidate selection uses only bound reviewed IDs, never names or emails', async () => {
  const db = fakeDatabase();
  await createCandidateTables(db.client, manifest());
  for (const { sql, params } of db.queries.filter(q => q.sql.includes('CREATE TEMP'))) {
    assert.match(sql, /id = ANY\(\$1::uuid\[\]\)/);
    assert.doesNotMatch(sql, /name|email|LIKE|load_count|church_unit/);
    assert.equal(params.length, 1);
  }
  const mixed = fakeDatabase({ unreviewed: true });
  await assert.rejects(createCandidateTables(mixed.client, manifest()), /Every participant/);
  await assert.rejects(createCandidateTables({ async query() { return { rows: [] }; } }, manifest()), /Missing or protected/);
});

test('CLI retains non-local protection and defaults reviewed manifests to dry-run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hygiene-manifest-'));
  try {
    const filename = path.join(dir, 'targets.json');
    fs.writeFileSync(filename, JSON.stringify(manifest()));
    assert.equal(loadOptions(['--manifest', filename], {}).execute, false);
    assert.throws(() => loadOptions(['--manifest', filename, '--execute'], { DATABASE_URL: 'postgresql://remote.test/test' }), /non-local/);
    assert.equal(loadOptions(['--manifest', filename, '--execute'], { DATABASE_URL: 'postgresql://remote.test/test', ALLOW_NON_LOCAL_IMPORT: '1' }).execute, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dry-run rolls back and performs no deletion or backup write', async () => {
  const db = fakeDatabase();
  const result = await main({ databaseUrl: 'postgresql://localhost/test', execute: false, manifest: manifest() }, { pool: db.pool });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.backupPath, null);
  assert.ok(db.queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(db.queries.some(q => q.sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE'));
  assert.ok(db.queries.filter(q => q.sql.trim().startsWith('SELECT *')).every(q => q.sql.endsWith('FOR UPDATE')));
  assert.ok(db.queries.every(q => !q.sql.includes('DELETE FROM') && q.sql !== 'COMMIT'));
});

test('execute backs up reviewed targets before deletion and commits; failures roll back', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hygiene-unit-'));
  try {
    for (const failDelete of [false, true]) {
      const db = fakeDatabase({ failDelete });
      const destination = path.join(dir, String(failDelete));
      const original = db.client.query;
      db.client.query = async (sql, params) => {
        if (sql.includes('DELETE FROM')) {
          const files = fs.readdirSync(destination);
          assert.equal(files.length, 1);
          const backup = path.join(destination, files[0]);
          assert.deepEqual(JSON.parse(fs.readFileSync(backup, 'utf8')).manifest, manifest());
          assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
        }
        return original(sql, params);
      };
      const operation = main({ databaseUrl: 'postgresql://localhost/test', execute: true, manifest: manifest() }, { pool: db.pool, backupDir: destination });
      if (failDelete) await assert.rejects(operation, /delete failed/);
      else await operation;
      assert.ok(db.queries.some(q => q.sql === (failDelete ? 'ROLLBACK' : 'COMMIT')));
      if (failDelete) assert.ok(db.queries.every(q => q.sql !== 'COMMIT'));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
