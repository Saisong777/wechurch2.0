export interface LocalDevotionalNote {
  id: string;
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
}

const LOCAL_DEVOTIONAL_NOTES_KEY = 'wechurch_local_devotional_notes_v1';

export function createLocalDevotionalNoteId() {
  return `local-devotional-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadLocalDevotionalNotes(): LocalDevotionalNote[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LOCAL_DEVOTIONAL_NOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDevotionalNotes(notes: LocalDevotionalNote[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_DEVOTIONAL_NOTES_KEY, JSON.stringify(notes));
}

export function findLocalDevotionalNoteById(noteId: string): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes().find((note) => note.id === noteId) || null;
}

export function findLocalDevotionalNoteByReference(verseReference: string): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes().find((note) => note.verseReference === verseReference) || null;
}

export function findLocalDevotionalNoteByPlanDay(
  readingPlanId: string,
  dayNumber: number
): LocalDevotionalNote | null {
  return loadLocalDevotionalNotes().find((note) => (
    note.readingPlanId === readingPlanId && note.dayNumber === dayNumber
  )) || null;
}

export function upsertLocalDevotionalNote(note: LocalDevotionalNote) {
  const current = loadLocalDevotionalNotes();
  saveLocalDevotionalNotes([
    note,
    ...current.filter((item) => (
      item.id !== note.id
      && item.verseReference !== note.verseReference
      && !(item.readingPlanId && item.readingPlanId === note.readingPlanId && item.dayNumber === note.dayNumber)
    )),
  ]);
  window.dispatchEvent(new Event('wechurch:devotional-notes-updated'));
}

export function removeLocalDevotionalNote(noteId: string) {
  saveLocalDevotionalNotes(loadLocalDevotionalNotes().filter((note) => note.id !== noteId));
  window.dispatchEvent(new Event('wechurch:devotional-notes-updated'));
}

export function mergeLocalDevotionalNotes<T extends { id: string; verseReference: string; updatedAt: string }>(
  remoteNotes: T[]
): T[] {
  const localNotes = loadLocalDevotionalNotes() as unknown as T[];
  return [...remoteNotes, ...localNotes]
    .filter((note, index, notes) => notes.findIndex((item) => item.id === note.id) === index)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
