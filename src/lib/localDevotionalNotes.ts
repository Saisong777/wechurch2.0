export interface LocalDevotionalNote {
  id: string;
  version?: number;
  userId?: string | null;
  verseReference: string;
  verseText: string | null;
  readingPlanId: string | null;
  dayNumber: number | null;
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  coreInsightCategory: string | null;
  coreInsightNote: string | null;
  scholarsNote: string | null;
  actionPlan: string | null;
  coolDownNote: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'pending' | 'blocked' | 'synced';
  clientMutationId?: string;
}

const LEGACY_KEY = 'wechurch_local_devotional_notes_v1';
const storageKey = (userId: string) => `wechurch_devotional_notes_v2:${encodeURIComponent(userId)}`;

export function createLocalDevotionalNoteId() {
  return `local-devotional-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadLocalDevotionalNotes(userId: string): LocalDevotionalNote[] {
  if (typeof window === 'undefined' || !userId) return [];

  try {
    // Keep legacy data untouched; ownerless drafts must never be claimed by the next login.
    const raw = localStorage.getItem(storageKey(userId)) ?? localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((note) => note && note.userId === userId && typeof note.id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveLocalDevotionalNotes(notes: LocalDevotionalNote[], userId: string) {
  if (!userId || notes.some((note) => note.userId !== userId)) throw new Error('Invalid note owner');
  if (typeof window === 'undefined') throw new Error('Device storage unavailable');
  localStorage.setItem(storageKey(userId), JSON.stringify(notes));
}

export function findLocalDevotionalNoteById(noteId: string, userId: string): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes(userId).find((note) => note.id === noteId) || null;
}

export function findLocalDevotionalNoteByReference(verseReference: string, userId: string): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes(userId).find((note) => note.verseReference === verseReference) || null;
}

export function findLocalDevotionalNoteByPlanDay(
  readingPlanId: string,
  dayNumber: number,
  userId: string,
): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes(userId).find((note) => (
    note.readingPlanId === readingPlanId && note.dayNumber === dayNumber
  )) || null;
}

export function upsertLocalDevotionalNote(note: LocalDevotionalNote, userId: string) {
  if (!userId || (note.userId && note.userId !== userId)) throw new Error('Invalid note owner');
  const current = loadLocalDevotionalNotes(userId);
  saveLocalDevotionalNotes([
    { ...note, userId },
    ...current.filter((item) => item.id !== note.id),
  ], userId);
  window.dispatchEvent(new Event('wechurch:devotional-notes-updated'));
}

export function removeLocalDevotionalNote(noteId: string, userId: string) {
  saveLocalDevotionalNotes(loadLocalDevotionalNotes(userId).filter((note) => note.id !== noteId), userId);
  window.dispatchEvent(new Event('wechurch:devotional-notes-updated'));
}

export function mergeLocalDevotionalNotes<T extends { id: string; verseReference: string; updatedAt: string; userId?: string | null }>(
  remoteNotes: T[],
  userId: string,
  offline = false,
): T[] {
  if (!userId) return [];
  const notes = new Map(remoteNotes.filter((note) => note.userId === userId).map((note) => [note.id, note]));
  for (const note of loadLocalDevotionalNotes(userId)) {
    if (note.syncStatus !== 'synced' || offline) notes.set(note.id, note as unknown as T);
  }
  return [...notes.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
