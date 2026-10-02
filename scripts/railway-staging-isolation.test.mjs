import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStagingIsolation, production, target } from './railway-staging.mjs';

function fixture() {
  return {
    status: { id: target.project, environments: { edges: [
      { node: { id: target.environment, name: 'staging' } },
      { node: { id: production.environment, serviceInstances: { edges: [{ node: {
        serviceId: production.app, domains: { customDomains: [{ domain: 'www.wechurch.online' }] },
        latestDeployment: { id: 'current-a', deploymentStopped: false },
      } }] } } },
    ] } },
    app: { RAILWAY_ENVIRONMENT_ID: target.environment, RAILWAY_SERVICE_ID: target.app,
      DATABASE_URL: 'postgresql://wechurch_app:fixture@b-db.internal:5432/railway', SESSION_SECRET: 'b-fixture', PUBLIC_BASE_URL: target.origin,
      STAGING_GOOGLE_LOGIN_ENABLED: '1', GOOGLE_CLIENT_ID: 'b-client', STAGING_GOOGLE_CLIENT_ID: 'b-client', GOOGLE_CLIENT_SECRET: 'b-google', GOOGLE_CALLBACK_URL: target.origin + '/api/callback' },
    database: { RAILWAY_ENVIRONMENT_ID: target.environment, RAILWAY_SERVICE_ID: target.database, DATABASE_URL: 'postgresql://postgres:fixture@b-db.internal:5432/railway' },
    live: { RAILWAY_ENVIRONMENT_ID: production.environment, RAILWAY_SERVICE_ID: production.app,
      PUBLIC_BASE_URL: production.origin, DATABASE_URL: 'postgresql://postgres:fixture@a-db.internal:5432/railway', SESSION_SECRET: 'a-fixture', GOOGLE_CLIENT_ID: 'a-client', GOOGLE_CLIENT_SECRET: 'a-google' },
  };
}

test('checks B isolation against the running A with the formal domain', () => {
  assert.equal(assertStagingIsolation(fixture()).productionDeployment, 'current-a');
});
test('rejects a retired A service, wrong formal origin, or missing production domain', () => {
  for (const modify of [f => { f.live.RAILWAY_SERVICE_ID = 'a4f9d0c6-991c-41b0-8859-3b498b077b03'; },
    f => { f.live.PUBLIC_BASE_URL = target.origin; },
    f => { f.status.environments.edges[1].node.serviceInstances.edges[0].node.domains.customDomains = []; },
    f => { f.status.environments.edges[1].node.serviceInstances.edges[0].node.latestDeployment.deploymentStopped = true; }]) {
    const f = fixture(); modify(f); assert.throws(() => assertStagingIsolation(f), /production identity mismatch/);
  }
});
test('rejects a wrong project, B service, or database connection', () => {
  for (const modify of [f => { f.status.id = 'other-project'; }, f => { f.app.RAILWAY_SERVICE_ID = production.app; },
    f => { f.app.DATABASE_URL = 'postgresql://postgres:fixture@other-db.internal:5432/railway'; }]) {
    const f = fixture(); modify(f); assert.throws(() => assertStagingIsolation(f));
  }
});
test('rejects B using A database or session', () => {
  for (const modify of [f => { f.live.DATABASE_URL = f.database.DATABASE_URL; }, f => { f.live.SESSION_SECRET = f.app.SESSION_SECRET; }]) {
    const f = fixture(); modify(f); assert.throws(() => assertStagingIsolation(f), /isolation failed/);
  }
});
test('rejects shared Google credentials and a wrong B callback', () => {
  for (const modify of [f => { f.live.GOOGLE_CLIENT_ID = f.app.GOOGLE_CLIENT_ID; },
    f => { f.live.GOOGLE_CLIENT_SECRET = f.app.GOOGLE_CLIENT_SECRET; }, f => { f.app.GOOGLE_CALLBACK_URL = production.origin + '/api/callback'; }]) {
    const f = fixture(); modify(f); assert.throws(() => assertStagingIsolation(f), /Google requires its own/);
  }
});
