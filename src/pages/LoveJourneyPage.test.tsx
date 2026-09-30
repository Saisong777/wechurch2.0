// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoveJourneyPage from './LoveJourneyPage';
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: notices }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'learner' } }) }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({children}:{children:React.ReactNode}) => children }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}><MemoryRouter><LoveJourneyPage /></MemoryRouter></QueryClientProvider>); return client; }
function data() { return { schemaReady: true, person:{id:'person'},loveJourney:{id:'journey',name:'愛的旅程',status:'active',progress:[{id:'day',dayNumber:1,title:'同行',status:'in_progress',responseText:'原本內容',version:2,visibility:'private'}] } }; }
it('does not announce success before the server confirms and sends the version and consent', async () => {
  let confirm!: (r: Response) => void;
  let saved: Record<string, unknown> | undefined;
  vi.stubGlobal('fetch',vi.fn(async (_path:string, init?:RequestInit) => {
    if (init?.method==='PATCH') { saved=JSON.parse(init.body as string); return new Promise<Response>(resolve=>{confirm=resolve;}); }
    return new Response(JSON.stringify(data()));
  }));
  show();const input=await screen.findByPlaceholderText('寫下今天的回應');
  fireEvent.change(input,{target:{value:'新的回應'}});
  fireEvent.click(screen.getByRole('button',{name:'保存回應'}));
  await waitFor(()=>expect(saved).toBeDefined());expect(notices.success).not.toHaveBeenCalled();
  expect(saved).toMatchObject({ version:2, responseText:'新的回應', visibility:'private' });
  confirm(new Response(JSON.stringify({ id:'day',version:3 })));
  await waitFor(()=>expect(notices.success).toHaveBeenCalledWith('回應已保存'));
});
it('keeps the response after a rejected save', async () => {
  vi.stubGlobal('fetch',vi.fn(async (_path:string, init?:RequestInit) => init?.method==='PATCH' ? new Response('conflict',{status:409}) : new Response(JSON.stringify(data()))));
  show();const input=await screen.findByPlaceholderText('寫下今天的回應');fireEvent.change(input,{target:{value:'保留這一段'}});
  fireEvent.click(screen.getByRole('button',{name:'保存回應'}));
  await waitFor(()=>expect(notices.error).toHaveBeenCalled());expect(input).toHaveValue('保留這一段');expect(notices.success).not.toHaveBeenCalled();
});
it('does not silently transfer an unsaved sharing choice to a new mentor',async()=>{
  let mentorId='first';let writes=0;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(init?.method==='PATCH'){writes++;return new Response('{}');}
    return new Response(JSON.stringify(path.startsWith('/api/mentoring')?{contracts:[{id:mentorId,status:'active',mentorName:mentorId}]}:data()));
  }));
  const client=show();await screen.findByText('目前已確認的陪伴者：first');
  fireEvent.change(screen.getByLabelText('回答分享範圍 · 第 1 天'),{target:{value:'mentor'}});
  mentorId='second';await act(async()=>{await client.invalidateQueries({queryKey:['/api/mentoring']});});
  await screen.findByText('陪伴者已變更，請先選「只有自己」，再確認新的分享對象。');
  fireEvent.click(screen.getByRole('button',{name:'保存回應'}));
  await waitFor(()=>expect(notices.error).toHaveBeenCalled());expect(writes).toBe(0);
});
