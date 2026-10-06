import { describe,it,expect } from 'vitest';
import { DEVOTION_SHARE_MAX_LENGTH,devotionDayWindow,devotionWallShareInput,devotionMultiShareInput,wallTimeRemaining } from '../shared/devotionWall';
import { isClosedPrayer,isUrgentPrayer } from '../shared/prayerInteraction';

describe('daily wall visibility boundaries',()=>{
  it('ends the Taiwan day at midnight, not 24 hours after sharing',()=>{
    expect(devotionDayWindow(new Date('2026-09-11T15:59:59Z'))).toMatchObject({day:'2026-09-11',expiresAt:'2026-09-11T16:00:00.000Z'});
    expect(devotionDayWindow(new Date('2026-09-11T16:00:00Z'))).toMatchObject({day:'2026-09-12',expiresAt:'2026-09-12T16:00:00.000Z'});
    expect(devotionDayWindow(new Date('2026-12-31T16:00:00Z')).day).toBe('2027-01-01');
  });
  it('expires cached content at the boundary even when requests fail',()=>{
    const feed=devotionDayWindow(new Date('2026-09-11T15:59:59Z'));
    expect(wallTimeRemaining(feed,999)).toBe(1);
    expect(wallTimeRemaining(feed,1000)).toBe(0);
    expect(wallTimeRemaining(feed,86400000)).toBe(0);
  });
  it('requires explicit consent, a real source ID and bounded public-only content',()=>{
    const input={sourceId:'00000000-0000-4000-8000-000000000001',day:'2026-09-11',title:'心得',body:'公開領受',reference:'詩篇 23',anonymous:false,consent:true};
    expect(devotionWallShareInput.parse({...input,actionPlan:'PRIVATE',userId:'forged',coolDownNote:'PRIVATE'})).toEqual(input);
    expect(devotionWallShareInput.safeParse({...input,body:'a'.repeat(DEVOTION_SHARE_MAX_LENGTH)}).success).toBe(true);
    for(const patch of [{consent:false},{sourceId:'local-draft'},{body:''},{body:'a'.repeat(DEVOTION_SHARE_MAX_LENGTH+1)},{anonymous:undefined}])expect(devotionWallShareInput.safeParse({...input,...patch}).success).toBe(false);
  });
  it('recognizes closure without falsely claiming an answered prayer',()=>{
    const p={isAnswered:false,isUrgent:true,closedAt:'2026-09-11T12:00:00Z'};
    expect(isClosedPrayer(p)).toBe(true);expect(isUrgentPrayer(p)).toBe(false);
    expect(isClosedPrayer({isAnswered:true})).toBe(true);
    expect(isClosedPrayer({isAnswered:false,closedAt:null})).toBe(false);
  });
});

it('requires an explicit destination and limits dual sharing to the smaller group bound',()=>{
 const input={sourceId:'00000000-0000-4000-8000-000000000001',title:'心得',body:'內容',reference:'詩篇 23',consent:true};
 expect(devotionMultiShareInput.safeParse(input).success).toBe(false);
 expect(devotionMultiShareInput.safeParse({...input,group:{groupId:input.sourceId}}).success).toBe(true);
 expect(devotionMultiShareInput.safeParse({...input,wall:{day:'2026-10-06',anonymous:true}}).success).toBe(true);
 expect(devotionMultiShareInput.safeParse({...input,group:{groupId:input.sourceId},wall:{day:'2026-10-06',anonymous:true},body:'x'.repeat(12001)}).success).toBe(false);
 expect(devotionMultiShareInput.safeParse({...input,group:{groupId:input.sourceId},userId:'forged'}).success).toBe(false);
});
