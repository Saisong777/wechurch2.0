#!/usr/bin/env node

const pg = require("pg");

const baseUrl = process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:5099";
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
const participantCount = Number.parseInt(process.env.LOAD_TEST_PARTICIPANTS || "200", 10);
const pollCount = Number.parseInt(process.env.LOAD_TEST_POLLS || "120", 10);

function percentile(values, p) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.floor(values.length * p))];
}

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const { rows } = await pool.query(
    `INSERT INTO sessions (verse_reference, church_unit, status, group_size, grouping_method, short_code, allow_latecomers, icebreaker_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, short_code`,
    ["約翰福音 15:1-8", "Automated Load Test", "waiting", 4, "random", `L${suffix}`, true, false],
  );
  const session = rows[0];

  const timings = [];
  const errors = [];
  const startedAt = Date.now();

  await Promise.all(Array.from({ length: participantCount }, async (_, index) => {
    const started = Date.now();
    const number = index + 1;
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${session.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `壓測成員${number}`,
          email: `load-${Date.now()}-${number}@example.com`,
          gender: number % 2 ? "male" : "female",
          location: "On-site",
        }),
      });
      timings.push(Date.now() - started);
      if (![200, 201].includes(response.status)) {
        errors.push({ number, status: response.status, body: (await response.text()).slice(0, 160) });
      }
    } catch (error) {
      timings.push(Date.now() - started);
      errors.push({ number, error: String(error) });
    }
  }));

  const createElapsedMs = Date.now() - startedAt;
  const pollStartedAt = Date.now();
  const pollErrors = [];

  await Promise.all(Array.from({ length: pollCount }, async (_, index) => {
    const response = await fetch(`${baseUrl}/api/sessions/${session.id}/poll`);
    if (response.status !== 200) {
      pollErrors.push({ index, status: response.status, body: (await response.text()).slice(0, 160) });
    }
  }));

  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS count FROM participants WHERE session_id=$1", [session.id]);
  await pool.end();

  timings.sort((a, b) => a - b);
  const report = {
    baseUrl,
    sessionId: session.id,
    shortCode: session.short_code,
    participantsRequested: participantCount,
    participantsInserted: countRows[0].count,
    createElapsedMs,
    createErrors: errors.length,
    createP50Ms: percentile(timings, 0.5),
    createP95Ms: percentile(timings, 0.95),
    createMaxMs: timings.at(-1) || 0,
    pollRequests: pollCount,
    pollElapsedMs: Date.now() - pollStartedAt,
    pollErrors: pollErrors.length,
    firstErrors: errors.slice(0, 5),
    firstPollErrors: pollErrors.slice(0, 5),
  };

  console.log(JSON.stringify(report, null, 2));
  if (errors.length || pollErrors.length || countRows[0].count !== participantCount) process.exit(1);
}

main().catch((error) => {
  console.error("[soulgym-load-test] failed:", error);
  process.exit(1);
});
