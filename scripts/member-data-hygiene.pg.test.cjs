const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
const { main } = require('./member-data-hygiene.cjs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Disposable PostgreSQL fixture Docker operation failed: ${args[0]}`);
  return result.stdout.trim();
}

// Never accept DATABASE_URL: this test owns a newly-created container with no host data mounts.
test('cleanup protects its backup snapshot against concurrent edits using two real PostgreSQL connections', { timeout: 90000 }, async t => {
  const name = `wechurch-hygiene-test-${randomUUID()}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hygiene-pg-'));
  const password = randomUUID();
  let created = false;
  let cleanup;
  let writer;
  try {
    docker(['image', 'inspect', 'postgres:16-alpine']);
    docker(['run', '--pull=never', '--rm', '-d', '--name', name, '--memory=512m', '--cpus=1', '--pids-limit=128',
      '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_USER=fixture', '-e', 'POSTGRES_DB=fixture', '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine']);
    created = true;
    const binding = docker(['port', name, '5432/tcp']);
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const port = Number(binding.split(':')[1]);
    const config = { host: '127.0.0.1', port, user: 'fixture', password, database: 'fixture', ssl: false,
      options: '', connectionTimeoutMillis: 1000, statement_timeout: 5000 };
    for (let attempt = 0; attempt < 60; attempt++) {
      const probe = spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'fixture', '-d', 'fixture'], { timeout: 3000, stdio: 'ignore' });
      if (probe.status === 0) break;
      if (attempt === 59) throw new Error('Disposable PostgreSQL did not start');
      await delay(100);
    }
    cleanup = new Client(config);
    writer = new Client(config);
    await cleanup.connect();
    await writer.connect();
    const writerPid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    assert.notEqual((await cleanup.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, writerPid);

    // Minimal relational fixture for the maintenance queries; all data below is synthetic.
    const tables = ['sessions', 'participants', 'participant_access', 'potential_members', 'persons', 'person_identity_links',
      'study_responses', 'submissions', 'app_events', 'app_error_events', 'ai_reports', 'ai_usage_events', 'icebreaker_games',
      'icebreaker_players', 'crm_scope_assignments', 'small_group_members', 'person_stage_progress', 'mentor_assignments',
      'pastoral_tasks', 'serving_team_members', 'serving_assignments', 'line_accounts', 'facility_bookings', 'person_journeys',
      'journey_progress', 'journey_milestones', 'person_merge_suggestions'];
    for (const table of tables) {
      await cleanup.query(`CREATE TABLE ${table} (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
        joined_at timestamptz DEFAULT now(), submitted_at timestamptz DEFAULT now(), starts_at timestamptz DEFAULT now(),
        session_id uuid, participant_id uuid, user_id uuid, person_id uuid, mentor_person_id uuid, potential_member_id uuid,
        person_journey_id uuid, primary_person_id uuid, duplicate_person_id uuid, requester_person_id uuid,
        bible_study_session_id uuid, observation text)`);
    }
    await cleanup.query('ALTER TABLE participants ADD FOREIGN KEY (session_id) REFERENCES sessions(id)');
    await cleanup.query('ALTER TABLE study_responses ADD FOREIGN KEY (session_id) REFERENCES sessions(id)');
    await cleanup.query('ALTER TABLE participant_access ADD FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE');
    const sessionId = randomUUID();
    const participantId = randomUUID();
    const responseId = randomUUID();
    await cleanup.query('INSERT INTO sessions(id) VALUES($1)', [sessionId]);
    await cleanup.query('INSERT INTO participants(id,session_id) VALUES($1,$2)', [participantId, sessionId]);
    await cleanup.query("INSERT INTO study_responses(id,session_id,user_id,observation) VALUES($1,$2,$3,'original')", [responseId, sessionId, participantId]);
    const options = { databaseUrl: 'postgresql://localhost/fixture', execute: true, manifest: {
      version: 1, reviewed: true, sessionIds: [sessionId], participantIds: [participantId], personIds: [], potentialMemberIds: [],
    } };
    const poolFor = query => ({ async connect() { return { query, release() {} }; }, async end() {} });

    await t.test('an edit committed after the transaction snapshot aborts before deletion', async () => {
      const statements = [];
      let edited = false;
      const query = async (sql, params) => {
        statements.push(sql);
        if (!edited && sql.includes('SELECT * FROM study_responses')) {
          edited = true;
          await writer.query("UPDATE study_responses SET observation='committed edit' WHERE id=$1", [responseId]);
        }
        return cleanup.query(sql, params);
      };
      const backupDir = path.join(dir, 'conflict');
      await assert.rejects(main(options, { pool: poolFor(query), backupDir }), error => error.code === '40001' && /fresh dry-run/.test(error.message));
      assert.equal(edited, true);
      assert.ok(statements.every(sql => !sql.includes('DELETE FROM') && sql !== 'COMMIT'));
      assert.equal((await writer.query('SELECT observation FROM study_responses WHERE id=$1', [responseId])).rows[0].observation, 'committed edit');
      assert.equal(fs.existsSync(backupDir), false);
    });

    await t.test('an edit attempted after backup is locked out until the protected deletion commits', async () => {
      await cleanup.query("UPDATE study_responses SET observation='backed-up version' WHERE id=$1", [responseId]);
      let update;
      let blocked = false;
      const query = async (sql, params) => {
        const result = await cleanup.query(sql, params);
        if (!update && sql.includes('SELECT * FROM study_responses')) {
          update = writer.query("UPDATE study_responses SET observation='late edit' WHERE id=$1", [responseId]);
          update.catch(() => {});
          for (let i = 0; i < 100; i++) {
            const locks = await cleanup.query('SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted', [writerPid]);
            if (locks.rowCount) { blocked = true; break; }
            await delay(10);
          }
          assert.equal(blocked, true, 'writer must wait on the backed-up child row');
        }
        return result;
      };
      const result = await main(options, { pool: poolFor(query), backupDir: path.join(dir, 'success') });
      assert.equal((await update).rowCount, 0);
      const backup = JSON.parse(fs.readFileSync(result.backupPath, 'utf8'));
      assert.equal(backup.backup.study_responses[0].observation, 'backed-up version');
      assert.equal((await writer.query('SELECT 1 FROM study_responses WHERE id=$1', [responseId])).rowCount, 0);
    });
  } finally {
    if (cleanup) await cleanup.end().catch(() => {});
    if (writer) await writer.end().catch(() => {});
    if (created) docker(['rm', '-f', name]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
