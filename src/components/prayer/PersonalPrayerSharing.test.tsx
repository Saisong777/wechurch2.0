// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PersonalPrayerShareDialog } from './PersonalPrayerSharing';
import type { PersonalPrayer } from '@shared/personalPrayer';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
const record:PersonalPrayer={id:'00000000-0000-4000-8000-000000000001',userId:'actor',title:'本人禱告',prayer:'可選擇的禱告',response:'PRIVATE RESPONSE NEVER SHARED',status:'waiting',responseType:null,createdAt:'2026-09-11',updatedAt:'2026-09-11'};
let payload:any; let fail=false; const clients:QueryClient[]=[];
beforeEach(()=>{fail=false;payload=undefined;vi.stubGlobal('fetch',vi.fn(async(path:string,options?:RequestInit)=>{
  if(options?.method==='POST'){payload=JSON.parse(options.body as string);return {ok:!fail,json:async()=>fail?{error:'連線失敗，尚未分享'}:{created:1,skipped:0}};}
  return {ok:true,json:async()=>({groups:[{id:'00000000-0000-4000-8000-000000000002',name:'同行小組'}]})};
}));});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show(){const done=vi.fn();const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><MemoryRouter><PersonalPrayerShareDialog records={[record]} done={done} close={vi.fn()} /></MemoryRouter></QueryClientProvider>);return done;}
const consent=()=>screen.getByRole('checkbox',{name:/我確認將以上內容/});
const publicScope=()=>screen.getByRole('checkbox',{name:/分享到公共禱告牆/});
it('previews only selected prayer text, excluding private response',()=>{
  show();expect(screen.queryByText(record.response)).toBeNull();expect(screen.getByRole('textbox',{name:'第 1 筆分享內容'}).getAttribute('maxlength')).toBe('10000');
  expect((screen.getByRole('button',{name:'確認分享'}) as HTMLButtonElement).disabled).toBe(true);
});
it('resets consent when audience, anonymity, or preview text changes',async()=>{
  show();fireEvent.click(publicScope());fireEvent.click(consent());
  expect((screen.getByRole('button',{name:'確認分享'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));expect((consent() as HTMLInputElement).checked).toBe(false);
  fireEvent.click(consent());fireEvent.change(screen.getByRole('textbox',{name:'第 1 筆分享內容'}),{target:{value:'更短的分享'}});expect((consent() as HTMLInputElement).checked).toBe(false);
  await screen.findByRole('option',{name:'同行小組'});fireEvent.click(consent());fireEvent.change(screen.getByRole('combobox',{name:'分享至小組'}),{target:{value:'00000000-0000-4000-8000-000000000002'}});expect((consent() as HTMLInputElement).checked).toBe(false);
});
it('sends selected edited text and explicit anonymity without private fields',async()=>{
  const done=show();fireEvent.click(publicScope());fireEvent.click(screen.getByRole('checkbox',{name:'匿名分享'}));fireEvent.change(screen.getByRole('textbox',{name:'第 1 筆分享內容'}),{target:{value:'公開摘錄'}});fireEvent.click(consent());fireEvent.click(screen.getByRole('button',{name:'確認分享'}));
  await waitFor(()=>expect(done).toHaveBeenCalledOnce());expect(payload).toEqual({items:[{sourceId:record.id,title:record.title,body:'公開摘錄'}],groupId:null,publicWall:true,anonymous:true,consent:true});
});
it('keeps preview and selections on failed publication',async()=>{
  fail=true;const done=show();fireEvent.click(publicScope());fireEvent.click(consent());fireEvent.click(screen.getByRole('button',{name:'確認分享'}));
  expect(await screen.findByRole('alert')).toBeTruthy();expect(done).not.toHaveBeenCalled();expect((screen.getByRole('textbox',{name:'第 1 筆分享內容'}) as HTMLTextAreaElement).value).toBe(record.prayer);
});
