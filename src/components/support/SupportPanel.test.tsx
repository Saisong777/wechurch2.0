// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupportPanel } from './SupportPanel';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture' }, loading: false }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const targets = [{ kind: 'group', id: '00000000-0000-4000-8000-000000000001', receiverId: '00000000-0000-4000-8000-000000000002', name: '測試小組', receiverName: '測試陪伴者' }];
function show(path='/', mode: 'personal' | 'work' = 'personal') { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><SupportPanel mode={mode} /></MemoryRouter></QueryClientProvider>); }
it('requires recipient consent, preserves failed input, and retries the same operation', async () => {
  const writes: Array<{path: string; body: unknown}> = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') { writes.push({ path, body: JSON.parse(init.body as string) }); return new Response(JSON.stringify({ error: '測試儲存失敗' }), { status: 503 }); }
    return new Response(JSON.stringify(path.endsWith('/targets') ? targets : { requests: [], hasMore: false }));
  }));
  show(); fireEvent.click(await screen.findByRole('button',{name:'尋求陪伴'}));
  await screen.findByRole('option',{name:'測試小組 · 測試陪伴者'});
  fireEvent.change(screen.getByLabelText('分享對象'),{ target:{ value:`group:${targets[0].id}:${targets[0].receiverId}` } });
  fireEvent.change(screen.getByLabelText('事項'),{ target:{value:'我想談談'} });
  fireEvent.change(screen.getByLabelText('希望得到的陪伴'),{ target:{value:'不公開的內容'} });
  expect(screen.getByRole('button',{name:'送出'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'送出'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('測試儲存失敗');
  expect(screen.getByLabelText('希望得到的陪伴')).toHaveValue('不公開的內容');
  fireEvent.click(screen.getByRole('button',{name:'送出'}));
  await waitFor(()=>expect(writes).toHaveLength(2));
  expect(writes[0]).toEqual(writes[1]);
});
it('shows a load failure instead of pretending there are no requests', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '讀取失敗' }),{status:503})));
  show();expect(await screen.findByRole('alert')).toHaveTextContent('讀取失敗');
  expect(screen.queryByText('目前沒有求助事項。')).toBeNull();
});
it('preserves the existing next action and date when updating only the status', async () => {
  const writes: unknown[]=[];
  vi.stubGlobal('fetch',vi.fn(async (path:string,init?:RequestInit) => {
    if(init?.method==='PATCH'){writes.push(JSON.parse(init.body as string));return new Response('{}');}
    return new Response(JSON.stringify(path.endsWith('/requests/fixture') ? {request:{id:'fixture',title:'需要陪伴',body:'事項',status:'accepted',version:2,isSender:false,nextAction:'週四聯絡',dueDate:'2026-09-17'},events:[]} : path.endsWith('/targets') ? [] : {requests:[],hasMore:false}));
  }));
  show('/?support=fixture','work');
  expect(await screen.findByLabelText('下一步或退回原因')).toHaveValue('週四聯絡');
  fireEvent.click(screen.getByRole('button',{name:'確認更新'}));
  await waitFor(()=>expect(writes).toEqual([{version:2,status:'accepted',nextAction:'週四聯絡',dueDate:'2026-09-17'}]));
});
it('opens the saved request without a false unsaved-change prompt',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>new Response(JSON.stringify(init?.method==='PUT'?{id:'saved'}:path.endsWith('/targets')?targets:path.endsWith('/requests/saved')?{request:{id:'saved',title:'我想談談',body:'事項',status:'open',version:1,isSender:true},events:[]}:{requests:[]}))));
  const router=createMemoryRouter([{path:'/support',element:<SupportPanel mode="personal"/>}],{initialEntries:['/support']});
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'尋求陪伴'}));await screen.findByRole('option',{name:'測試小組 · 測試陪伴者'});
  fireEvent.change(screen.getByLabelText('分享對象'),{target:{value:`group:${targets[0].id}:${targets[0].receiverId}`}});
  fireEvent.change(screen.getByLabelText('事項'),{target:{value:'我想談談'}});fireEvent.change(screen.getByLabelText('希望得到的陪伴'),{target:{value:'事項'}});
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'送出'}));
  expect(await screen.findByRole('heading',{name:'我想談談'})).toBeInTheDocument();expect(router.state.location.search).toContain('support=saved');
});
