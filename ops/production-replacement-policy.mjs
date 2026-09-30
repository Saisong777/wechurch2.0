import assert from 'node:assert/strict';

export const productionTarget = Object.freeze({
  project: '9371f53f-3043-4a19-b25f-a55d891fb46a',
  environment: 'f4b11351-cf4c-4a95-a3c0-45b195e9a0e0',
  oldApp: 'a4f9d0c6-991c-41b0-8859-3b498b077b03',
  oldDatabase: '9c98580e-5740-4860-80ac-de741b0d2561',
  origin: 'https://www.wechurch.online',
});

export function assertReplacementTarget(state, service, kind) {
  assert.equal(state.project, productionTarget.project);
  assert.equal(state.environment, productionTarget.environment);
  assert(['app', 'database'].includes(kind));
  assert.equal(service, state[kind]);
  if (state.app && state.database) assert.notEqual(state.app, state.database);
  assert(/^[a-f0-9-]{36}$/.test(service || ''));
  assert(![productionTarget.oldApp, productionTarget.oldDatabase,
    'fef7af7c-e3c3-4977-8294-c3a123a4242e',
    '0d52eb1a-b8e6-4f0f-b8ba-c652ddacebc8'].includes(service));
}

export function assertCutoverReady(evidence) {
  for (const field of ['sourceReleaseVerified', 'freshBackupRestored', 'oldABackupRestored',
    'databaseOwnershipVerified', 'filesVerified', 'googleLoginVerified', 'memberPrivacyVerified',
    'latestLegacySourceReconciled', 'finalWriteFreezeVerified', 'schedulerIsolationVerified',
    'newProductionSmokePassed']) assert.equal(evidence[field], true, field);
}

export function productionSettings(staging, oldProduction, databaseURL) {
  const database = new URL(databaseURL);
  assert(['postgres:', 'postgresql:'].includes(database.protocol));
  assert.equal(database.username, 'wechurch_app');
  assert(oldProduction.GOOGLE_CLIENT_ID && oldProduction.GOOGLE_CLIENT_SECRET);
  const copied = ['AUTH_REGISTRATION_MODE', 'BIBLE_STUDY_DIR', 'JSON_BODY_LIMIT', 'DB_POOL_MAX',
    'DB_CONNECTION_TIMEOUT_MS', 'DB_IDLE_TIMEOUT_MS', 'RESEND_FROM_EMAIL', 'RESEND_REPLY_TO'];
  const settings = Object.fromEntries(copied.filter(key => staging[key]).map(key => [key, staging[key]]));
  return {...settings, APP_ENV: 'production', NODE_ENV: 'production', PUBLIC_BASE_URL: productionTarget.origin,
    GOOGLE_CLIENT_ID: oldProduction.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: oldProduction.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: `${productionTarget.origin}/api/callback`, DATABASE_URL: database.href,
    UPLOAD_ROOT: '/data', PORT: '8080', LOCAL_INSECURE_COOKIES: '0',
    AUTH_REGISTRATION_MODE: 'google-only', DISABLE_MORNING_BRIEF: '1',
    DISABLE_OUTBOUND_EMAIL: '1', DAILY_EMAIL_SCHEDULER_ENABLED: '0'};
}
