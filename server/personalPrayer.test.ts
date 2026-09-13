import { describe, expect, it } from 'vitest';
import { personalPrayerInput } from '../shared/personalPrayer';

describe('private prayer input', () => {
  it('defaults to waiting and strips client-supplied ownership', () => {
    const input = personalPrayerInput.parse({ title: ' Today ', prayer: '', userId: 'another-person' });
    expect(input).toEqual({ title: 'Today', prayer: '', response: '', status: 'waiting', responseType: null });
  });
  it('rejects empty titles and unbounded input', () => {
    expect(personalPrayerInput.safeParse({ title: ' ', prayer: '' }).success).toBe(false);
    expect(personalPrayerInput.safeParse({ title: 'x'.repeat(161), prayer: '' }).success).toBe(false);
    expect(personalPrayerInput.safeParse({ title: 'Today', prayer: 'x'.repeat(10001) }).success).toBe(false);
  });
  it('preserves an earlier response when returning to waiting', () => {
    expect(personalPrayerInput.parse({ title: 'Today', prayer: '', response: 'Earlier progress', status: 'waiting' }).response).toBe('Earlier progress');
  });
});
