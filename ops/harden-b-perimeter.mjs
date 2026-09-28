import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectStaging, railway, stagingSql, target } from '../scripts/railway-staging.mjs';

export const blockedPaths = ['/.env', '/.env.*', '/.git', '/.git/*', '/node_modules/*', '/server/*', '/shared/*', '/migrations/*', '/ops/*', '/scripts/*', '/bible-study-data/*'];
export const edgeRules = { version: 1, rules: [{
  description: 'WeChurch: block private source and configuration probes', priority: 10, enabled: true,
  if: { or: blockedPaths.map(value => ({ attr: 'http.path', op: 'matches', value })) },
  then: { action: 'block', params: { status: 404, body: 'Not found' } },
}] };

async function query(query, variables) {
  const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'), 'utf8')).user?.token;
  assert(token, 'Railway login required');
  const response = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error('Railway perimeter operation failed; inspect provider status without logging credentials');
  return result.data;
}

export function assertRecovery(directory, now = Date.now()) {
  assert(path.isAbsolute(directory), 'Pass the verified recovery directory');
  const bytes = fs.readFileSync(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(bytes);
  const proof = JSON.parse(fs.readFileSync(path.join(directory, 'restore-verification.json'), 'utf8'));
  const age = now - Date.parse(manifest.createdAt);
  assert(manifest.environment === target.environment && manifest.complete === true && Number.isFinite(age) && age >= 0 && age < 3600000, 'Fresh B recovery set required');
  assert.equal(proof.manifestSha256, createHash('sha256').update(bytes).digest('hex'));
  for (const field of ['allTableContentDigestsMatch', 'uploadHashesMatch', 'referenceAssetsMatch', 'settingsIdentityMatch', 'temporaryPlaintextRemoved']) assert.equal(proof[field], true);
  assert.deepEqual(manifest.files.map(f => f.name).sort(), ['database.dump.enc', 'uploads.tgz.enc', 'settings.json.enc', 'proof.json.enc', 'reference.tgz.enc'].sort());
  for (const file of manifest.files) {
    const data = fs.readFileSync(path.join(directory, file.name));
    assert.equal(data.length, file.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
  }
}

export async function main(command = 'inspect', directory) {
  assert(['inspect', 'close-database', 'apply-edge-rules'].includes(command), 'Only explicit B perimeter operations are supported');
  const before = inspectStaging();
  const ids = { e: target.environment, db: target.database, app: target.app };
  const state = await query(`query($e:String!,$db:String!,$app:String!){
    tcpProxies(environmentId:$e,serviceId:$db){id environmentId serviceId applicationPort}
    serviceInstance(environmentId:$e,serviceId:$app){edgeConfig{edgeRules underAttackModeUntil}}
    environment(id:$e){projectId serviceInstances{edges{node{serviceId}}}}
  }`, ids);
  assert.equal(state.environment.projectId, target.project);
  for (const { node } of state.environment.serviceInstances.edges) {
    if (node.serviceId === target.database) continue;
    const vars = JSON.parse(railway(['variable', 'list', '-e', target.environment, '-s', node.serviceId, '--json']));
    if (vars.DATABASE_URL) assert(new URL(vars.DATABASE_URL).hostname.endsWith('.railway.internal'), 'A B service still depends on public database access');
  }
  assert.equal(stagingSql('SELECT 1'), '1', 'Encrypted maintenance must work before removing the public proxy');
  if (command === 'close-database') {
    assertRecovery(directory);
    for (const proxy of state.tcpProxies) {
      assert.equal(proxy.environmentId, target.environment);
      assert.equal(proxy.serviceId, target.database);
      assert.equal(proxy.applicationPort, 5432);
      const result = await query('mutation($id:String!){tcpProxyDelete(id:$id)}', { id: proxy.id });
      assert.equal(result.tcpProxyDelete, true);
    }
    const after = await query('query($e:String!,$db:String!){tcpProxies(environmentId:$e,serviceId:$db){id}}', ids);
    assert.equal(after.tcpProxies.length, 0, 'Database proxy removal did not persist');
    assert.equal(stagingSql('SELECT 1'), '1');
  }
  if (command === 'apply-edge-rules') {
    // Never replace someone else's rules or silently weaken an existing ruleset.
    assert(!state.serviceInstance.edgeConfig?.edgeRules, 'Existing edge rules require manual merge/review');
    const input = { environmentId: target.environment, serviceId: target.app, edgeRules };
    const validation = await query('query($input:ValidateServiceEdgeRulesInput!){validateServiceEdgeRules(input:$input){code message path}}', { input });
    assert.deepEqual(validation.validateServiceEdgeRules, [], 'Provider rejected the rules; no settings changed');
    const result = await query('mutation($input:UpdateServiceEdgeRulesInput!){updateServiceEdgeRules(input:$input){edgeRules}}', { input });
    assert.deepEqual(result.updateServiceEdgeRules.edgeRules.rules.map(({ id: _id, ...rule }) => rule), edgeRules.rules);
    const persisted = await query('query($e:String!,$app:String!){serviceInstance(environmentId:$e,serviceId:$app){edgeConfig{edgeRules}}}', ids);
    assert.deepEqual(persisted.serviceInstance.edgeConfig.edgeRules, result.updateServiceEdgeRules.edgeRules);
  }
  assert.equal(inspectStaging().productionDeployment, before.productionDeployment, 'A deployment changed; investigate independently');
  console.log(JSON.stringify({ command, completed: true, databasePublicProxiesBefore: state.tcpProxies.length, encryptedMaintenance: true, productionDeployment: before.productionDeployment }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2], process.argv[3]).catch(() => { console.error('B perimeter operation stopped. Inspect sanitized state before retrying; no credentials are logged.'); process.exitCode = 1; });
}
