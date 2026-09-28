import { describe,expect,it } from 'vitest';
import { createGatheringInput,saveAttendanceInput } from '../shared/leaderDashboard';
const key='user:00000000-0000-4000-8000-000000000001';
describe('gathering input boundaries',()=>{
  it('rejects invalid dates, empty or duplicate rosters and arbitrary identity keys',()=>{
    const value={date:'2026-09-28',kind:'group',roster:[key]};
    expect(createGatheringInput.safeParse(value).success).toBe(true);
    for(const override of [{date:'2026-02-30'},{roster:[]},{roster:[key,key]},{roster:['other-person']}])expect(createGatheringInput.safeParse({...value,...override}).success).toBe(false);
  });
  it('requires a version and explicit unknown status and forbids unexpected write fields',()=>{
    const value={version:1,entries:[{key,status:'unrecorded'}],visitors:0,cancelled:false};
    expect(saveAttendanceInput.safeParse(value).success).toBe(true);
    for(const override of [{version:0},{visitors:-1},{entries:[{key}]},{entries:[{key,status:'spiritually_weak'}]},{groupId:key}])expect(saveAttendanceInput.safeParse({...value,...override}).success).toBe(false);
  });
});
