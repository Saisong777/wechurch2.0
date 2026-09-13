import { describe,it,expect } from 'vitest';
import { prayerInteractionInput, prayerReactionKind, prayerReactionInput, compareWallPrayers, isUrgentPrayer } from '../shared/prayerInteraction';
import { prayerBodySchema, prayerPatchSchema } from './securityPolicies';

describe('public prayer interactions',()=>{
  it('accepts legacy encouragement and strips forged identity',()=>{
    expect(prayerInteractionInput.parse({content:' 鼓勵 ',userId:'forged',authorName:'forged'})).toEqual({content:'鼓勵',kind:'encouragement'});
  });
  it('accepts prayer, words, and predefined stickers',()=>{
    for(const kind of ['prayer','scripture']) expect(prayerInteractionInput.safeParse({kind,content:'測試'}).success).toBe(true);
    for(const sticker of ['praying','together','peace']) expect(prayerInteractionInput.safeParse({kind:'sticker',sticker}).success).toBe(true);
  });
  it('rejects empty text, unknown stickers, mixed payloads and invalid receipt keys',()=>{
    for(const input of [{content:' '},{content:'a'.repeat(1001)},{kind:'sticker',sticker:'url'},{kind:'sticker'},{kind:'sticker',sticker:'peace',content:'mixed'},{kind:'prayer',sticker:'peace',content:'mixed'},{content:'hello',requestId:'invalid'}]) expect(prayerInteractionInput.safeParse(input).success).toBe(false);
  });
  it('requires explicit reaction state and an allowed kind',()=>{
    expect(prayerReactionInput.safeParse({selected:true}).success).toBe(true);
    expect(prayerReactionInput.safeParse({selected:false}).success).toBe(true);
    expect(prayerReactionInput.safeParse({selected:'true'}).success).toBe(false);
    expect(prayerReactionKind.safeParse('forged').success).toBe(false);
  });
  it('accepts urgency only as a boolean',()=>{
    expect(prayerBodySchema.parse({content:'代禱',isUrgent:true}).isUrgent).toBe(true);
    expect(prayerPatchSchema.parse({isUrgent:false}).isUrgent).toBe(false);
    expect(prayerPatchSchema.safeParse({isUrgent:'yes'}).success).toBe(false);
  });
  it('prioritizes unanswered urgent prayers, then pins and recency without urgency after resolution',()=>{
    const normal={isUrgent:false,isAnswered:false,isPinned:false,createdAt:'2026-09-11'};
    const urgent={...normal,isUrgent:true,createdAt:'2026-09-01'};
    const pinned={...normal,isPinned:true};
    const answered={...urgent,isAnswered:true};
    expect([normal,pinned,urgent].sort(compareWallPrayers)).toEqual([urgent,pinned,normal]);
    expect(isUrgentPrayer(answered)).toBe(false);
    expect(compareWallPrayers(answered,normal)).toBeGreaterThan(0);
  });
});
