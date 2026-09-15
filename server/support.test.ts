import { describe, expect, it } from 'vitest';
import { mayTransitionSupport, supportCreate, supportUpdate } from '../shared/support';
describe('consent and follow-up state', () => {
  it('requires explicit consent and rejects hidden client fields', () => {
    const valid = { title: '需要陪伴', body: '請與我聯絡', target: { kind: 'group', id: '00000000-0000-4000-8000-000000000001', receiverId: '00000000-0000-4000-8000-000000000002' }, consent: true };
    expect(supportCreate.safeParse(valid).success).toBe(true);
    expect(supportCreate.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(supportCreate.safeParse({ ...valid, senderId: valid.target.id }).success).toBe(false);
  });
  it('rejects impossible dates and accepts leap days', () => {
    const valid = { version: 1, status: 'accepted', dueDate: '2028-02-29' };
    expect(supportUpdate.safeParse(valid).success).toBe(true);
    for (const dueDate of ['2026-02-29','2026-13-01','2026-04-31']) expect(supportUpdate.safeParse({ ...valid, dueDate }).success).toBe(false);
  });
  it('only the sender cancels and reopens, while the receiver accepts and completes', () => {
    expect(mayTransitionSupport('open', 'accepted', false)).toBe(true);
    expect(mayTransitionSupport('open', 'accepted', true)).toBe(false);
    expect(mayTransitionSupport('completed', 'open', true)).toBe(true);
    expect(mayTransitionSupport('cancelled', 'accepted', false)).toBe(false);
    expect(mayTransitionSupport('accepted', 'cancelled', true)).toBe(true);
  });
});
