import { expect, it } from 'vitest';
import { readingPlanBodySchema, readingItemReference, readingDateForDay } from './readingPlanInput';

const input = { name: '讀經', startDate: '2026-09-12', bookSelections: [{ bookName: '創世記', chapterStart: 1, chapterEnd: 50 }], chaptersPerDay: 2 };
it('accepts a bounded personal plan and a template plan', () => {
  expect(readingPlanBodySchema.safeParse(input).success).toBe(true);
  expect(readingPlanBodySchema.safeParse({ name: '讀經', startDate: input.startDate, templateId: '44444444-4444-4444-8444-444444444444' }).success).toBe(true);
});
it.each([0, -1, 0.001, 151, Infinity, '1'])('rejects invalid chapters per day %s before any writes or loops', value => {
  expect(readingPlanBodySchema.safeParse({ ...input, chaptersPerDay: value }).success).toBe(false);
});
it('rejects huge or reversed ranges and invalid dates', () => {
  for (const end of [1e12, -1]) expect(readingPlanBodySchema.safeParse({ ...input, bookSelections: [{ bookName: '創世記', chapterStart: 2, chapterEnd: end }] }).success).toBe(false);
  for (const startDate of ['2026-02-30', 'invalid', '2026-9-12']) expect(readingPlanBodySchema.safeParse({ ...input, startDate }).success).toBe(false);
});
it('uses the recorded reading reference, or derives one from the template chapters', () => {
  expect(readingItemReference({ scriptureReference: ' 詩篇 1 ', bookName: '創世記' })).toBe('詩篇 1');
  expect(readingItemReference({ scriptureReference: null, bookName: '創世記', chapterStart: 2, chapterEnd: 3 })).toBe('創世記 2-3');
  expect(readingItemReference({})).toBe('');
});
it('schedules by day number rather than array position across month boundaries', () => {
  expect(readingDateForDay('2026-09-30', 3)).toBe('2026-10-02');
  expect(readingDateForDay('2028-02-28', 2)).toBe('2028-02-29');
});
