// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { clearDeviceDraft, readDeviceDraft, writeDeviceDraft } from './deviceDraft';
const schema=z.object({body:z.string().max(100)}).strict();
beforeEach(()=>localStorage.clear());
it('isolates account and document and preserves the base revision',()=>{
  writeDeviceDraft('a','note',2,{body:'private'},schema);
  expect(readDeviceDraft('b','note',schema)).toBeNull();
  expect(readDeviceDraft('a','other',schema)).toBeNull();
  expect(readDeviceDraft('a','note',schema)).toMatchObject({revision:2,value:{body:'private'}});
  clearDeviceDraft('b','note'); expect(readDeviceDraft('a','note',schema)).not.toBeNull();
  clearDeviceDraft('a','note'); expect(readDeviceDraft('a','note',schema)).toBeNull();
});
it('refuses invalid drafts and ownerless writes',()=>{
  expect(()=>writeDeviceDraft('','note',null,{body:'private'},schema)).toThrow();
  expect(()=>writeDeviceDraft('a','note',null,{body:'x'.repeat(101)},schema)).toThrow();
});
