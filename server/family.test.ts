import { describe, expect, it } from 'vitest';
import { familyCreateInput, familyJoinInput, familySettingsInput, invitationToken, matchingInput, matchingUpdateInput, memberMoveInput } from '../shared/family';
import { shareInput } from '../shared/lifeGroup';

describe('family membership and community contracts', () => {
  it('lists new official families by default with an explicit private option', () => {
    expect(familyCreateInput.parse({ name:'同行', church:'IM 行動教會' })).toMatchObject({listed:true,audience:'unspecified'});
    for (const audience of ['women','men','mixed','couples','other']) expect(familyCreateInput.parse({name:'同行',church:'IM 行動教會',audience,listed:false})).toMatchObject({audience,listed:false});
    expect(familyCreateInput.safeParse({name:'同行',church:'IM 行動教會',audience:'invalid'}).success).toBe(false);
    expect(familySettingsInput.shape.audience.safeParse('invalid').success).toBe(false);
  });
  it('accepts optional bounded introductions without silently approving membership', () => {
    expect(familyJoinInput.parse({})).toEqual({message:''});
    expect(familyJoinInput.parse({message:' 平安 ',status:'approved'})).toEqual({message:'平安'});
    expect(familyJoinInput.safeParse({message:'a'.repeat(1001)}).success).toBe(false);
  });
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
