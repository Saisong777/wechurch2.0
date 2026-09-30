// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LeaderDashboard } from './LeaderDashboard';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'leader'}})}));
const group='00000000-0000-4000-8000-000000000001';
const meeting='00000000-0000-4000-8000-000000000002';
const counts={present:0,excused:0,absent:0,unrecorded:2};
const gathering={id:meeting,groupId:group,groupName:'恩典小家',date:'2026-09-28',kind:'group',cancelled:false,visitors:0,version:1,counts};
let overview:Record<string,unknown>;let failing=false;let saved:Record<string,unknown>|undefined;let client:QueryClient;
beforeEach(()=>{
  failing=false;saved=undefined;
  overview={groups:[{id:group,name:'恩典小家',church:'IM 行動教會',sharedReadable:true}],scope:'all',today:'2026-09-28',since:'2026-09-22',updatedAt:'2026-09-28T10:00:00Z',care:{active:1,due:1,unassigned:0,items:[{id:'care',groupId:group,groupName:'恩典小家',name:'小明',status:'following',dueDate:'2026-09-28',responsibleName:'領袖',nextAction:'關心工作近況'}]},prayers:{recent:0,items:[]},gatherings:[gathering],groupsWithoutGathering:0};
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    let body:unknown=overview;
    if(init?.method==='PATCH'){saved=JSON.parse(init.body as string);body={ok:true,version:2};}
    else if(input.includes(`/gatherings/${meeting}`))body={...gathering,entries:[{key:'user:one',name:'小明',status:'unrecorded'},{key:'user:two',name:'小美',status:'unrecorded'}]};
    else if(input.includes('/gatherings?'))body={total:1,items:[gathering]};
    if(failing)body={error:'無法讀取，請重試'};
    return {ok:!failing,json:async()=>body};
  }));
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
});
afterEach(()=>{cleanup();client.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
function show(){render(<QueryClientProvider client={client}><MemoryRouter><LeaderDashboard/></MemoryRouter></QueryClientProvider>);}
it('links care reminders straight to the original shared case and separates unrecorded attendance',async()=>{
  show();expect(await screen.findByRole('heading',{name:'牧養概況'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'記錄關心'})).toHaveAttribute('href',`/groups/${group}?view=care&focus=care`);
  expect(screen.getByText('2 人尚未填寫出席')).toBeTruthy();
  expect(screen.queryByText(/出席率/)).toBeNull();
});
it('shows a data error rather than a zero statistic and removes cached details after loss of access',async()=>{
  show();await screen.findByText('小明');failing=true;
  fireEvent.click(screen.getByRole('button',{name:'重新整理牧養概況'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('無法讀取');
  expect(screen.queryByText('小明')).toBeNull();
});
it('saves selected presence while preserving untouched people as unrecorded',async()=>{
  show();fireEvent.click(await screen.findByRole('button',{name:'補記錄'}));
  await screen.findByRole('heading',{name:'記錄聚會出席'});
  const statuses=await screen.findAllByRole('button',{name:'出席'});fireEvent.click(statuses[0]);
  fireEvent.click(screen.getByRole('button',{name:'儲存出席'}));
  await waitFor(()=>expect(saved).toBeDefined());
  expect(saved?.entries).toEqual([{key:'user:one',status:'present'},{key:'user:two',status:'unrecorded'}]);
  expect(saved?.version).toBe(1);
});
it('does not present lack of shared permission as zero activity',async()=>{
  (overview.groups as {sharedReadable:boolean}[])[0].sharedReadable=false;
  overview.care={active:0,due:0,unassigned:0,items:[]};show();
  expect(await screen.findByText('尚無可閱讀的共同關懷範圍')).toBeTruthy();
  expect(screen.queryByText('0 件已到提醒日 · 0 件待認領')).toBeNull();
});
it('keeps attendance draft through a background request failure',async()=>{
  show();fireEvent.click(await screen.findByRole('button',{name:'補記錄'}));
  const statuses=await screen.findAllByRole('button',{name:'出席'});fireEvent.click(statuses[0]);
  failing=true;await client.invalidateQueries({queryKey:['/api/life-groups']});
  expect(await screen.findByRole('alert')).toHaveTextContent('無法讀取');
  failing=false;fireEvent.click(screen.getByRole('button',{name:'重新載入'}));
  const restored=await screen.findAllByRole('button',{name:'出席'});
  expect(restored[0]).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'儲存出席'}));await waitFor(()=>expect(saved).toBeDefined());
  expect(saved?.entries).toEqual([{key:'user:one',status:'present'},{key:'user:two',status:'unrecorded'}]);
});
