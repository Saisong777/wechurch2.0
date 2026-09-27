#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");
const { isLocalDatabase, pgConfig } = require("./content-tables.cjs");

const backupDir = path.resolve(__dirname, "..", "exports", "data-hygiene");
const targetKeys = ["sessionIds", "participantIds", "potentialMemberIds", "personIds"];

function validateManifest(input, execute = false) {
  if (!input || input.version !== 1 || typeof input.reviewed !== "boolean" ||
      Object.keys(input).some(key => !["version", "reviewed", ...targetKeys].includes(key))) {
    throw new Error("Expected a version 1 cleanup manifest with reviewed and explicit target ID arrays");
  }
  for (const key of targetKeys) {
    const ids = input[key];
    if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) ||
        new Set(ids.map(id => id.toLowerCase())).size !== ids.length) throw new Error(`Invalid ${key}`);
  }
  if (execute && (!input.reviewed || !targetKeys.some(key => input[key].length))) {
    throw new Error("Execute requires a reviewed, non-empty target manifest");
  }
  return Object.fromEntries([ ["version", 1], ["reviewed", input.reviewed], ...targetKeys.map(key => [key, input[key].map(id => id.toLowerCase())]) ]);
}

function loadOptions(args, env = process.env) {
  const execute = args.includes("--execute");
  const manifestIndex = args.indexOf("--manifest");
  if (manifestIndex < 0 || !args[manifestIndex + 1] ||
      args.filter(arg => arg === "--manifest").length !== 1 ||
      args.some((arg, i) => i !== manifestIndex + 1 && !["--manifest", "--execute"].includes(arg))) {
    throw new Error("Use --manifest <reviewed-targets.json> [--execute]; no automatic cleanup targets are selected");
  }
  const manifestPath = args[manifestIndex + 1];
  if (fs.statSync(manifestPath).size > 256 * 1024) throw new Error("Cleanup manifest is too large");
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")), execute);
  const databaseUrl = env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
  if (!isLocalDatabase(databaseUrl) && env.ALLOW_NON_LOCAL_IMPORT !== "1") throw new Error("Refusing non-local database without explicit override");
  return { execute, databaseUrl, manifest };
}

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

async function createCandidateTables(client, manifest) {
  validateManifest(manifest);
  const targets = [
    ["sessions", "sessionIds", ""],
    ["participants", "participantIds", ""],
    ["potential_members", "potentialMemberIds", "AND user_id IS NULL"],
    ["persons", "personIds", "AND NOT EXISTS (SELECT 1 FROM person_identity_links l WHERE l.person_id = persons.id AND l.user_id IS NOT NULL)"],
  ];
  for (const [table, key, guard] of targets) {
    // Lock explicit parents before inspecting dependent rows; new FK references must wait.
    const selected = await rows(client, `SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) ${guard} FOR UPDATE`, [manifest[key]]);
    if (selected.length !== manifest[key].length) throw new Error(`Missing or protected targets in ${key}`);
    await client.query(`CREATE TEMP TABLE cleanup_fake_${table} ON COMMIT DROP AS SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`, [manifest[key]]);
  }
  const unreviewed = await rows(client, `SELECT id FROM participants WHERE session_id = ANY($1::uuid[]) AND NOT (id = ANY($2::uuid[])) LIMIT 1`, [manifest.sessionIds, manifest.participantIds]);
  if (unreviewed.length) throw new Error("Every participant in a selected session must be explicitly reviewed in participantIds");
}

async function collectBackup(client) {
  const backup = {};
  const tableQueries = {
    sessions: "SELECT * FROM sessions WHERE id IN (SELECT id FROM cleanup_fake_sessions) ORDER BY created_at, id",
    participants: "SELECT * FROM participants WHERE id IN (SELECT id FROM cleanup_fake_participants) ORDER BY joined_at, id",
    participant_access: "SELECT * FROM participant_access WHERE participant_id IN (SELECT id FROM cleanup_fake_participants) ORDER BY participant_id",
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
    // Hold every backed-up row through deletion. A concurrent change since the
    // serializable snapshot raises 40001 here, before any destructive statement.
    backup[table] = await rows(client, `${sql} FOR UPDATE`);
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

  return { cleanup };
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
  await client.query("DELETE FROM ai_usage_events WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)");
  await client.query("DELETE FROM ai_reports WHERE session_id IN (SELECT id FROM cleanup_fake_sessions)");
  await client.query("DELETE FROM icebreaker_players WHERE participant_id IN (SELECT id FROM cleanup_fake_participants)");
  await client.query("DELETE FROM icebreaker_games WHERE bible_study_session_id IN (SELECT id FROM cleanup_fake_sessions)");

  await client.query("DELETE FROM participants WHERE id IN (SELECT id FROM cleanup_fake_participants)");
  await client.query("DELETE FROM potential_members WHERE id IN (SELECT id FROM cleanup_fake_potential_members)");
  await client.query("DELETE FROM persons WHERE id IN (SELECT id FROM cleanup_fake_persons)");
  await client.query("DELETE FROM sessions WHERE id IN (SELECT id FROM cleanup_fake_sessions)");
}

async function main(options = loadOptions(process.argv.slice(2)), dependencies = {}) {
  const { databaseUrl, execute, manifest } = options;
  validateManifest(manifest, execute);
  const dryRun = !execute;
  const pool = dependencies.pool || new pg.Pool(pgConfig(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await createCandidateTables(client, manifest);
    const summaryBefore = await summarize(client);
    const backup = await collectBackup(client);

    const backupPayload = {
      generatedAt: new Date().toISOString(),
      mode: dryRun ? "dry-run" : "execute",
      databaseUrl: isLocalDatabase(databaseUrl) ? "local" : "non-local",
      summary: summaryBefore,
      backup,
      manifest,
    };

    let backupPath = null;
    if (execute) {
      const destination = dependencies.backupDir || backupDir;
      fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
      backupPath = path.join(destination, `member-cleanup-${timestamp()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), { flag: "wx", mode: 0o600 });
      await deleteCandidates(client);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }

    const result = {
      mode: dryRun ? "dry-run" : "execute",
      backupPath,
      ...summaryBefore,
    };
    if (!dependencies.pool) console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === '40001' || error.code === '40P01' || error.code === '55P03') {
      throw Object.assign(new Error("Cleanup aborted due to concurrent changes or locked rows; no deletion committed. Run a fresh dry-run and review the targets before retrying."), { code: error.code });
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { validateManifest, loadOptions, createCandidateTables, main };

if (require.main === module) main().catch((error) => {
  console.error("[member-data-hygiene] failed:", error.message);
  process.exit(1);
});
