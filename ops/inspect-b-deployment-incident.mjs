import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, target } from '../scripts/railway-staging.mjs';

const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'), 'utf8')).user?.token;
if (!token) throw new Error('Railway CLI login required');
const cutoff = '2026-09-25T03:19:00Z';
const capturedAt = new Date().toISOString();
const directory = path.join(root, 'artifacts/railway-staging', `incident-${Date.now()}`);
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const save = (name, value) => fs.writeFileSync(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600 });
const cli = args => execFileSync('railway', args, { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 64 * 1024 * 1024 });
async function query(query, variables) {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error(`Railway query failed: ${JSON.stringify(result.errors || response.status)}`);
  return result.data;
}
const deployments = JSON.parse(cli(['deployment', 'list', '-s', target.app, '-e', target.environment, '--json', '--limit', '30']))
  .filter(d => d.createdAt >= cutoff).reverse();
const report = { capturedAt, cutoff, target, directory, deployments: [] };
for (const d of deployments) {
  const detail = await query(`query Incident($id:String!) {
    deployment(id:$id) { id status deploymentStopped createdAt updatedAt statusUpdatedAt instances { id status } sockets { port processName updatedAt } }
    deploymentEvents(id:$id,first:100) { pageInfo { hasNextPage } edges { node { step createdAt completedAt payload { detail error reason attempt maxAttempts durationMs skipped } } } }
  }`, { id: d.id });
  if (detail.deploymentEvents.pageInfo.hasNextPage) throw new Error('Event pagination required; report is incomplete');
  const record = { ...detail.deployment, image: d.meta?.imageDigest, message: d.meta?.cliMessage,
    configuration: { ...d.meta?.serviceManifest, mounts: d.meta?.volumeMounts },
    events: detail.deploymentEvents.edges.map(e => e.node), logs: {} };
  // Raw logs stay in the ignored private evidence directory, never in release docs.
  for (const kind of ['build', 'deployment']) {
    try {
      const raw = cli(['logs', d.id, `--${kind}`, '--json', '--lines', '5000', '--since', d.createdAt, '--until', capturedAt]);
      save(`${d.id}-${kind}.jsonl`, raw);
      const lines = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      record.logs[kind] = { count: lines.length, atRequestedLimit: lines.length >= 5000, first: lines[0]?.timestamp, last: lines.at(-1)?.timestamp };
    } catch (error) {
      record.logs[kind] = { retrievalError: String(error.message).slice(0, 350) };
    }
  }
  report.deployments.push(record);
  save('report.json', report);
  console.log(JSON.stringify({ id: d.id, status: record.status, instances: record.instances,
    events: record.events.map(e => ({ step: e.step, completed: !!e.completedAt, error: e.payload?.error })), logs: record.logs }));
}
console.log(JSON.stringify({ saved: directory, deployments: report.deployments.length }));
