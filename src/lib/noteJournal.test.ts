import { expect, it, vi } from 'vitest';
import { journalDate, journalSections, journalMarkdown, loadJournalPosition, saveJournalPosition, sortJournal, type JournalNote } from './noteJournal';
const note = (extra: Partial<JournalNote>) => ({ id: 'a', userId: 'reader', updatedAt: '2026-09-30T00:00:00Z', verseReference: '詩篇 23', ...extra }) as JournalNote;
it('retains all receiving categories, legacy notes and original whitespace', () => {
  const n = note({ observation: ' 原文\n下一行 ', coreInsightNote: '{"GOD_ATTRIBUTE":"恩典","COMMAND":"愛人"}', scholarsNote: '舊研讀', coolDownNote: '舊回顧' });
  expect(journalSections(n).map(s => s.body)).toEqual([' 原文\n下一行 ', '恩典\n愛人', '舊研讀', '舊回顧']);
  expect(journalMarkdown(n)).toContain(' 原文\n下一行 ');
  expect(journalSections(note({ coreInsightNote: '舊文字' }))[0].body).toBe('舊文字');
});
it('orders original reading dates before import/update dates, with Taiwan timezone for new entries', () => {
  const old = note({ sourceDevotionalDate: '2026-07-01' });
  const recent = note({ id: 'b', createdAt: '2026-09-29T23:00:00Z', updatedAt: '2026-09-29T23:00:00Z' });
  expect(journalDate(recent)).toBe('2026-09-30');
  expect(sortJournal([old, recent]).map(n => n.id)).toEqual(['b', 'a']);
  expect(journalDate(note({ updatedAt: 'broken' }))).toBe('日期未記錄');
});
it('rejects corrupt position state and tolerates inaccessible storage', () => {
  vi.stubGlobal('localStorage', { getItem: () => '{"noteId":"a","y":-5}', setItem: () => { throw new Error('blocked'); } });
  expect(loadJournalPosition('reader')).toBeNull();
  expect(() => saveJournalPosition('reader', 'a', 22)).not.toThrow();
  vi.unstubAllGlobals();
});
