import { SOURCE_PROJECT } from './im-bible-migration.mjs';
import { isCalendarDate } from './im-bible-import-plan.mjs';

// Compare private payloads in memory; return counts and codes, never note text or identities.
export function reconcileLegacy(legacy, bundle, year) {
  const issues = [];
  const counts = { membersCompared: 0, notesCompared: 0, readDaysCompared: 0,
    addedMembers: 0, addedNotes: 0, addedReadDays: 0 };
  const add = code => issues.push({ code });
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(legacy) || legacy.source !== `Firebase project ${SOURCE_PROJECT}` || !Array.isArray(legacy.members) ||
      bundle?.format !== 'wechurch-im-bible-import-v1' || bundle.projectId !== SOURCE_PROJECT ||
      !['members', 'notes', 'readDays'].every(key => Array.isArray(bundle[key])) ||
      !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { matched: false, counts, issues: [{ code: 'INVALID_RECONCILIATION_INPUT' }] };
  }
  const members = new Map(bundle.members.map(member => [member.sourceUid, member]));
  const key = (uid, day) => JSON.stringify([uid, day]);
  const notes = new Map(bundle.notes.map(note => [key(note.sourceUid, note.dayKey), note]));
  const days = new Map(bundle.readDays.map(day => [key(day.sourceUid, day.dayKey), day]));
  const seenMembers = new Set(), seenNotes = new Set(), seenDays = new Set();
  for (const member of legacy.members) {
    if (!object(member) || typeof member.uid !== 'string' || !member.uid || seenMembers.has(member.uid) ||
        typeof member.email !== 'string' || !Array.isArray(member.notes) || !Array.isArray(member.readDays)) {
      add('INVALID_LEGACY_MEMBER'); continue;
    }
    seenMembers.add(member.uid);
    const current = members.get(member.uid);
    if (!current) add('LEGACY_MEMBER_MISSING');
    else {
      counts.membersCompared++;
      if (current.email.trim().toLowerCase() !== member.email.trim().toLowerCase()) add('LEGACY_EMAIL_CHANGED');
    }
    for (const [kind, rows, target, seen] of [
      ['note', member.notes, notes, seenNotes], ['read-day', member.readDays, days, seenDays],
    ]) {
      for (const row of rows) {
        if (!object(row) || typeof row.key !== 'string' || typeof row.date !== 'string' || typeof row.passage !== 'string') {
          add('INVALID_LEGACY_RECORD'); continue;
        }
        const recordKey = key(member.uid, row.key);
        if (seen.has(recordKey)) { add('DUPLICATE_LEGACY_RECORD'); continue; }
        seen.add(recordKey);
        const record = target.get(recordKey);
        if (!record) { add('LEGACY_RECORD_MISSING'); continue; }
        const date = /^(\d{1,2})(?:\/(\d{1,2})|月(\d{1,2})日)$/.exec(row.date.trim());
        const normalized = date && `${year}-${date[1].padStart(2, '0')}-${(date[2] || date[3]).padStart(2, '0')}`;
        if (!isCalendarDate(normalized) || normalized !== record.devotionalDate || row.passage !== record.reference) {
          add('LEGACY_DATE_OR_REFERENCE_CHANGED');
        }
        if (kind === 'note') {
          counts.notesCompared++;
          if (typeof row.text !== 'string' || row.text !== record.body) add('LEGACY_NOTE_CONTENT_CHANGED');
        } else counts.readDaysCompared++;
      }
    }
  }
  counts.addedMembers = bundle.members.filter(member => !seenMembers.has(member.sourceUid)).length;
  counts.addedNotes = bundle.notes.filter(note => !seenNotes.has(key(note.sourceUid, note.dayKey))).length;
  counts.addedReadDays = bundle.readDays.filter(day => !seenDays.has(key(day.sourceUid, day.dayKey))).length;
  return { matched: issues.length === 0, counts, issues };
}
