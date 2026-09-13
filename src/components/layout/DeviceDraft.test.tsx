// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DeviceDraft } from './DeviceDraft';
import { writeDeviceDraft, readDeviceDraft } from '@/lib/deviceDraft';
const schema=z.object({text:z.string()});
beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('persists edits under the current account and offers recovery after remount',()=>{
  const props={owner:'a',scope:'note',revision:2,value:{text:'尚未同步'},dirty:true,busy:false,schema,restore:vi.fn(),preview:(value:{text:string})=>value.text};
  const first=render(<DeviceDraft {...props}/>);
  expect(readDeviceDraft('a','note',schema)?.value.text).toBe('尚未同步');
  first.unmount();
  render(<DeviceDraft {...props} dirty={false} value={{text:''}}/>);
  fireEvent.click(screen.getByRole('button',{name:'恢復草稿'}));
  expect(props.restore).toHaveBeenCalledWith({text:'尚未同步'});
});
it('does not restore an old draft over a newer cloud revision',()=>{
  writeDeviceDraft('a','note',1,{text:'舊稿'},schema);
  render(<DeviceDraft owner="a" scope="note" revision={2} value={{text:'雲端'}} dirty={false} busy={false} schema={schema} restore={vi.fn()} preview={v=>v.text}/>);
  expect(screen.getByRole('button',{name:'恢復草稿'})).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('不會自動覆蓋');
});
