import { createHash } from 'node:crypto';

export const SOURCE_PROJECT = 'imbibleapp-5c371';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function createSourceRequest(token, fetchImpl = fetch) {
  if (typeof token !== 'string' || !token || token.length > 16384 || /\s/.test(token)) throw new Error('Invalid token input');
  const authPath = `/v1/projects/${SOURCE_PROJECT}/accounts:batchGet`;
  const dataPath = `/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents:runQuery`;
  return async (url, options = {}) => {
    const target = new URL(url);
    const auth = target.origin === 'https://identitytoolkit.googleapis.com' && target.pathname === authPath;
    const firestore = target.origin === 'https://firestore.googleapis.com' && target.pathname === dataPath;
    if (target.username || target.password || target.hash ||
        !(auth && (options.method === undefined || options.method === 'GET') || firestore && options.method === 'POST')) {
      throw new Error('Source endpoint is not permitted');
    }
    const response = await fetchImpl(url, { method: options.method, body: options.body,
      redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'x-goog-user-project': SOURCE_PROJECT } });
    if (!response.ok) {
      // Provider error bodies may contain identifiers; expose only an allowlisted reason code.
      let reason = '';
      try {
        const error = await response.json();
        const value = error?.error?.details?.find(detail => detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo')?.reason;
        if (typeof value === 'string' && /^[A-Z_]{1,80}$/.test(value)) reason = ` (${value})`;
      } catch { /* An HTML/proxy error still reports its HTTP status. */ }
      throw new Error(`Source ${auth ? 'Auth' : 'Firestore'} read failed: HTTP ${response.status}${reason}`);
    }
    try { return await response.json(); } catch { throw new Error('Source returned invalid JSON'); }
  };
}

// Deliberate allowlist: never retain password hashes, salts, MFA secrets or tokens.
export function selectAuthIdentity(user) {
  if (!user || typeof user.localId !== 'string' || !user.localId) throw new Error('Invalid Auth user');
  return {
    uid: user.localId,
    email: user.email ?? null,
    name: user.displayName ?? null,
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    providerData: (user.providerUserInfo || []).map(provider => ({
      providerId: provider.providerId,
      uid: provider.rawId ?? null,
      federatedId: provider.federatedId ?? null,
      email: provider.email ?? null,
    })),
  };
}

