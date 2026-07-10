#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");
const { isLocalDatabase, pgConfig } = require("./content-tables.cjs");

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
const execute = process.argv.includes("--execute");
const dryRun = !execute;

if (!isLocalDatabase(databaseUrl) && process.env.ALLOW_NON_LOCAL_IMPORT !== "1") {
  console.error("[member-data-hygiene] Refusing to modify a non-local database.");
  console.error("[member-data-hygiene] Export production first, test locally, then run reviewed migrations intentionally.");
  process.exit(1);
}

const backupDir = path.resolve(__dirname, "..", "exports", "data-hygiene");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function rows(client, sql, params = []) {
  return (await client.query(sql, params)).rows;
}

async function count(client, sql, params = []) {
  const result = await client.query(sql, params);
  return Number(result.rows[0]?.count || 0);
}

async function createCandidateTables(client) {
  await client.query(`
    CREATE TEMP TABLE cleanup_fake_sessions ON COMMIT DROP AS
    WITH session_stats AS (
      SELECT
        s.id,
        s.church_unit,
        s.verse_reference,
        COUNT(p.*)::int AS participants,
        COUNT(*) FILTER (
          WHERE p.email ~ '^load-[0-9]+-[0-9]+@example\\.com$'
             OR p.name LIKE '壓測成員%'
        )::int AS load_count,
        COUNT(*) FILTER (
          WHERE p.email ~ '^[0-9]+@(gmail|hotmail|outlook|yahoo)\\.com(\\.tw)?$'
        )::int AS numeric_count,
        COUNT(*) FILTER (WHERE p.email LIKE '%@example.com')::int AS example_count
      FROM sessions s
      LEFT JOIN participants p ON p.session_id = s.id
      GROUP BY s.id
    )
    SELECT id
      FROM session_stats
     WHERE church_unit IN ('Automated Load Test', 'Local Stress Test', 'Codex Flow Test', 'Manual Flow Test', 'test', '測試')
        OR load_count > 0
        OR (participants >= 20 AND participants = numeric_count)
  `);

  await client.query(`
    CREATE TEMP TABLE cleanup_fake_participants ON COMMIT DROP AS
    SELECT p.id
      FROM participants p
      LEFT JOIN sessions s ON s.id = p.session_id
     WHERE p.session_id IN (SELECT id FROM cleanup_fake_sessions)
        OR p.email ~ '^load-[0-9]+-[0-9]+@example\\.com$'
        OR p.name LIKE '壓測成員%'
  `);

  await client.query(`
    CREATE TEMP TABLE cleanup_fake_potential_members ON COMMIT DROP AS
    SELECT pm.id
      FROM potential_members pm
     WHERE pm.user_id IS NULL
       AND (
          pm.email ~ '^load-[0-9]+-[0-9]+@example\\.com$'
          OR pm.name LIKE '壓測成員%'
          OR EXISTS (
            SELECT 1
              FROM participants p
              JOIN cleanup_fake_participants fp ON fp.id = p.id
             WHERE lower(trim(p.email)) = lower(trim(pm.email))
          )
       )
  `);

  await client.query(`
    CREATE TEMP TABLE cleanup_fake_persons ON COMMIT DROP AS
    SELECT DISTINCT p.id
      FROM persons p
      LEFT JOIN person_identity_links l ON l.person_id = p.id
     WHERE NOT EXISTS (
             SELECT 1
               FROM person_identity_links user_link
              WHERE user_link.person_id = p.id
                AND user_link.user_id IS NOT NULL
           )
       AND (
          p.primary_email ~ '^load-[0-9]+-[0-9]+@example\\.com$'
          OR p.display_name LIKE '壓測成員%'
          OR p.church IN ('test', '測試')
          OR l.participant_id IN (SELECT id FROM cleanup_fake_participants)
          OR l.potential_member_id IN (SELECT id FROM cleanup_fake_potential_members)
       )
  `);
}

