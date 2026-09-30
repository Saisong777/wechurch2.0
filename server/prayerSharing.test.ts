import { describe,it,expect } from 'vitest';
import { prayerSharingInput } from '../shared/prayerSharing';
const item={sourceId:'00000000-0000-4000-8000-000000000001',title:'測試',body:'選擇分享的內容'};
const input={items:[item],groupId:null,publicWall:true,anonymous:true,consent:true};
describe('personal prayer sharing consent and scope',()=>{
  it('requires selected items, destination, anonymity choice, and consent',()=>{
    expect(prayerSharingInput.safeParse(input).success).toBe(true);
    for(const patch of [{items:[]},{publicWall:false},{consent:false},{anonymous:undefined}]) expect(prayerSharingInput.safeParse({...input,...patch}).success).toBe(false);
  });
  it('rejects duplicates, invalid groups, and oversized batches',()=>{
    for(const patch of [{items:[item,item]},{groupId:'invalid'},{items:Array.from({length:21},()=>item)}]) expect(prayerSharingInput.safeParse({...input,...patch}).success).toBe(false);
  });
  it('strips private responses and forged authors from the share payload',()=>{
    const parsed=prayerSharingInput.parse({...input,ownerId:'forged',items:[{...item,response:'private',userId:'forged'}]});
    expect(parsed).toEqual(input);
  });
  it('rejects empty and overlong copied text',()=>{
    for(const body of ['', ' '.repeat(10),'a'.repeat(10001)]) expect(prayerSharingInput.safeParse({...input,items:[{...item,body}]}).success).toBe(false);
  });
});