export async function captureSource({ request, planSource, sourceCommit, pageSize = 500 }) {
  if (typeof planSource !== 'string' || !planSource || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Exact source commit and plan source are required');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Invalid page size');
  const startedAt = new Date().toISOString();
  const members = [], documents = [], seenTokens = new Set(), seenUsers = new Set(), seenDocuments = new Set();
  let pageToken;
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${SOURCE_PROJECT}/accounts:batchGet`);
    url.searchParams.set('maxResults', String(pageSize));
    if (pageToken) url.searchParams.set('nextPageToken', pageToken);
    const response = await request(url.href);
    if (!response || (response.users !== undefined && !Array.isArray(response.users))) throw new Error('Invalid Auth response');
    for (const user of response.users || []) {
      const member = selectAuthIdentity(user);
      if (seenUsers.has(member.uid)) throw new Error('Duplicate Auth UID during export');
      seenUsers.add(member.uid);
      members.push(member);
    }
    pageToken = response.nextPageToken;
    if (pageToken && (typeof pageToken !== 'string' || seenTokens.has(pageToken))) throw new Error('Invalid Auth pagination');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);

  const parent = `projects/${SOURCE_PROJECT}/databases/(default)/documents`;
  let cursor, readTime;
  for (;;) {
    const structuredQuery = {
      from: [{ collectionId: 'data', allDescendants: true }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: pageSize,
      ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}),
    };
    const response = await request(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
      method: 'POST', body: JSON.stringify({ structuredQuery, ...(readTime ? { readTime } : {}) }),
    });
    if (!Array.isArray(response) || response.some(row => !row || row.error)) throw new Error('Invalid Firestore response');
    const page = response.filter(row => row.document).map(row => row.document);
    readTime ||= response.findLast(row => row.readTime)?.readTime;
    if (!readTime || Number.isNaN(Date.parse(readTime))) throw new Error('Missing Firestore read time');
    for (const document of page) {
      if (typeof document.name !== 'string' || !document.name.startsWith(`${parent}/`) || seenDocuments.has(document.name)) throw new Error('Invalid or duplicate document path');
      seenDocuments.add(document.name);
      documents.push(document); // Keep typed raw fields, paths, timestamps and orphan documents intact.
    }
    if (page.length < pageSize) break;
    cursor = page.at(-1).name;
  }
  return {
    format: 'wechurch-im-bible-source-v2', projectId: SOURCE_PROJECT,
    startedAt, exportedAt: new Date().toISOString(),
    scope: { auth: 'all-default-tenant-users', firestore: 'collection-group:data', firestoreReadTime: readTime,
      atomicAcrossServices: false, includesStorage: false, includesOtherCollections: false },
    planSource: { commit: sourceCommit, sha256: sha256(planSource), content: planSource },
    members, documents,
  };
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Structural readiness only, never approval to import. Output contains no member PII.
export function inspectSource(source) {
  const issues = [];
  const add = (code, index) => issues.push({ code, ...(index === undefined ? {} : { index }) });
  const counts = { members: 0, documents: 0, notes: 0, readDays: 0, orphanDocuments: 0, blankNotes: 0 };
  if (!object(source) || source.format !== 'wechurch-im-bible-source-v2') {
    if (Array.isArray(source?.members)) counts.members = source.members.length;
    add('REEXPORT_V2_REQUIRED');
    return { structurallyReady: false, importApproved: false, counts, issues };
  }
  if (source.projectId !== SOURCE_PROJECT) add('WRONG_SOURCE_PROJECT');
  if (!Array.isArray(source.members) || !Array.isArray(source.documents)) {
    add('INVALID_SOURCE_ARRAYS');
    return { structurallyReady: false, importApproved: false, counts, issues };
  }
  if (source.scope?.firestore !== 'collection-group:data' || source.scope?.auth !== 'all-default-tenant-users' ||
      !source.scope?.firestoreReadTime || Number.isNaN(Date.parse(source.scope.firestoreReadTime))) add('INVALID_CAPTURE_SCOPE');
  if (!/^[a-f0-9]{40}$/.test(source.planSource?.commit || '') ||
      typeof source.planSource?.content !== 'string' || !source.planSource.content ||
      sha256(source.planSource.content) !== source.planSource.sha256) add('PLAN_SOURCE_INTEGRITY');
  const uids = new Set(), emails = new Set(), subjects = new Set(), paths = new Set();
  source.members.forEach((member, index) => {
    counts.members++;
    if (!object(member) || typeof member.uid !== 'string' || !member.uid) { add('INVALID_MEMBER', index); return; }
    if (uids.has(member.uid)) add('DUPLICATE_UID', index);
    uids.add(member.uid);
    if (!validEmail(member.email)) add('MISSING_OR_INVALID_EMAIL', index);
    else {
      const email = member.email.trim().toLowerCase();
      if (emails.has(email)) add('DUPLICATE_EMAIL', index);
      emails.add(email);
    }
    if (member.emailVerified !== true) add('EMAIL_NOT_VERIFIED', index);
    if (member.disabled !== false) add('DISABLED_OR_UNKNOWN_STATUS', index);
    const google = Array.isArray(member.providerData) ? member.providerData.filter(p => p?.providerId === 'google.com') : [];
    if (google.length !== 1 || typeof google[0]?.uid !== 'string' || !/^\d{1,255}$/.test(google[0].uid)) add('GOOGLE_SUBJECT_REQUIRED', index);
    else {
      if (subjects.has(google[0].uid)) add('DUPLICATE_GOOGLE_SUBJECT', index);
      subjects.add(google[0].uid);
    }
  });
  const prefix = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
  source.documents.forEach((doc, index) => {
    counts.documents++;
    if (!object(doc) || typeof doc.name !== 'string' || !doc.name.startsWith(prefix)) { add('INVALID_DOCUMENT', index); return; }
    if (paths.has(doc.name)) add('DUPLICATE_DOCUMENT_PATH', index);
    paths.add(doc.name);
    const match = /^users\/([^/]+)\/data\/main$/.exec(doc.name.slice(prefix.length));
    if (!match) { add('UNEXPECTED_DOCUMENT_PATH', index); return; }
    if (!uids.has(match[1])) { counts.orphanDocuments++; add('ORPHAN_DOCUMENT', index); }
    if (!object(doc.fields)) { add('INVALID_DOCUMENT_FIELDS', index); return; }
    const notes = doc.fields.notes;
    if (notes !== undefined) {
      if (!object(notes?.mapValue) || (notes.mapValue.fields !== undefined && !object(notes.mapValue.fields))) add('INVALID_NOTES_TYPE', index);
      else for (const [key, note] of Object.entries(notes.mapValue.fields || {})) {
        if (!key || !object(note) || typeof note.stringValue !== 'string') add('INVALID_NOTE_VALUE', index);
        else if (!note.stringValue.trim()) counts.blankNotes++;
        else counts.notes++;
      }
    }
    const days = doc.fields.readDays;
    if (days !== undefined) {
      if (!object(days?.arrayValue) || (days.arrayValue.values !== undefined && !Array.isArray(days.arrayValue.values))) add('INVALID_READ_DAYS_TYPE', index);
      else {
        const keys = new Set();
        for (const day of days.arrayValue.values || []) {
          if (!object(day) || typeof day.stringValue !== 'string' || !day.stringValue) add('INVALID_READ_DAY', index);
          else {
            counts.readDays++;
            if (keys.has(day.stringValue)) add('DUPLICATE_READ_DAY', index);
            keys.add(day.stringValue);
          }
        }
      }
    }
  });
  return { structurallyReady: issues.length === 0, importApproved: false, counts, issues };
}
