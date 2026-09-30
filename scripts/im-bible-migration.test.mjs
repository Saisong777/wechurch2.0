import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { captureSource, inspectSource, selectAuthIdentity, SOURCE_PROJECT, sha256, createSourceRequest } from './im-bible-migration.mjs';
import { seal, unseal } from './backup-envelope.mjs';

const commit = 'a'.repeat(40);

test('source HTTP client names its quota project and disallows redirects', async () => {
  const calls = [];
  const request = createSourceRequest('synthetic-token', async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => ({ users: [] }) };
  });
  await request(`https://identitytoolkit.googleapis.com/v1/projects/${SOURCE_PROJECT}/accounts:batchGet?maxResults=1`);
  assert.equal(calls[0].options.headers['x-goog-user-project'], SOURCE_PROJECT);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-token');
});

test('source HTTP client never sends credentials to a different host, project or write endpoint', async () => {
  const request = createSourceRequest('synthetic-token', () => { throw new Error('FETCH_MUST_NOT_RUN'); });
  for (const [url, options] of [
    ['https://example.test', {}],
    ['https://identitytoolkit.googleapis.com/v1/projects/other/accounts:batchGet', {}],
    [`https://identitytoolkit.googleapis.com/v1/projects/${SOURCE_PROJECT}/accounts:batchGet`, { method: 'POST' }],
    [`https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents:commit`, { method: 'POST' }],
    [`https://secret@identitytoolkit.googleapis.com/v1/projects/${SOURCE_PROJECT}/accounts:batchGet`, {}],
  ]) await assert.rejects(request(url, options), /Source endpoint is not permitted/);
});

test('source HTTP errors expose reason codes, not provider error text or credentials', async () => {
  const request = createSourceRequest('synthetic-token', async () => ({ ok: false, status: 403,
    json: async () => ({ error: { message: 'PRIVATE member@example.test', details: [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' },
    ] } }) }));
  await assert.rejects(request(`https://identitytoolkit.googleapis.com/v1/projects/${SOURCE_PROJECT}/accounts:batchGet`),
    error => error.message === 'Source Auth read failed: HTTP 403 (SERVICE_DISABLED)');
});
const prefix = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
const rawUser = (uid = 'synthetic-uid', subject = '10001') => ({
  localId: uid, email: `${uid}@example.test`, emailVerified: true,
  providerUserInfo: [{ providerId: 'google.com', rawId: subject }],
});
const rawDoc = (uid = 'synthetic-uid') => ({ name: `${prefix}users/${uid}/data/main`,
  createTime: '2026-07-01T00:00:00Z', updateTime: '2026-09-24T00:00:00Z',
  fields: { notes: { mapValue: { fields: { 'july-0': { stringValue: '  原文\n第二行  ' }, 'july-1': { stringValue: '' } } } },
    readDays: { arrayValue: { values: [{ stringValue: 'july-0' }] } }, extra: { integerValue: '9007199254740993' } },
});
function snapshot() {
  return { format: 'wechurch-im-bible-source-v2', projectId: SOURCE_PROJECT,
    scope: { auth: 'all-default-tenant-users', firestore: 'collection-group:data', firestoreReadTime: '2026-09-24T00:00:00Z' },
    planSource: { commit, content: '<html>synthetic plan</html>', sha256: sha256('<html>synthetic plan</html>') },
    members: [selectAuthIdentity(rawUser())], documents: [rawDoc()] };
}
test('source readiness is not permission to import; report contains no private note or email', () => {
  const report = inspectSource(snapshot());
  assert.equal(report.structurallyReady, true);
  assert.equal(report.importApproved, false);
  assert.deepEqual(report.counts, { members: 1, documents: 1, notes: 1, readDays: 1, orphanDocuments: 0, blankNotes: 1 });
  assert.doesNotMatch(JSON.stringify(report), /example.test|原文|synthetic-uid/);
});
test('old handover is blocked instead of guessing Google subject from Firebase UID', () => {
  const report = inspectSource({ members: [{ uid: 'firebase-not-google', providers: ['google.com'] }] });
  assert.equal(report.structurallyReady, false);
  assert.equal(report.issues[0].code, 'REEXPORT_V2_REQUIRED');
});
test('Auth allowlist strips credential material, but preserves Google identity and disabled state', () => {
  const user = selectAuthIdentity({ ...rawUser(), disabled: true, passwordHash: 'SECRET', salt: 'SECRET', refreshToken: 'SECRET', mfaInfo: ['SECRET'] });
  assert.doesNotMatch(JSON.stringify(user), /SECRET/);
  assert.equal(user.providerData[0].uid, '10001');
  assert.equal(user.disabled, true);
});
for (const [name, mutate, code] of [
  ['missing Google subject', s => { s.members[0].providerData[0].uid = null; }, 'GOOGLE_SUBJECT_REQUIRED'],
  ['disabled account', s => { s.members[0].disabled = true; }, 'DISABLED_OR_UNKNOWN_STATUS'],
  ['unknown account status', s => { delete s.members[0].disabled; }, 'DISABLED_OR_UNKNOWN_STATUS'],
  ['unverified email', s => { s.members[0].emailVerified = false; }, 'EMAIL_NOT_VERIFIED'],
  ['orphan document', s => { s.documents.push(rawDoc('orphan')); }, 'ORPHAN_DOCUMENT'],
  ['duplicate UID', s => { s.members.push(structuredClone(s.members[0])); }, 'DUPLICATE_UID'],
  ['duplicate subject', s => { s.members.push({ ...s.members[0], uid: 'other', email: 'other@example.test' }); }, 'DUPLICATE_GOOGLE_SUBJECT'],
  ['case-insensitive duplicate email', s => { s.members.push({ ...s.members[0], uid: 'other', email: s.members[0].email.toUpperCase(), providerData: [{ providerId: 'google.com', uid: '10002' }] }); }, 'DUPLICATE_EMAIL'],
  ['unexpected path', s => { s.documents.push({ ...rawDoc(), name: `${prefix}teams/x/data/main` }); }, 'UNEXPECTED_DOCUMENT_PATH'],
  ['duplicate document', s => { s.documents.push(rawDoc()); }, 'DUPLICATE_DOCUMENT_PATH'],
  ['malformed note', s => { s.documents[0].fields.notes.mapValue.fields['july-0'] = { integerValue: '1' }; }, 'INVALID_NOTE_VALUE'],
  ['invalid readDays', s => { s.documents[0].fields.readDays = { stringValue: 'july-0' }; }, 'INVALID_READ_DAYS_TYPE'],
  ['duplicate readDays', s => { s.documents[0].fields.readDays.arrayValue.values.push({ stringValue: 'july-0' }); }, 'DUPLICATE_READ_DAY'],
  ['wrong project', s => { s.projectId = 'wrong-project'; }, 'WRONG_SOURCE_PROJECT'],
  ['altered plan', s => { s.planSource.content += 'changed'; }, 'PLAN_SOURCE_INTEGRITY'],
]) test(`blocks ${name} without deleting raw source`, () => {
  const s = snapshot(); mutate(s);
  const before = JSON.stringify(s), report = inspectSource(s);
  assert.equal(report.structurallyReady, false);
  assert.ok(report.issues.some(issue => issue.code === code));
  assert.equal(JSON.stringify(s), before);
});

