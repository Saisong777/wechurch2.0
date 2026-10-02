import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
export async function verifyRetiredAiHttp(pool: Pool, admin: Client, member: Client, guest: Client, adminId: string) {
  const id = randomUUID();
  const routes = [
    '/api/admin/product-growth-brief', '/api/admin/sessions/' + id + '/reports',
    '/api/sessions/' + id + '/reports', '/api/sessions/' + id + '/reports/stream',
    '/api/sessions/' + id + '/reports/generate', '/api/reports/' + id,
    '/api/prayer-meetings/' + id + '/classify-prayers',
    '/api/devotional-notes/analyze', '/api/devotional-notes/analyze-batch', '/api/devotional-notes/analyze-group',
  ];
  const before = (await pool.query('SELECT (SELECT count(*) FROM ai_reports) AS reports, (SELECT count(*) FROM ai_usage_events) AS usage')).rows[0];
  for (const client of [admin, member, guest]) for (const route of routes) for (const method of ['GET', 'POST']) {
    const response = await client(route, method, method === 'POST' ? { noteId: id, content: 'Do not send to model' } : undefined);
    assert.equal(response.status, 410, route);
    assert.match(response.headers.get('content-type') || '', /json/);
  }
  assert.deepEqual((await pool.query('SELECT (SELECT count(*) FROM ai_reports) AS reports, (SELECT count(*) FROM ai_usage_events) AS usage')).rows[0], before);
  assert.equal((await guest('/api/admin/platform-summary')).status, 401);
  assert.equal((await member('/api/admin/platform-summary')).status, 403);
  const roles = (await pool.query('SELECT role FROM user_roles WHERE user_id=$1', [adminId])).rows;
  await pool.query("UPDATE user_roles SET role='admin' WHERE user_id=$1", [adminId]);
  const tag = 'telemetry-' + randomUUID();
  try {
    await pool.query("INSERT INTO app_events(event_name,source) SELECT $1 || n, 'fixture' FROM generate_series(1,25) n", [tag]);
    const response = await admin('/api/admin/platform-summary');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    const expected = (await pool.query('SELECT count(*)::int AS count FROM app_events WHERE created_at >= $1 AND created_at < $2', [new Date(data.since), new Date(data.until)])).rows[0].count;
    assert.equal(data.totalEvents, expected);
    assert(data.totalEvents > data.events.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 'Total cannot be the limited top-20 sum');
    assert.equal(data.events.length, 20);
    assert(!('aiUsage' in data));
    assert(!('healthScore' in data));
    assert.equal(new Date(data.until).getTime() - new Date(data.since).getTime(), 7 * 86400000);
  } finally {
    await pool.query('DELETE FROM app_events WHERE event_name LIKE $1', [tag + '%']);
    await pool.query('UPDATE user_roles SET role=$2 WHERE user_id=$1', [adminId, roles[0].role]);
  }
  console.log('PASS retired AI endpoints, unchanged historical reports, admin-only bounded telemetry totals');
}
