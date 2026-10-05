// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FamilyManagement } from './FamilyManagement';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'leader' } }) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function show() {
  const group = {id:'family',name:'同行小家',church:'IM 行動教會',audience:'couples',listed:true,status:'active',version:1,description:'',meeting:'',announcement:'',leaderId:null,memberCount:1,pendingRequestCount:1};
  vi.stubGlobal('fetch', vi.fn(async (input: string) => ({ok:true,json:async () => input.endsWith('/management') ? {groups:[group],requests:[],churches:[{id:'IM 行動教會',name:'iM行動教會'}]} : {members:[],requests:[{id:'member',name:'申請人',message:'希望週五參加'}],history:[],canChangeLeader:true}})));
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}}); clients.push(client);
  render(<MemoryRouter><QueryClientProvider client={client}><FamilyManagement /></QueryClientProvider></MemoryRouter>);
}
it('surfaces pending applications and submits explicit approval', async () => {
  show();
  fireEvent.click(await screen.findByRole('button',{name:'同行小家 · 1 位申請人'}));
  await screen.findByText('希望週五參加');
  fireEvent.click(screen.getByRole('button',{name:'同意加入'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/management/family/requests/member',expect.objectContaining({method:'POST',body:JSON.stringify({approve:true})})));
});
it('creates categorized, publicly listed families and allows explicit unlisting', async () => {
  show();
  await screen.findByText('開啟新小家');
  fireEvent.click(screen.getByText('開啟新小家'));
  expect(screen.getByRole('checkbox',{name:'公開簡介，開放申請加入'})).toBeChecked();
  fireEvent.change(screen.getByRole('textbox',{name:'小家名稱'}),{target:{value:'姊妹小家'}});
  fireEvent.change(screen.getByRole('combobox',{name:'小家類型'}),{target:{value:'women'}});
  fireEvent.click(screen.getByRole('button',{name:'建立小家'}));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/life-groups/management',expect.objectContaining({method:'POST',body:JSON.stringify({name:'姊妹小家',church:'IM 行動教會',audience:'women',listed:true})})));
});

const primaryId='f7d374ba-3e98-43b0-9e45-6e74591442ab', secondId='eec8d8fc-1ba9-44e1-927f-6e376db84c43', thirdId='dc4e51b7-6d57-46d8-aed5-4c13da190095';
function showLeaders(coLeaderId: string | null=null, canChangeLeader=true, leaderId: string | null=primaryId) {
  const group={id:'family',name:'共同負責小家',church:'IM 行動教會',audience:'couples',listed:true,status:'active',version:5,description:'來源名單尚未登入者留在簡介核對',meeting:'',announcement:'',leaderId,coLeaderId,leaderName:leaderId?'領袖甲':null,coLeaderName:coLeaderId?'領袖乙':null,memberCount:3,pendingRequestCount:0,canManage:true};
  const members=[{id:primaryId,name:'領袖甲',manager:!!leaderId},{id:secondId,name:'領袖乙',manager:!!coLeaderId},{id:thirdId,name:'成員丙',manager:false}];
  const fetch=vi.fn(async(input:string,_options?:RequestInit)=>({ok:true,json:async()=>input.endsWith('/management')?{groups:[group],requests:[],churches:[]}:{members,requests:[],history:[],canChangeLeader}}));vi.stubGlobal('fetch',fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<MemoryRouter><QueryClientProvider client={client}><FamilyManagement initialGroup="family"/></QueryClientProvider></MemoryRouter>);return fetch;
}
it('offers two equal leadership slots with distinct current members and explicit versioned handover',async()=>{const fetch=showLeaders();vi.spyOn(window,'confirm').mockReturnValue(true);const first=await screen.findByRole('combobox',{name:'小家長（一）'});const second=screen.getByRole('combobox',{name:'小家長（二）'});expect(first).toHaveValue(primaryId);expect(within(second).queryByRole('option',{name:'領袖甲'})).toBeNull();fireEvent.change(second,{target:{value:secondId}});expect(within(first).queryByRole('option',{name:'領袖乙'})).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('領袖甲、領袖乙');fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));const patch=fetch.mock.calls.find(([,options])=>options?.method==='PATCH')!;expect(JSON.parse(patch[1]!.body as string)).toMatchObject({version:5,leaderId:primaryId,coLeaderId:secondId});expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('兩位小家長有相同的小家管理權'));expect(screen.queryByText(/副小家長|主要小家長/)).toBeNull();});
it('preserves both current leaders on unrelated settings and displays both as small-group leaders',async()=>{const fetch=showLeaders(secondId);await screen.findByRole('combobox',{name:'小家長（二）'});expect(screen.getByText('小家長：領袖甲、領袖乙')).toBeVisible();expect(screen.getByText('領袖甲 · 小家長')).toBeVisible();expect(screen.getByText('領袖乙 · 小家長')).toBeVisible();fireEvent.change(screen.getByRole('textbox',{name:'小家簡介（公開）'}),{target:{value:'更新聚會說明'}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:secondId,description:'更新聚會說明'});});
it('cancels a leadership handover without any mutation',async()=>{const fetch=showLeaders(secondId);vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.change(await screen.findByRole('combobox',{name:'小家長（二）'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));expect(window.confirm).toHaveBeenCalled();expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(false);expect(screen.getByRole('combobox',{name:'小家長（二）'})).toHaveValue('');});
it('allows an explicit null second slot instead of silently keeping or replacing it',async()=>{const fetch=showLeaders(secondId);vi.spyOn(window,'confirm').mockReturnValue(true);fireEvent.change(await screen.findByRole('combobox',{name:'小家長（二）'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:null});});
it('keeps both assignments unchanged when the server does not permit leadership changes',async()=>{const fetch=showLeaders(secondId,false);await screen.findByText('領袖甲 · 小家長');expect(screen.queryByRole('combobox',{name:'小家長（一）'})).toBeNull();expect(screen.queryByRole('combobox',{name:'小家長（二）'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'儲存小家設定'}));await waitFor(()=>expect(fetch.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(true));expect(JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='PATCH')![1]!.body as string)).toMatchObject({leaderId:primaryId,coLeaderId:secondId});});

it('preserves two unassigned slots and the source description until a real member is assigned', async () => {
  const fetch = showLeaders(null, true, null);
  await screen.findByRole('combobox', { name: '小家長（一）' });
  expect(screen.getByRole('combobox', { name: '小家長（一）' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: '小家長（二）' })).toHaveValue('');
  expect(screen.getByText('小家長：尚未指派')).toBeVisible();
  expect(screen.getByRole('textbox', { name: '小家簡介（公開）' })).toHaveValue('來源名單尚未登入者留在簡介核對');
  fireEvent.click(screen.getByRole('button', { name: '儲存小家設定' }));
  await waitFor(() => expect(fetch.mock.calls.some(([,options]) => options?.method === 'PATCH')).toBe(true));
  expect(JSON.parse(fetch.mock.calls.find(([,options]) => options?.method === 'PATCH')![1]!.body as string)).toMatchObject({leaderId:null, coLeaderId:null});
});