test('capture paginates both APIs and keeps raw orphan data and one Firestore read time', async () => {
  const requests = [];
  const replies = [
    { users: [rawUser()], nextPageToken: 'next' },
    { users: [rawUser('other', '10002')] },
    [{ document: rawDoc(), readTime: '2026-09-24T00:00:00Z' }],
    [{ document: rawDoc('orphan'), readTime: '2026-09-24T00:00:00Z' }],
    [{ readTime: '2026-09-24T00:00:00Z' }],
  ];
  const captured = await captureSource({ pageSize: 1, planSource: '<html>plan</html>', sourceCommit: commit,
    request: async (url, options) => { requests.push({ url, options }); return replies.shift(); } });
  assert.equal(captured.members.length, 2);
  assert.equal(captured.documents.length, 2);
  assert.equal(captured.documents[0].fields.notes.mapValue.fields['july-0'].stringValue, '  原文\n第二行  ');
  assert.equal(captured.documents[0].fields.extra.integerValue, '9007199254740993');
  assert.match(requests[1].url, /nextPageToken=next/);
  const nextQuery = JSON.parse(requests[3].options.body);
  assert.equal(nextQuery.readTime, '2026-09-24T00:00:00Z');
  assert.equal(nextQuery.structuredQuery.startAt.before, false);
  assert.equal(inspectSource(captured).counts.orphanDocuments, 1);
});
test('capture fails on repeated auth pages rather than silently dropping records', async () => {
  await assert.rejects(captureSource({ planSource: 'plan', sourceCommit: commit,
    request: async () => ({ users: [], nextPageToken: 'repeated' }) }), /Invalid Auth pagination/);
});
test('capture fails on HTTP failure, partial Firestore error, and missing read time', async () => {
  for (const response of [[{ error: { code: 403 } }], [{ document: rawDoc() }]]) {
    let calls = 0;
    await assert.rejects(captureSource({ planSource: 'plan', sourceCommit: commit,
      request: async () => ++calls === 1 ? { users: [] } : response }));
  }
  await assert.rejects(captureSource({ planSource: 'plan', sourceCommit: commit,
    request: async () => { throw new Error('HTTP 403'); } }), /HTTP 403/);
});
test('encrypted roundtrip preserves every original byte and detects tampering', () => {
  const bytes = Buffer.from(JSON.stringify(snapshot())), key = randomBytes(32), encrypted = seal(bytes, key);
  assert.ok(unseal(encrypted, key).equals(bytes));
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => unseal(encrypted, key));
});
