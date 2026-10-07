// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirstChurchChoice } from './FirstChurchChoice';
import { setChurchScope } from '@/lib/churchFetch';
const auth = vi.hoisted(() => ({user: {id: 'new-member'} as {id:string} | null, loading: false, refreshAuth: vi.fn(), signOut: vi.fn()}));
vi.mock('@/contexts/AuthContext', () => ({useAuth: () => auth}));
const context=vi.hoisted(()=>({loading:false,error:'',refreshChurch:vi.fn()}));
vi.mock('@/contexts/ChurchContext',async(importOriginal)=>({...await importOriginal<typeof import('@/contexts/ChurchContext')>(),useChurchContext:()=>context}));
const choices = [{id:'IM 行動教會',name:'iM行動教會'},{id:'火樂',name:'火樂'}];
let status: {currentChurch:string|null;canChoose:boolean;choiceLocked:boolean;choices:typeof choices;reason:string};
let failPost = false; const clients: QueryClient[] = [];
beforeEach(() => {
  auth.user = {id:'new-member'}; auth.loading = false; auth.refreshAuth.mockReset().mockResolvedValue({id:'new-member'}); auth.signOut.mockReset();context.loading=false;context.error='';context.refreshChurch.mockReset(); failPost = false;
  setChurchScope(null, false);
  status = {currentChurch:null,canChoose:true,choiceLocked:false,choices,reason:'choose'};
  vi.stubGlobal('fetch',vi.fn(async(_url,init) => {
    if(init?.method === 'POST') {
      if(failPost) return new Response(JSON.stringify({error:'網路暫時無法確認'}),{status:503});
      const input = JSON.parse(init.body as string); status = {...status,currentChurch:input.churchId,canChoose:false,choiceLocked:true,reason:input.churchId===null?'no_church':'assigned'};
      return new Response(JSON.stringify({ok:true,currentChurch:input.churchId,initialChoiceChurch:input.churchId,replayed:false,choiceLocked:true}));
    }
    return new Response(JSON.stringify(status));
  }));
});
afterEach(() => {cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();setChurchScope(null,false);});
function show(){const c=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(c);return render(<QueryClientProvider client={c}><FirstChurchChoice/></QueryClientProvider>);}
it('requires an explicit choice and a second confirmation before making the one-time write',async()=>{
  show();const select=await screen.findByRole('combobox',{name:'首次選擇所屬教會'});
  expect(select).toHaveValue('');expect(screen.getByRole('button',{name:'繼續確認'})).toBeDisabled();
  expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  fireEvent.change(select,{target:{value:'火樂'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));
  expect(screen.getByText('確認加入「火樂」？之後需要管理者才能變更。')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'返回選擇'}));expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await waitFor(()=>expect(auth.refreshAuth).toHaveBeenCalledTimes(1));
  const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1]!.body as string)).toEqual({churchId:'火樂',requestId:expect.stringMatching(/^[0-9a-f-]{36}$/)});
  expect(screen.queryByRole('combobox')).toBeNull();
});
it('never offers a second choice to an assigned or historical locked account',async()=>{
  status={...status,currentChurch:'火樂',canChoose:false,choiceLocked:true,reason:'assigned'};const view=show();await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.queryByRole('combobox')).toBeNull();
  view.unmount();clients.forEach(c=>c.clear());status={...status,currentChurch:null,reason:'manager_required'};show();expect(await screen.findByText('請管理者協助確認教會')).toBeVisible();expect(screen.queryByRole('combobox')).toBeNull();
});
it('directs an unknown historical church to the manager without allowing a new choice',async()=>{status={...status,currentChurch:'歷史未知教會',canChoose:false,choiceLocked:true,reason:'manager_required'};show();expect(await screen.findByText('請管理者協助確認教會')).toBeVisible();expect(screen.queryByRole('combobox')).toBeNull();expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);});
it('reuses the same request receipt after an uncertain response, without silently changing the chosen church',async()=>{
  failPost=true;show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'IM 行動教會'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await screen.findByText('網路暫時無法確認');await waitFor(()=>expect(screen.getByRole('button',{name:'確認教會'})).toBeEnabled());
  failPost=false;fireEvent.click(screen.getByRole('button',{name:'確認教會'}));await waitFor(()=>expect(auth.refreshAuth).toHaveBeenCalledTimes(1));
  const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST').map(([,init])=>JSON.parse(init!.body as string));expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);
});
it('shows a retry when eligibility cannot be verified and never invents a church',async()=>{
  vi.mocked(fetch).mockImplementation(async()=>new Response('{}',{status:503}));show();await screen.findByText('教會選擇狀態暫時無法確認。');expect(screen.queryByRole('combobox')).toBeNull();expect(screen.getByRole('button',{name:'重新確認選擇資格'})).toBeEnabled();
});
it('makes no request for an anonymous visitor',async()=>{auth.user=null;show();await waitFor(()=>expect(fetch).not.toHaveBeenCalled());expect(screen.queryByRole('combobox')).toBeNull();});

