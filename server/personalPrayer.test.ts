import { describe, expect, it } from 'vitest';
import { isGraceRecord, personalPrayerInput, personalPrayerWrite, responseStatus } from '../shared/personalPrayer';

describe('private prayer input', () => {
  const grace = {title:'恩典',prayer:'感謝神的帶領',recordKind:'grace',occurredOn:'2026-09-28',status:'answered',responseType:'grace'};
  it('requires a real date, content and answered state for direct grace stories', () => {
    expect(personalPrayerWrite.safeParse(grace).success).toBe(true);
    for (const invalid of [{occurredOn:null},{occurredOn:'2026-02-30'},{prayer:' '},{status:'waiting'},{responseType:null},{recordKind:'public'}]) {
      expect(personalPrayerWrite.safeParse({...grace,...invalid}).success).toBe(false);
    }
  });
  it('includes answered prayers and grace stories, not generic completed prayers', () => {
    expect(isGraceRecord(personalPrayerWrite.parse(grace))).toBe(true);
    expect(isGraceRecord(personalPrayerInput.parse({title:'Answered',prayer:'',status:'answered'}))).toBe(true);
    expect(isGraceRecord(personalPrayerInput.parse({title:'Legacy grace',prayer:'',status:'grace_response',responseType:'grace'}))).toBe(true);
    for (const responseType of ['ended','blocked','other','keep_waiting']) {
      expect(isGraceRecord(personalPrayerInput.parse({title:'History',prayer:'',status:'grace_response',responseType}))).toBe(false);
    }
  });
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
  it('keeps waiting active and distinguishes answers from ended requests', () => {
    expect(responseStatus('keep_waiting')).toBe('waiting');
    expect(responseStatus('grace')).toBe('answered');
    expect(responseStatus('ended')).toBe('grace_response');
  });
  it('validates conflict tokens and explicit wall closing', () => {
    expect(personalPrayerWrite.safeParse({title:'Today',prayer:'',expectedUpdatedAt:'bad'}).success).toBe(false);
    expect(personalPrayerWrite.safeParse({title:'Today',prayer:'',status:'waiting',closePublicShare:true}).success).toBe(false);
    expect(personalPrayerWrite.safeParse({title:'Today',prayer:'',status:'answered',closePublicShare:true}).success).toBe(true);
  });
});
