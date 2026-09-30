import { describe, expect, it } from 'vitest';
import { careActionInput, careToday, needsCare, visitCreate, visitUpdate } from './care';
describe('care follow-up dates', () => {
  it('uses Taiwan date across UTC midnight', () => expect(careToday(new Date('2026-09-28T16:01:00Z'))).toBe('2026-09-29'));
  it('returns previously cared-for people when their follow-up is due', () => {
    expect(needsCare({ lastCaredAt: '2026-09-01', nextCareDate: '2026-09-28' }, '2026-09-28')).toBe(true);
    expect(needsCare({ lastCaredAt: null, nextCareDate: '2026-10-01' }, '2026-09-28')).toBe(false);
    expect(needsCare({ lastCaredAt: null, isArchived: true }, '2026-09-28')).toBe(false);
    expect(needsCare({ lastCaredAt: null }, '2026-09-28')).toBe(true);
    expect(needsCare({ lastCaredAt: '2026-09-01' }, '2026-09-28')).toBe(false);
  });
  it('rejects invalid dates and unknown action types', () => {
    expect(careActionInput.safeParse({ nextCareDate: '2026-02-30' }).success).toBe(false);
    expect(careActionInput.safeParse({ actionType: 'fake' }).success).toBe(false);
  });
});
describe('visit request consent and scheduling', () => {
  const input = { name: '測試朋友', reason: '需要探訪', contactMethod: '先與提出者聯絡', urgency: 'urgent', consent: true };
  it('requires consent and contact information; rejects private record payloads', () => {
    expect(visitCreate.safeParse(input).success).toBe(true);
    expect(visitCreate.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(visitCreate.safeParse({ ...input, contactMethod: '' }).success).toBe(false);
    expect(visitCreate.safeParse({ ...input, privateNotes: 'not permitted' }).success).toBe(false);
  });
  it('requires a version, assignee and meaningful update for arranged visits', () => {
    const update = { version: 1, status: 'assigned', assigneeId: null, dueDate: null, note: '明日聯絡' };
    expect(visitUpdate.safeParse(update).success).toBe(false);
    expect(visitUpdate.safeParse({ ...update, status: 'open' }).success).toBe(true);
    expect(visitUpdate.safeParse({ ...update, status: 'open', version: 0 }).success).toBe(false);
    expect(visitUpdate.safeParse({ ...update, status: 'open', note: ' ' }).success).toBe(false);
  });
});
