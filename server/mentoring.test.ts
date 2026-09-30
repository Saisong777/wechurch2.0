import { describe,it,expect } from 'vitest';
import { mayActOnMentoring,mentoringInvite,mentoringAction } from '../shared/mentoring';
describe('mentoring consent contract',()=>{
  it('requires two different parties to establish the relationship',()=>{
    expect(mayActOnMentoring('pending','accept',true)).toBe(false);
    expect(mayActOnMentoring('pending','accept',false)).toBe(true);
    expect(mayActOnMentoring('active','accept',false)).toBe(false);
  });
  it('allows either party to end active mentoring, never silently reopen',()=>{
    expect(mayActOnMentoring('active','end',true)).toBe(true);expect(mayActOnMentoring('active','end',false)).toBe(true);
    expect(mayActOnMentoring('ended','accept',false)).toBe(false);expect(mayActOnMentoring('declined','accept',false)).toBe(false);
  });
  it('requires explicit consent and rejects caller supplied authority fields',()=>{
    const input={journeyId:'00000000-0000-4000-8000-000000000001',groupId:'00000000-0000-4000-8000-000000000002',mentorId:'00000000-0000-4000-8000-000000000003',cadenceDays:14,agreement:'Meet every two weeks',consent:true};
    expect(mentoringInvite.safeParse(input).success).toBe(true);
    expect(mentoringInvite.safeParse({...input,consent:false}).success).toBe(false);
    expect(mentoringInvite.safeParse({...input,status:'active'}).success).toBe(false);
    expect(mentoringAction.safeParse({version:1,action:'accept'}).success).toBe(false);
  });
});
