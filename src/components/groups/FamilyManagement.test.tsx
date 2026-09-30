// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FamilyManagement } from './FamilyManagement';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'leader' } }) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); });
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
