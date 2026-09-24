import { inspectSource, sha256, SOURCE_PROJECT } from './im-bible-migration.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => sha256(JSON.stringify(value));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const emailKey = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Calendar is a separately reviewed mapping, not an inferred year or live reordered plan.
export function prepareImportBundle(source, calendar) {
  const sourceReport = inspectSource(source);
  const issues = [...sourceReport.issues];
  const add = (code, index) => issues.push({ code, ...(index === undefined ? {} : { index }) });
  if (!sourceReport.structurallyReady) return { ready: false, importApproved: false, issues, bundle: null };
  if (!object(calendar) || calendar.format !== 'wechurch-im-bible-calendar-v1' ||
      calendar.sourceCommit !== source.planSource.commit || calendar.sourceSha256 !== source.planSource.sha256 ||
      !Array.isArray(calendar.entries) || !text(calendar.reviewedBy) || !isCalendarDate(calendar.reviewedOn)) {
    add('REVIEWED_CALENDAR_REQUIRED');
    return { ready: false, importApproved: false, issues, bundle: null };
  }
  const entries = new Map();
  calendar.entries.forEach((entry, index) => {
    if (!object(entry) || !text(entry.key) || !isCalendarDate(entry.date) || !text(entry.reference) || !text(entry.planTitle)) {
      add('INVALID_CALENDAR_ENTRY', index); return;
    }
    if (entries.has(entry.key)) add('DUPLICATE_CALENDAR_KEY', index);
    entries.set(entry.key, entry);
  });
  const notes = [], readDays = [];
  source.documents.forEach((document, index) => {
    const uid = document.name.split('/documents/users/')[1].split('/')[0];
    const metadata = { projectId: SOURCE_PROJECT, sourceUid: uid, documentPath: document.name };
    const record = (dayKey, value, kind) => {
      const day = entries.get(dayKey);
      if (!day) { add('UNMAPPED_SOURCE_DAY', index); return; }
      const body = { ...metadata, dayKey, devotionalDate: day.date, reference: day.reference,
        planTitle: day.planTitle, planSourceSha256: source.planSource.sha256,
        ...(kind === 'note' ? { body: value, bodySha256: sha256(value), writtenAt: null } : {}) };
      return {
        ...body,
        sourceKey: digest([SOURCE_PROJECT, uid, document.name, dayKey, kind]),
        recordSha256: digest(body),
        documentUpdatedAt: document.updateTime ?? null,
      };
    };
    for (const [dayKey, value] of Object.entries(document.fields.notes?.mapValue?.fields || {})) {
      const note = record(dayKey, value.stringValue, 'note');
      if (note) notes.push(note); // Empty notes also survive; the importer must account for them explicitly.
    }
    for (const value of document.fields.readDays?.arrayValue?.values || []) {
      const day = record(value.stringValue, undefined, 'read-day');
      if (day) readDays.push(day);
    }
  });
  if (issues.length) return { ready: false, importApproved: false, issues, bundle: null };
  const members = source.members.map(member => ({
    sourceUid: member.uid, googleSubject: member.providerData.find(p => p.providerId === 'google.com').uid,
    email: member.email, name: member.name ?? null,
  })).sort((a, b) => a.sourceUid.localeCompare(b.sourceUid));
  notes.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  readDays.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  const content = { format: 'wechurch-im-bible-import-v1', projectId: SOURCE_PROJECT,
    sourceCommit: source.planSource.commit, sourceSha256: source.planSource.sha256,
    calendarSha256: digest(calendar), members, notes, readDays };
  return { ready: true, importApproved: false, issues: [], bundle: { ...content, bundleSha256: digest(content) } };
}

