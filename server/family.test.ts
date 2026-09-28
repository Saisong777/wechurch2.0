import { describe, expect, it } from 'vitest';
import { invitationToken, matchingInput, matchingUpdateInput, memberMoveInput } from '../shared/family';
import { shareInput } from '../shared/lifeGroup';

describe('family membership and community contracts', () => {
  it('accepts grouped short codes and preserves existing long invitation links', () => {
    expect(invitationToken.parse('AB12-CD34-EF56')).toBe('ab12cd34ef56');
    expect(invitationToken.parse('a'.repeat(48))).toBe('a'.repeat(48));
    expect(invitationToken.safeParse('1234').success).toBe(false);
  });
  it('requires contact consent and bounded intake fields', () => {
    const input = { church: 'IM 行動教會', availability: '週五', contact: 'test@example.test', consent: true };
    expect(matchingInput.safeParse(input).success).toBe(true);
    expect(matchingInput.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(matchingInput.safeParse({ ...input, contact: 'a'.repeat(201) }).success).toBe(false);
    expect(matchingUpdateInput.safeParse({ version: 1, status: 'matched' }).success).toBe(false);
  });
  it('rejects transfers without an audit reason', () => {
    expect(memberMoveInput.safeParse({ userId: '00000000-0000-4000-8000-000000000001', targetGroupId: null, reason: '' }).success).toBe(false);
  });
  it('allows ordinary posts but not anonymous or private-source message spoofing', () => {
    const post = { kind: 'message', title: '平安', body: '聚會見', consent: true };
    expect(shareInput.safeParse(post).success).toBe(true);
    expect(shareInput.safeParse({ ...post, anonymous: true }).success).toBe(false);
    expect(shareInput.safeParse({ ...post, sourceId: '00000000-0000-4000-8000-000000000001' }).success).toBe(false);
  });
});
