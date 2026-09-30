import { expect, it } from 'vitest';
import { devotionChanges, devotionGaps } from './devotionGovernance';
import type { DevotionEntry } from './churchDevotion';
const entry: DevotionEntry = { id:'fixture',date:'2026-09-13',planName:'課表',dayNumber:1,scriptureReference:'以賽亞書 1',scriptureText:'',devotionalTitle:'標題',devotionalText:'短文',prayer:'',loveAction:'',status:'published',version:1,updatedAt:'' };
it('distinguishes missing dates from unpublished drafts across a month boundary', () => {
  expect(devotionGaps([entry,{...entry,date:'2026-09-14',status:'draft'}], '2026-09-13','2026-09-15')).toEqual([{date:'2026-09-14',status:'draft'},{date:'2026-09-15',status:'missing'}]);
  expect(devotionGaps([], '2028-02-28','2028-03-01')).toHaveLength(3);
  expect(devotionGaps([], 'invalid','2026-09-13')).toEqual([]);
});
it('reports content changes only and never treats metadata as approved content', () => {
  expect(devotionChanges(entry,{...entry,devotionalText:'新的短文'})).toEqual([{key:'devotionalText',label:'靈修短文',before:'短文',after:'新的短文'}]);
  expect(devotionChanges(entry,entry)).toEqual([]);
});