// Pure dry-run: no DB connection, filesystem writes, account creation or publishing.
export function planImport(bundle, target) {
  const issues = [];
  const add = (code, index) => issues.push({ code, ...(index === undefined ? {} : { index }) });
  const blocked = () => ({ ready: false, importApproved: false, issues, actions: [] });
  if (!object(bundle)) { add('INVALID_IMPORT_BUNDLE'); return blocked(); }
  const { bundleSha256, ...content } = bundle;
  if (bundle.format !== 'wechurch-im-bible-import-v1' || bundle.projectId !== SOURCE_PROJECT ||
      digest(content) !== bundleSha256 || !Array.isArray(bundle.members) || !Array.isArray(bundle.notes) || !Array.isArray(bundle.readDays)) {
    add('INVALID_IMPORT_BUNDLE'); return blocked();
  }
  const sourceUids = new Set(), sourceSubjects = new Set(), sourceEmails = new Set(), sourceKeys = new Set();
  for (const member of bundle.members) {
    if (!text(member?.sourceUid) || typeof member.googleSubject !== 'string' || !/^\d{1,255}$/.test(member.googleSubject) ||
        !text(member.email) || sourceUids.has(member.sourceUid) || sourceSubjects.has(member.googleSubject) || sourceEmails.has(emailKey(member.email))) {
      add('INVALID_BUNDLE_MEMBER'); continue;
    }
    sourceUids.add(member.sourceUid); sourceSubjects.add(member.googleSubject); sourceEmails.add(emailKey(member.email));
  }
  for (const [kind, items] of [['note', bundle.notes], ['read-day', bundle.readDays]]) {
    for (const item of items) {
      if (!object(item) || !sourceUids.has(item.sourceUid) || !text(item.dayKey) || !isCalendarDate(item.devotionalDate) ||
          !text(item.reference) || !text(item.planTitle) || item.planSourceSha256 !== bundle.sourceSha256 ||
          item.projectId !== SOURCE_PROJECT || item.documentPath !== `projects/${SOURCE_PROJECT}/databases/(default)/documents/users/${item.sourceUid}/data/main` ||
          item.sourceKey !== digest([SOURCE_PROJECT, item.sourceUid, item.documentPath, item.dayKey, kind]) || sourceKeys.has(item.sourceKey) ||
          (kind === 'note' && (typeof item.body !== 'string' || item.writtenAt !== null || sha256(item.body) !== item.bodySha256))) {
        add('INVALID_BUNDLE_RECORD'); continue;
      }
      const { sourceKey, recordSha256, documentUpdatedAt, ...body } = item;
      if (digest(body) !== recordSha256) add('INVALID_BUNDLE_RECORD');
      sourceKeys.add(sourceKey);
    }
  }
  if (issues.length) return blocked();
  if (!object(target) || target.format !== 'wechurch-im-bible-target-v1' ||
      !['users', 'authUsers', 'googleLinks', 'sourceAccounts', 'records'].every(key => Array.isArray(target[key]))) {
    add('INVALID_TARGET_SNAPSHOT'); return blocked();
  }
  const users = new Map(), authUsers = new Map(), authEmails = new Set(), links = new Map(), sources = new Map(), records = new Map();
  const emails = new Map();
  for (const [index, user] of target.users.entries()) {
    if (!uuid(user?.id) || !text(user.email) || users.has(user.id)) { add('INVALID_TARGET_USER', index); continue; }
    users.set(user.id, user);
    const email = emailKey(user.email);
    const owners = emails.get(email) || []; owners.push(user.id); emails.set(email, owners);
    if (owners.length > 1) add('AMBIGUOUS_TARGET_EMAIL', index);
  }
  for (const [index, auth] of target.authUsers.entries()) {
    if (!text(auth?.id) || authUsers.has(auth.id) || (auth.email !== null && !text(auth.email))) { add('INVALID_TARGET_AUTH_USER', index); continue; }
    authUsers.set(auth.id, auth);
    if (auth.email) authEmails.add(emailKey(auth.email));
  }
  const linkedUsers = new Set(), linkedAuth = new Set();
  for (const [index, link] of target.googleLinks.entries()) {
    if (!text(link?.googleSubject) || !users.has(link.userId) || !authUsers.has(link.authUserId) ||
        links.has(link.googleSubject) || linkedUsers.has(link.userId) || linkedAuth.has(link.authUserId)) { add('INVALID_TARGET_GOOGLE_LINK', index); continue; }
    links.set(link.googleSubject, link.userId);
    linkedUsers.add(link.userId); linkedAuth.add(link.authUserId);
  }
  for (const [index, account] of target.sourceAccounts.entries()) {
    if (account?.projectId !== SOURCE_PROJECT || !text(account.sourceUid) || !users.has(account.userId) || sources.has(account.sourceUid)) {
      add('INVALID_TARGET_SOURCE_ACCOUNT', index); continue;
    }
    sources.set(account.sourceUid, account.userId);
  }
  for (const [index, entry] of target.records.entries()) {
    if (!text(entry?.sourceKey) || !text(entry.recordSha256) || !users.has(entry.userId) ||
        records.has(entry.sourceKey) || !['note', 'read-day'].includes(entry.kind) || typeof entry.targetExists !== 'boolean') {
      add('INVALID_TARGET_RECORD', index); continue;
    }
    records.set(entry.sourceKey, entry);
  }
  if (issues.length) return blocked();
  const actions = [], owners = new Map(), targetOwners = new Set();
  for (const [index, member] of bundle.members.entries()) {
    const googleUser = links.get(member.googleSubject), sourceUser = sources.get(member.sourceUid);
    if (sourceUser && sourceUser !== googleUser) { add('SOURCE_ACCOUNT_IDENTITY_CONFLICT', index); continue; }
    const userId = googleUser || sourceUser;
    if (userId) {
      if (targetOwners.has(userId)) { add('MULTIPLE_SOURCE_ACCOUNTS_FOR_MEMBER', index); continue; }
      targetOwners.add(userId);
      owners.set(member.sourceUid, userId);
      actions.push({ kind: 'account', action: sourceUser ? 'unchanged' : 'link-source', sourceUid: member.sourceUid, userId });
    } else if (emails.has(emailKey(member.email)) || authEmails.has(emailKey(member.email)) || authUsers.has(member.googleSubject)) {
      add('EMAIL_COLLISION_REQUIRES_REVIEW', index);
    } else {
      owners.set(member.sourceUid, null);
      actions.push({ kind: 'account', action: 'create-member', sourceUid: member.sourceUid, userId: null });
    }
  }
  for (const [kind, items] of [['note', bundle.notes], ['read-day', bundle.readDays]]) {
    for (const [index, item] of items.entries()) {
      if (!owners.has(item.sourceUid)) { add('RECORD_OWNER_UNRESOLVED', index); continue; }
      const userId = owners.get(item.sourceUid), existing = records.get(item.sourceKey);
      if (existing) {
        if (existing.userId !== userId || existing.kind !== kind) { add('RECORD_OWNERSHIP_CONFLICT', index); continue; }
        if (!existing.targetExists) { add('TARGET_RECORD_MISSING_REQUIRES_REVIEW', index); continue; }
        if (existing.recordSha256 !== item.recordSha256) { add('SOURCE_CHANGED_REQUIRES_REVIEW', index); continue; }
      }
      actions.push({ kind, action: existing ? 'unchanged' : 'insert', sourceKey: item.sourceKey, sourceUid: item.sourceUid, userId });
    }
  }
  if (issues.length) return blocked();
  // Extra target records are never deleted, even if absent from the new source snapshot.
  return { ready: true, importApproved: false, issues: [], actions };
}

export function summarizePlan(plan) {
  const counts = {};
  for (const item of plan.actions) {
    const key = `${item.kind}:${item.action}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return { ready: plan.ready, importApproved: false, counts, issues: plan.issues };
}
