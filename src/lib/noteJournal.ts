import type { LocalDevotionalNote } from './localDevotionalNotes';
import { parseCategories, parseNotes } from '@/types/spiritual-fitness';

export interface JournalNote extends LocalDevotionalNote {
  userId: string;
  sourceDevotionalDate?: string | null;
  sourceLabel?: string | null;
}
export function receivingText(note: JournalNote): string {
  const notes = parseNotes(note.coreInsightNote, parseCategories(note.coreInsightCategory));
  return Object.values(notes).filter(Boolean).join('\n') || note.heartbeatVerse || '';
}
export function journalSections(note: JournalNote) {
  const sections = [
    { title: '看見', body: note.observation },
    { title: '領受', body: receivingText(note) },
    { title: '回應', body: note.actionPlan },
    { title: '研讀札記', body: note.scholarsNote },
    { title: '回顧', body: note.coolDownNote },
  ].filter(section => section.body?.trim());
  if (note.heartbeatVerse?.trim() && !sections.some(section => section.body?.trim() === note.heartbeatVerse?.trim())) {
    sections.push({ title: '觸動我的經文', body: note.heartbeatVerse });
  }
  return sections;
}
export function hasJournalContent(note: JournalNote) {
  return journalSections(note).length > 0 || !!note.titlePhrase?.trim() || !!note.heartbeatVerse?.trim();
}
export function journalDate(note: JournalNote): string {
  if (note.sourceDevotionalDate && /^\d{4}-\d{2}-\d{2}$/.test(note.sourceDevotionalDate)) return note.sourceDevotionalDate;
  const date = new Date(note.createdAt || note.updatedAt);
  if (!Number.isFinite(date.getTime())) return '日期未記錄';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function sortJournal(notes: JournalNote[]) {
  return [...notes].sort((a, b) => journalDate(b).localeCompare(journalDate(a)) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
export function journalSearchText(note: JournalNote) {
  return [journalDate(note), note.verseReference, note.titlePhrase, note.verseText, note.heartbeatVerse, note.sourceLabel, ...journalSections(note).map(s => s.body)].filter(Boolean).join('\n');
}
export function journalMarkdown(note: JournalNote) {
  return [`## ${journalDate(note)} · ${note.verseReference}`, note.titlePhrase,
    note.sourceLabel ? `來源：${note.sourceLabel}；日期為讀經日期${note.sourceLabel === '教會每日靈修' ? '。' : '，原撰寫時間未知。'}` : '',
    note.verseText ? `### 經文\n\n${note.verseText}` : '',
    ...journalSections(note).map(s => `### ${s.title}\n\n${s.body}`)].filter(Boolean).join('\n\n');
}
export const journalPositionKey = (userId: string) => `wechurch-note-reading-v1:${encodeURIComponent(userId)}`;
export function loadJournalPosition(userId: string): { noteId: string; y: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(journalPositionKey(userId)) || 'null');
    return typeof value?.noteId === 'string' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 200000 ? value : null;
  } catch { return null; }
}
export function saveJournalPosition(userId: string, noteId: string, y: number) {
  try { localStorage.setItem(journalPositionKey(userId), JSON.stringify({ noteId, y: Math.min(200000, Math.max(0, y)) })); } catch { /* Reading works without device storage. */ }
}
