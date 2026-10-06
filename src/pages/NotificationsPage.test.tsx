// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import NotificationsPage from './NotificationsPage';
import { NotificationBell } from '@/components/notifications/NotificationBell';
let user:{id:string} | null={id:'owner'};
vi.mock('@/contexts/AuthContext',() => ({useAuth:() => ({user,loading:false})}));
vi.mock('@/components/layout/Header',() => ({Header:() => <div/>}));
vi.mock('@/components/notifications/NotificationEmailSettings',() => ({NotificationEmailSettings:() => <section id="email-settings"/>}));
const id='a2c5b37c-536b-461d-8796-965f1dbb3d2c';
const href='/prayer-wall?prayer=a2c5b37c-536b-461d-8796-965f1dbb3d2c&comment=23c67a5e-94cc-4c9a-9624-ffb56c169e38';
let unread=1,fail=false;const clients:QueryClient[]=[];
beforeEach(() => {
  user={id:'owner'};unread=1;fail=false;
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit) => {
    if (fail) return {ok:false,status:503};
    if(_url==='/api/me/church-login-summary') return {ok:true,json:async()=>({canManage:false,scopeChurch:null,unhandledArrivals:0,unassignedArrivals:0,unreadDigestDays:0,total:0})};
    if (init.method==='POST') {unread=0;return {ok:true,json:async() => ({ok:true})};}
    return {ok:true,json:async() => ({items:[{id,kind:'prayer_comment',title:'你參與的代禱有新的回應',createdAt:'2026-09-30T10:00:00.123Z',readAt:unread ? null : '2026-09-30T10:01:00Z',href}],unreadCount:unread,nextCursor:null,snapshotAt:'2026-09-30T10:01:00.123456Z'})};
  }));
});
afterEach(() => {cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function show() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/notifications']}><NotificationBell/><Routes><Route path="/notifications" element={<NotificationsPage/>}/><Route path="/prayer-wall" element={<h1>對應的留言</h1>}/></Routes></MemoryRouter></QueryClientProvider>);
}
it('shares one unread query between the bell and page, with an accessible badge',async() => {
  show();await screen.findByRole('link',{name:'通知，1 則未讀'});
  expect(screen.getByText('1 則未讀')).toBeTruthy();expect(vi.mocked(fetch).mock.calls.filter(([url])=>url==='/api/notifications')).toHaveLength(1);
});
it('marks a notification read and opens the exact source comment without a dialog',async() => {
  show();const link=await screen.findByRole('link',{name:'你參與的代禱有新的回應，未讀'});expect(link).toHaveAttribute('href',href);
  fireEvent.click(link);await screen.findByRole('heading',{name:'對應的留言'});
  expect(vi.mocked(fetch).mock.calls.some(([url,init])=>url===`/api/notifications/${id}/read` && init?.method==='POST')).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('marks all read only through the server snapshot and updates the bell',async() => {
  show();fireEvent.click(await screen.findByRole('button',{name:'全部標為已讀'}));
  await screen.findByText('0 則未讀');await screen.findByRole('link',{name:'通知'});
  const call=vi.mocked(fetch).mock.calls.find(([url])=>url==='/api/notifications/read-all');
  expect(JSON.parse(call![1]!.body as string)).toEqual({before:'2026-09-30T10:01:00.123456Z'});
});
it('offers retry on a failure without presenting cached private content',async() => {
  fail=true;show();await screen.findByText('通知暫時無法載入。');
  expect(screen.queryByText('你參與的代禱有新的回應')).toBeNull();
  fail=false;fireEvent.click(screen.getByRole('button',{name:'重新載入通知'}));await screen.findByText('你參與的代禱有新的回應');
});
it('does not request notifications or show a bell before login',async() => {
  user=null;show();expect(screen.getByText('登入後即可查看你的通知。')).toBeTruthy();
  await waitFor(() => expect(fetch).not.toHaveBeenCalled());expect(screen.queryByRole('link',{name:'通知'})).toBeNull();
});