it('confirms no church with an explicit null and does not offer a second choice',async()=>{
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'__choice_none'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));
  expect(screen.getByText(/確認「目前沒有教會」/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'返回選擇'}));expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await waitFor(()=>expect(auth.refreshAuth).toHaveBeenCalledTimes(1));
  const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');expect(writes).toHaveLength(1);expect(JSON.parse(writes[0][1]!.body as string).churchId).toBeNull();expect(screen.queryByRole('combobox')).toBeNull();
});
it('reads future catalog entries from the API without defaulting to them',async()=>{
  status={...status,choices:[...choices,{id:'future-church',name:'未來教會'}]};show();
  expect(await screen.findByRole('option',{name:'未來教會'})).toBeInTheDocument();expect(screen.getByRole('combobox')).toHaveValue('');
});
it('fails closed on an inconsistent selection response and offers logout',async()=>{
  status={...status,canChoose:false,reason:'choose'};show();await screen.findByText('教會選擇狀態暫時無法確認。');expect(screen.queryByRole('combobox')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'登出'}));expect(auth.signOut).toHaveBeenCalledTimes(1);
});

it('offers context recovery even while the disabled onboarding query remains pending',async()=>{
  context.error='教會資料失敗';show();expect(await screen.findByText('教會資料暫時無法確認。')).toBeVisible();expect(screen.queryByText('正在確認教會選擇…')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'重新載入教會資料'}));expect(context.refreshChurch).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'登出'})).toBeEnabled();
});
it.each(['火樂','__choice_none'])('recovers the verified committed %s choice after its POST response is lost',async selected=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(url,init)=>{
    if(init?.method==='POST'){
      const input=JSON.parse(init.body as string);status={...status,currentChurch:input.churchId,canChoose:false,choiceLocked:true,reason:input.churchId===null?'no_church':'assigned'};
      throw new Error('Response lost after commit');
    }
    return original(url,init);
  });
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:selected}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await waitFor(()=>expect(context.refreshChurch).toHaveBeenCalledTimes(1));expect(auth.refreshAuth).toHaveBeenCalledTimes(1);expect(screen.queryByRole('combobox')).toBeNull();
});
it('keeps an uncertain write behind the recovery gate when the follow-up status also fails',async()=>{
  let posted=false;const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(url,init)=>{if(init?.method==='POST')posted=true;if(posted)return new Response('{}',{status:503});return original(url,init);});
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  expect(await screen.findByText('教會選擇狀態暫時無法確認。')).toBeVisible();expect(auth.refreshAuth).not.toHaveBeenCalled();expect(context.refreshChurch).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'重新確認選擇資格'})).toBeEnabled();
});
it('does not refresh a church scope after recovery resolves to a different account',async()=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  auth.refreshAuth.mockResolvedValue({id:'other-member'});
  vi.mocked(fetch).mockImplementation(async(url,init)=>{if(init?.method==='POST'){status={...status,currentChurch:'火樂',canChoose:false,choiceLocked:true,reason:'assigned'};throw new Error('Response lost');}return original(url,init);});
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await waitFor(()=>expect(auth.refreshAuth).toHaveBeenCalledTimes(1));expect(context.refreshChurch).not.toHaveBeenCalled();
});
it.each(['火樂','__choice_none'])('recovers %s on a later manual retry after both POST response and first status read fail',async selected=>{
  let posted=false,allowRecovery=false;const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(url,init)=>{
    if(init?.method==='POST'){
      posted=true;const input=JSON.parse(init.body as string);status={...status,currentChurch:input.churchId,canChoose:false,choiceLocked:true,reason:input.churchId===null?'no_church':'assigned'};
      throw new Error('Committed but response timed out');
    }
    if(posted&&!allowRecovery)return new Response('{}',{status:503});
    return original(url,init);
  });
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:selected}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));
  await screen.findByText('教會選擇狀態暫時無法確認。');expect(auth.refreshAuth).not.toHaveBeenCalled();expect(context.refreshChurch).not.toHaveBeenCalled();
  allowRecovery=true;fireEvent.click(screen.getByRole('button',{name:'重新確認選擇資格'}));
  await waitFor(()=>expect(context.refreshChurch).toHaveBeenCalledTimes(1));expect(auth.refreshAuth).toHaveBeenCalledTimes(1);expect(screen.queryByRole('combobox')).toBeNull();
  expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
it('does not apply the recovered manual retry to a different account',async()=>{
  let posted=false,allowRecovery=false;const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(url,init)=>{
    if(init?.method==='POST'){posted=true;status={...status,currentChurch:'火樂',canChoose:false,choiceLocked:true,reason:'assigned'};throw new Error('Committed but response timed out');}
    if(posted&&!allowRecovery)return new Response('{}',{status:503});return original(url,init);
  });
  show();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});fireEvent.click(screen.getByRole('button',{name:'繼續確認'}));fireEvent.click(screen.getByRole('button',{name:'確認教會'}));await screen.findByText('教會選擇狀態暫時無法確認。');
  allowRecovery=true;auth.refreshAuth.mockResolvedValue({id:'other-member'});fireEvent.click(screen.getByRole('button',{name:'重新確認選擇資格'}));await waitFor(()=>expect(auth.refreshAuth).toHaveBeenCalledTimes(1));expect(context.refreshChurch).not.toHaveBeenCalled();
});
