// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { ChurchLoginInbox } from './ChurchLoginInbox';
import { NotificationBell } from './NotificationBell';
import { setChurchScope } from '@/lib/churchFetch';
const auth=vi.hoisted(()=>({user:{id:'pastor'},loading:false}));
const tenant=vi.hoisted(()=>({selectedChurch:'火樂',isSystemAdmin:false}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/contexts/ChurchContext',()=>({useChurchContext:()=>({identity:'own-church',loading:false,data:tenant}),useChurchScopeKey:()=> 'own-church'}));
let allowed=true,fail=false,handled=false,read=false;const clients:QueryClient[]=[];
const id='10000000-0000-4000-8000-000000000001';
beforeEach(()=>{
  allowed=true;fail=false;handled=false;read=false;tenant.selectedChurch='火樂';tenant.isSystemAdmin=false;setChurchScope(null,false);
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
    const url=String(input);
    if(fail)return new Response('{}',{status:403});
    const counts={canManage:allowed,scopeChurch:'火樂',unhandledArrivals:handled?0:1,unassignedArrivals:0,unreadDigestDays:read?0:1,total:(handled?0:1)+(read?0:1)};
    if(url==='/api/me/church-login-summary')return new Response(JSON.stringify(allowed?counts:{...counts,total:0}));
    if(url==='/api/notifications')return new Response(JSON.stringify({items:[],unreadCount:1,nextCursor:null,snapshotAt:'2026-10-06T01:00:00Z'}));
    if(init?.method==='PATCH'){handled=true;return new Response('{"ok":true}');}
    if(init?.method==='POST'){read=true;return new Response('{"ok":true}');}
    if(url.includes('/days/2026-10-05'))return new Response(JSON.stringify({day:'2026-10-05',scopeChurch:'火樂',scope:'church',members:[{userId:id,name:'合成登入成員',loginCount:3,firstLoginAt:'2026-10-05T02:00:00Z',lastLoginAt:'2026-10-05T06:00:00Z',affiliationChanged:false}],nextCursor:null,inProgress:false}));
    return new Response(JSON.stringify({canManage:true,scopeChurch:'火樂',scope:'church',arrivals:handled?[]:[{id,userId:id,name:'合成新人',email:'synthetic-member@example.test',currentChurch:'火樂',church:'火樂',reason:'initial_choice',status:'pending',version:2,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z'}],nextCursor:null,days:[{day:'2026-10-06',uniqueMembers:2,loginCount:4,firstLoginAt:'2026-10-06T00:00:00Z',lastLoginAt:'2026-10-06T01:00:00Z',read:false,inProgress:true},{day:'2026-10-05',uniqueMembers:1,loginCount:3,firstLoginAt:'2026-10-05T00:00:00Z',lastLoginAt:'2026-10-05T01:00:00Z',read,inProgress:false}],today:'2026-10-06',counts}));
  }));
});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();setChurchScope(null,false);});
function show(){const c=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(c);return render(<QueryClientProvider client={c}><MemoryRouter><NotificationBell/><ChurchLoginInbox/></MemoryRouter></QueryClientProvider>);}
it('combines the persistent arrival and daily digest with the ordinary bell count',async()=>{
  show();expect(await screen.findByRole('link',{name:'通知，3 則未讀'})).toBeVisible();expect(await screen.findByText('合成新人')).toBeVisible();expect(screen.getByText('synthetic-member@example.test')).toBeVisible();expect(screen.getByText('2 人 · 4 次登入')).toBeVisible();
  expect(screen.queryByRole('button',{name:'標記已查看：2026-10-06'})).toBeNull();
  expect(screen.getByRole('button',{name:'標記已查看：2026-10-05'})).toBeVisible();
});
it('records staff handling with the exact arrival version, then removes only the handled arrival',async()=>{
  show();fireEvent.click(await screen.findByRole('button',{name:'標記已關懷：合成新人'}));
  await waitFor(()=>expect(screen.queryByText('合成新人')).toBeNull());expect(screen.getByText('目前沒有待處理的人員。')).toBeVisible();
  const call=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='PATCH');expect(String(call![0])).toBe(`/api/admin/church-login-inbox/${id}/handle?scope=church`);expect(JSON.parse(call![1]!.body as string)).toEqual({version:2});
  expect(await screen.findByRole('link',{name:'通知，2 則未讀'})).toBeVisible();
});
it('lets staff see the daily member list and mark only a closed day as viewed',async()=>{
  show();fireEvent.click(await screen.findByRole('button',{name:'查看登入名單：2026-10-05'}));expect(await screen.findByText('合成登入成員')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'標記已查看：2026-10-05'}));await screen.findByText('已查看');
  const call=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');expect(JSON.parse(call![1]!.body as string)).toEqual({day:'2026-10-05',scope:'church'});
});
it('does not mount or request the management inbox for an ordinary account',async()=>{
  allowed=false;show();await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.queryByText('登入與新成員通知')).toBeNull();expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('/api/admin/church-login-inbox'))).toBe(false);
});
it('hides previously cached people after permission is revoked and displays a retry',async()=>{
  show();await screen.findByText('合成新人');fail=true;fireEvent.click(screen.getByRole('button',{name:'更新名單'}));
  await screen.findByText('登入彙整暫時無法確認，請重新檢查管理權限。');expect(screen.queryByText('合成新人')).toBeNull();expect(screen.queryByText('2 人 · 4 次登入')).toBeNull();
});
it('rejects a response for a different church before rendering any of its people',async()=>{
  const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    const result=await original(input,init);
    if(String(input).startsWith('/api/admin/church-login-inbox?')){const payload=await result.json();return new Response(JSON.stringify({...payload,scopeChurch:'IM 行動教會',arrivals:[{...payload.arrivals[0],name:'不該看到的外教會成員'}]}));}
    return result;
  });
  show();await screen.findByText('登入彙整暫時無法確認，請重新檢查管理權限。');expect(screen.queryByText('不該看到的外教會成員')).toBeNull();expect(screen.queryByText('合成新人')).toBeNull();
});
it('gives a system administrator an explicit unassigned view with its own daily read scope',async()=>{
  tenant.isSystemAdmin=true;
  const original=vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
    const result=await original(input,init);
    if(String(input).startsWith('/api/admin/church-login-inbox?scope=unassigned')){const payload=await result.json();return new Response(JSON.stringify({...payload,scopeChurch:null,scope:'unassigned',arrivals:payload.arrivals.map((arrival:Record<string,unknown>)=>({...arrival,church:null,currentChurch:null,name:'合成未選教會者'}))}));}
    return result;
  });
  show();fireEvent.change(await screen.findByRole('combobox',{name:'登入通知範圍'}),{target:{value:'unassigned'}});expect(await screen.findByText('合成未選教會者')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'標記已查看：2026-10-05'}));await screen.findByText('已查看');
  const call=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');expect(JSON.parse(call![1]!.body as string)).toEqual({day:'2026-10-05',scope:'unassigned'});
});
