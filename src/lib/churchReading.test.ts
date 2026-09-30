import { expect, it } from 'vitest';
import { churchScripturePreview, getChurchReadingForToday, type ChurchReadingSummary } from './churchReading';
const reading: ChurchReadingSummary = { id: 'day', planName: '課表', dayNumber: 43, scriptureReference: '以賽亞書 43:1-全', devotionalTitle: '不可當成經文的標題', devotionalText: '短文', previewVerses: Array.from({ length: 28 }, (_, i) => ({ verse: i + 1, text: `原文第 ${i + 1} 節` })) };
it('never fabricates a course while loading and uses the Taiwan calendar day', () => {
  const value = getChurchReadingForToday(new Date('2026-09-12T16:01:00Z'));
  expect(value.date).toBe('2026-09-13');
  expect(value.sourceStatus).toBe('unpublished');
  expect(value.scriptureReference).toBe('');
  expect(value.devotionalText).toBe('');
});
it('limits the homepage to two complete verses while retaining the full reading', () => {
  expect(churchScripturePreview(reading)).toBe('1 原文第 1 節\n2 原文第 2 節');
  expect(reading.previewVerses).toHaveLength(28);
});
it('handles a single verse, supplied text and missing scripture without substituting the title', () => {
  expect(churchScripturePreview({ ...reading, previewVerses: reading.previewVerses.slice(0, 1) })).toBe('1 原文第 1 節');
  expect(churchScripturePreview({ ...reading, previewVerses: [], scriptureText: '第一節\n第二節\n第三節' })).toBe('第一節\n第二節');
  expect(churchScripturePreview({ ...reading, previewVerses: [] })).toBe('經文暫時無法載入');
});