async function collectBackup(client) {
  const backup = {};
  const tableQueries = {
    sessions: "SELECT * FROM sessions WHERE id IN (SELECT id FROM cleanup_fake_sessions) ORDER BY created_at, id",
    participants: "SELECT * FROM participants WHERE id IN (SELECT id FROM cleanup_fake_participants) ORDER BY joined_at, id",
    potential_members: "SELECT * FROM potential_members WHERE id IN (SELECT id FROM cleanup_fake_potential_members) ORDER BY created_at, id",
    persons: "SELECT * FROM persons WHERE id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    person_identity_links: `
      SELECT * FROM person_identity_links
       WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
          OR participant_id IN (SELECT id FROM cleanup_fake_participants)
          OR potential_member_id IN (SELECT id FROM cleanup_fake_potential_members)
       ORDER BY created_at, id
    `,
    study_responses: `
      SELECT * FROM study_responses
       WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
          OR user_id IN (SELECT id FROM cleanup_fake_participants)
       ORDER BY created_at, id
    `,
    submissions: `
      SELECT * FROM submissions
       WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
          OR participant_id IN (SELECT id FROM cleanup_fake_participants)
       ORDER BY submitted_at, id
    `,
    app_events: `
      SELECT * FROM app_events
       WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
          OR participant_id IN (SELECT id FROM cleanup_fake_participants)
       ORDER BY created_at, id
    `,
    app_error_events: `
      SELECT * FROM app_error_events
       WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
          OR participant_id IN (SELECT id FROM cleanup_fake_participants)
       ORDER BY created_at, id
    `,
    ai_reports: "SELECT * FROM ai_reports WHERE session_id IN (SELECT id FROM cleanup_fake_sessions) ORDER BY created_at, id",
    ai_usage_events: "SELECT * FROM ai_usage_events WHERE session_id IN (SELECT id FROM cleanup_fake_sessions) ORDER BY created_at, id",
    icebreaker_games: "SELECT * FROM icebreaker_games WHERE bible_study_session_id IN (SELECT id FROM cleanup_fake_sessions) ORDER BY created_at, id",
    icebreaker_players: "SELECT * FROM icebreaker_players WHERE participant_id IN (SELECT id FROM cleanup_fake_participants) ORDER BY joined_at, id",
    crm_scope_assignments: "SELECT * FROM crm_scope_assignments WHERE potential_member_id IN (SELECT id FROM cleanup_fake_potential_members) ORDER BY starts_at, id",
    small_group_members: "SELECT * FROM small_group_members WHERE potential_member_id IN (SELECT id FROM cleanup_fake_potential_members) ORDER BY joined_at, id",
    person_stage_progress: "SELECT * FROM person_stage_progress WHERE person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    mentor_assignments: `
      SELECT * FROM mentor_assignments
       WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
          OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
       ORDER BY created_at, id
    `,
    pastoral_tasks: "SELECT * FROM pastoral_tasks WHERE person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    serving_team_members: "SELECT * FROM serving_team_members WHERE person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY joined_at, id",
    serving_assignments: "SELECT * FROM serving_assignments WHERE person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    line_accounts: "SELECT * FROM line_accounts WHERE person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    facility_bookings: "SELECT * FROM facility_bookings WHERE requester_person_id IN (SELECT id FROM cleanup_fake_persons) ORDER BY created_at, id",
    person_journeys: `
      SELECT * FROM person_journeys
       WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
          OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
       ORDER BY created_at, id
    `,
    journey_progress: `
      SELECT jp.*
        FROM journey_progress jp
        JOIN person_journeys pj ON pj.id = jp.person_journey_id
       WHERE pj.person_id IN (SELECT id FROM cleanup_fake_persons)
          OR pj.mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
       ORDER BY jp.created_at, jp.id
    `,
    journey_milestones: `
      SELECT * FROM journey_milestones
       WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
          OR person_journey_id IN (
            SELECT id FROM person_journeys
             WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
                OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
          )
       ORDER BY created_at, id
    `,
    person_merge_suggestions: `
      SELECT * FROM person_merge_suggestions
       WHERE primary_person_id IN (SELECT id FROM cleanup_fake_persons)
          OR duplicate_person_id IN (SELECT id FROM cleanup_fake_persons)
       ORDER BY created_at, id
    `,
  };

  for (const [table, sql] of Object.entries(tableQueries)) {
    backup[table] = await rows(client, sql);
  }
  return backup;
}

async function summarize(client) {
  const cleanup = {
    sessions: await count(client, "SELECT COUNT(*)::int AS count FROM cleanup_fake_sessions"),
    participants: await count(client, "SELECT COUNT(*)::int AS count FROM cleanup_fake_participants"),
    potentialMembers: await count(client, "SELECT COUNT(*)::int AS count FROM cleanup_fake_potential_members"),
    persons: await count(client, "SELECT COUNT(*)::int AS count FROM cleanup_fake_persons"),
    users: 0,
  };

  const reviewSessions = await rows(client, `
    WITH session_stats AS (
      SELECT
        s.id,
        s.church_unit,
        s.verse_reference,
        COUNT(p.*)::int AS participants,
        COUNT(*) FILTER (
          WHERE p.email ~ '^[0-9]+@(gmail|hotmail|outlook|yahoo)\\.com(\\.tw)?$'
        )::int AS numeric_count,
        COUNT(*) FILTER (WHERE p.email LIKE '%@example.com')::int AS example_count
      FROM sessions s
      LEFT JOIN participants p ON p.session_id = s.id
      GROUP BY s.id
    )
    SELECT id, church_unit, verse_reference, participants, numeric_count, example_count
      FROM session_stats
     WHERE id NOT IN (SELECT id FROM cleanup_fake_sessions)
       AND participants > 0
       AND (
          numeric_count >= 10
          OR example_count > 0
          OR lower(coalesce(verse_reference, '')) LIKE '%test%'
          OR lower(coalesce(verse_reference, '')) IN ('abcd')
       )
     ORDER BY participants DESC, church_unit NULLS LAST
     LIMIT 20
  `);

  return { cleanup, reviewSessions };
}

async function deleteCandidates(client) {
  await client.query(`
    DELETE FROM journey_progress
     WHERE person_journey_id IN (
       SELECT id FROM person_journeys
        WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
           OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
     )
  `);
  await client.query(`
    DELETE FROM journey_milestones
     WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
        OR person_journey_id IN (
          SELECT id FROM person_journeys
           WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
              OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
        )
  `);
  await client.query(`
    DELETE FROM person_journeys
     WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
        OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)
  `);

  await client.query("DELETE FROM person_stage_progress WHERE person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM mentor_assignments WHERE person_id IN (SELECT id FROM cleanup_fake_persons) OR mentor_person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM pastoral_tasks WHERE person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM serving_assignments WHERE person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM serving_team_members WHERE person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM line_accounts WHERE person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("UPDATE facility_bookings SET requester_person_id = NULL, updated_at = NOW() WHERE requester_person_id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM person_merge_suggestions WHERE primary_person_id IN (SELECT id FROM cleanup_fake_persons) OR duplicate_person_id IN (SELECT id FROM cleanup_fake_persons)");

  await client.query("DELETE FROM crm_scope_assignments WHERE potential_member_id IN (SELECT id FROM cleanup_fake_potential_members)");
  await client.query("DELETE FROM small_group_members WHERE potential_member_id IN (SELECT id FROM cleanup_fake_potential_members)");

  await client.query(`
    DELETE FROM person_identity_links
     WHERE person_id IN (SELECT id FROM cleanup_fake_persons)
        OR participant_id IN (SELECT id FROM cleanup_fake_participants)
        OR potential_member_id IN (SELECT id FROM cleanup_fake_potential_members)
  `);

  await client.query(`
    DELETE FROM study_responses
     WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
        OR user_id IN (SELECT id FROM cleanup_fake_participants)
  `);
  await client.query(`
    DELETE FROM submissions
     WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
        OR participant_id IN (SELECT id FROM cleanup_fake_participants)
  `);
  await client.query(`
    DELETE FROM app_events
     WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
        OR participant_id IN (SELECT id FROM cleanup_fake_participants)
  `);
  await client.query(`
    DELETE FROM app_error_events
     WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)
        OR participant_id IN (SELECT id FROM cleanup_fake_participants)
  `);
  await client.query("DELETE FROM ai_reports WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)");
  await client.query("DELETE FROM ai_usage_events WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)");
  await client.query("DELETE FROM icebreaker_players WHERE participant_id IN (SELECT id FROM cleanup_fake_participants)");
  await client.query("DELETE FROM icebreaker_games WHERE bible_study_session_id IN (SELECT id FROM cleanup_fake_sessions)");

  await client.query("DELETE FROM participants WHERE id IN (SELECT id FROM cleanup_fake_participants)");
  await client.query("DELETE FROM potential_members WHERE id IN (SELECT id FROM cleanup_fake_potential_members)");
  await client.query("DELETE FROM persons WHERE id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM sessions WHERE id IN (SELECT id FROM cleanup_fake_sessions)");
}

async function main() {
  const pool = new pg.Pool(pgConfig(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createCandidateTables(client);
    const summaryBefore = await summarize(client);
    const backup = await collectBackup(client);

    const backupPayload = {
      generatedAt: new Date().toISOString(),
      mode: dryRun ? "dry-run" : "execute",
      databaseUrl: isLocalDatabase(databaseUrl) ? "local" : "non-local",
      summary: summaryBefore,
      backup,
    };

    let backupPath = null;
    if (execute) {
      fs.mkdirSync(backupDir, { recursive: true });
      backupPath = path.join(backupDir, `member-cleanup-${timestamp()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2));
      await deleteCandidates(client);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }

    console.log(JSON.stringify({
      mode: dryRun ? "dry-run" : "execute",
      backupPath,
      ...summaryBefore,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[member-data-hygiene] failed:", error.message);
  process.exit(1);
});
