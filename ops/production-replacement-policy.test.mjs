import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionTarget, productionSettings, assertReplacementTarget, assertCutoverReady} from './production-replacement-policy.mjs';

test('replacement writes refuse existing A and B services', () => {
  const state = {...productionTarget, app: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
  assertReplacementTarget(state, state.app, 'app');
  for (const app of [productionTarget.oldApp, 'fef7af7c-e3c3-4977-8294-c3a123a4242e']) {
    assert.throws(() => assertReplacementTarget({...state, app}, app, 'app'));
  }
  assert.throws(() => assertReplacementTarget({...state, environment: 'staging'}, state.app, 'app'));
  assert.throws(() => assertReplacementTarget({...state, database: state.app}, state.app, 'app'));
});

test('production configuration drops test access, session and outbound credentials', () => {
  const settings = productionSettings({STAGING_ACCESS_CODE: 'secret', SESSION_SECRET: 'test',
    STAGING_GOOGLE_CLIENT_ID: 'test', RESEND_API_KEY: 'test', DAILY_EMAIL_SCHEDULER_ENABLED: '1'},
  {GOOGLE_CLIENT_ID: 'production', GOOGLE_CLIENT_SECRET: 'production-secret'},
  'postgresql://wechurch_app:secret@new.railway.internal/railway');
  for (const key of ['STAGING_ACCESS_CODE', 'SESSION_SECRET', 'STAGING_GOOGLE_CLIENT_ID', 'RESEND_API_KEY']) {
    assert.equal(settings[key], undefined);
  }
  assert.equal(settings.GOOGLE_CLIENT_ID, 'production');
  assert.equal(settings.DAILY_EMAIL_SCHEDULER_ENABLED, '0');
  assert.equal(settings.DISABLE_OUTBOUND_EMAIL, '1');
  assert.throws(() => productionSettings({}, {}, 'postgresql://postgres:p@new/railway'));
});

test('domain cutover is blocked until every data and login gate passes', () => {
  assert.throws(() => assertCutoverReady({sourceReleaseVerified: true}));
  const ready = Object.fromEntries(['sourceReleaseVerified', 'freshBackupRestored', 'oldABackupRestored',
    'databaseOwnershipVerified', 'filesVerified', 'googleLoginVerified', 'memberPrivacyVerified',
    'latestLegacySourceReconciled', 'finalWriteFreezeVerified', 'schedulerIsolationVerified',
    'newProductionSmokePassed'].map(key => [key, true]));
  assertCutoverReady(ready);
  for (const key of Object.keys(ready)) assert.throws(() => assertCutoverReady({...ready, [key]: false}));
});
