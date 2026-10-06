import { describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { grantInput, summarizeAppointments } from './accessControl';
const base={userId:randomUUID(),roleId:randomUUID(),permissions:['members.read'],scope:'church',church:'IM 行動教會',groupId:null,memberId:null,expiresAt:null,reason:'驗收'};
describe('explicit role grants',()=>{
 it('permits a title without management permissions',()=>expect(grantInput.safeParse({...base,permissions:[]}).success).toBe(true));
 it('rejects unknown permissions and payload fields',()=>{
  expect(grantInput.safeParse({...base,permissions:['admin']}).success).toBe(false);
  expect(grantInput.safeParse({...base,isAdmin:true}).success).toBe(false);
 });
 it('scopes moderation to the approved church, never the shared site',()=>{
  expect(grantInput.safeParse({...base,permissions:['wall.moderate']}).success).toBe(true);
  expect(grantInput.safeParse({...base,scope:'site'}).success).toBe(false);
  expect(grantInput.safeParse({...base,scope:'site',permissions:['wall.moderate']}).success).toBe(false);
 });
 it('rejects mismatched targets, duplicates and a group-scoped visit inbox',()=>{
  expect(grantInput.safeParse({...base,scope:'group'}).success).toBe(false);
  expect(grantInput.safeParse({...base,groupId:randomUUID()}).success).toBe(false);
  expect(grantInput.safeParse({...base,permissions:['members.read','members.read']}).success).toBe(false);
  expect(grantInput.safeParse({...base,scope:'group',groupId:randomUUID(),permissions:['visits.manage']}).success).toBe(false);
 });
});
describe('account-linked group appointment counts',()=>{
 it('deduplicates equal leaders across groups and reports groups with no valid account',()=>{
  expect(summarizeAppointments([{leaderId:'a',coLeaderId:'b'},{leaderId:'a',coLeaderId:null},{leaderId:'foreign',coLeaderId:null},{leaderId:null,coLeaderId:null}],['a','b'])).toEqual({activeGroupCount:4,assignedLeaderCount:2,assignedGroupCount:2,unassignedGroupCount:2,invalidLeaderSlotCount:1});
 });
 it('reports duplicate slots as invalid without doubling the people count',()=>{
  expect(summarizeAppointments([{leaderId:'a',coLeaderId:'a'}],['a'])).toEqual({activeGroupCount:1,assignedLeaderCount:1,assignedGroupCount:1,unassignedGroupCount:0,invalidLeaderSlotCount:1});
 });
});
