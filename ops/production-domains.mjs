import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root} from '../scripts/railway-staging.mjs';
import {assertReplacementTarget, productionTarget} from './production-replacement-policy.mjs';

process.umask(0o077);
const action = process.argv[2];
if (!['inspect', 'preview'].includes(action) || process.env.WECHURCH_ALLOW_PRODUCTION_REPLACEMENT !== '2026-09-30') throw new Error('Authorized replacement domain operation required');
const directory = fs.realpathSync(process.env.WECHURCH_PRODUCTION_PRIVATE_DIR || '');
if (!path.relative(root, directory).startsWith('../') || (fs.statSync(directory).mode & 0o077)) throw new Error('Private journal required');
const file = path.join(directory, 'replacement.json');
const state = JSON.parse(fs.readFileSync(file));
assertReplacementTarget(state, state.app, 'app');
const token = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.railway/config.json'))).user?.token;
const save = update => {
  const latest = JSON.parse(fs.readFileSync(file));
  assertReplacementTarget(latest, state.app, 'app');
  fs.writeFileSync(file, JSON.stringify({...latest, ...update}, null, 2), {mode: 0o600});
};
async function request(query, variables) {
  const response = await fetch('https://backboard.railway.com/graphql/v2', {method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(30000)});
  const result = await response.json();
  if (!response.ok || result.errors) throw new Error('Domain management unavailable');
  return result.data;
}
const inspect = async () => (await request('query($e:String!,$s:String!){serviceInstance(environmentId:$e,serviceId:$s){domains{serviceDomains{id domain} customDomains{id domain}}}}',
  {e: state.environment, s: state.app})).serviceInstance.domains;
try {
  let domains = await inspect();
  save({origin: productionTarget.origin, domainsInspectedAt: new Date().toISOString(), domains});
  if (action === 'preview') {
    if (!state.smokeVerified || !state.filesVerified || !state.legacyVerified) throw new Error('Internal verification required');
    if (domains.customDomains.length) throw new Error('Inspect unexpected custom domains');
    if (!domains.serviceDomains.length) {
      if (state.previewCreateAttempted) throw new Error('Inspect ambiguous previous creation before retrying');
      save({previewEmptyConfirmedAt: new Date().toISOString(), previewCreateAttempted: new Date().toISOString()});
      await request('mutation($input:ServiceDomainCreateInput!){serviceDomainCreate(input:$input){id domain}}',
        {input: {environmentId: state.environment, serviceId: state.app, targetPort: 8080}});
      domains = await inspect();
    }
    if (domains.serviceDomains.length !== 1 || !/^[a-z0-9-]+\.up\.railway\.app$/.test(domains.serviceDomains[0].domain)) throw new Error('Unexpected preview domain');
    save({preview: `https://${domains.serviceDomains[0].domain}`, previewVerifiedAt: new Date().toISOString(), domains});
  }
  console.log(JSON.stringify({domains, formalDomainsChanged: false}));
} catch {
  console.error('Domain operation stopped. Inspect the existing domains before any further creation; formal DNS is unchanged.');
  process.exitCode = 1;
}
