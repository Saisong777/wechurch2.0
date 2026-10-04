// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FeedbackAdminPage from './FeedbackAdminPage';
const auth=vi.hoisted(()=>({user:{id:'manager'} as {id:string}|null,loading:false}));
const role=vi.hoisted(()=>({isAdmin:true,loading:false}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/hooks/useUserRole',()=>({useUserRole:()=>role}));
vi.mock('@/components/layout/Header',()=>({Header:()=>null}));
let client:QueryClient;
const item={id:'f2f5f9a9-9889-4911-a8d7-8aa07e7ccfc0',category:'bug',title:'讀經出現問題',body:'原始問題：讀經完成後無法開啟我的筆記。',location:'/learn/church-reading',urgency:'blocked',status:'new',priority:'P2',publicReply:'',version:7,createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z',analysisStatus:'ready',analysis:{summary:'無法開啟筆記。',category:'bug',urgency:'high',importance:'medium',reason:'影響讀經後的記錄。',tags:[],nextAction:'確認筆記入口。',suggestedPriority:'P1',evidence:['無法開啟我的筆記']}};
beforeEach(()=>{auth.user={id:'manager'};role.isAdmin=true;client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});});
afterEach(()=>{cleanup();client.clear();vi.unstubAllGlobals();vi.restoreAllMocks();});
function mount(){render(<QueryClientProvider client={client}><MemoryRouter><FeedbackAdminPage/></MemoryRouter></QueryClientProvider>);}
it('does not request private feedback for a non-manager',()=>{role.isAdmin=false;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);mount();expect(screen.getByRole('alert')).toHaveTextContent('僅限系統管理員與主任牧師');expect(fetch).not.toHaveBeenCalled();});
it('keeps original feedback and AI suggestions separate and saves a versioned human decision',async()=>{const fetch=vi.fn(async(url:string,opts?:RequestInit)=>({ok:true,json:async()=>opts?.method==='PATCH'?{feedback:{...item,...JSON.parse(opts.body as string),version:8}}:url.endsWith('/history')?{items:[]}:{items:[item],hasMore:false}}));vi.stubGlobal('fetch',fetch);mount();fireEvent.click(await screen.findByRole('button',{name:/讀經出現問題/}));expect(screen.getByText(item.body)).toBeVisible();expect(screen.getByText('無法開啟筆記。')).toBeVisible();expect(screen.getByLabelText('人工優先順序')).toHaveValue('P2');fireEvent.change(screen.getByLabelText('人工優先順序'),{target:{value:'P1'}});fireEvent.change(screen.getByLabelText('給這位會友的回覆'),{target:{value:'我們已開始確認，謝謝你。'}});fireEvent.click(screen.getByRole('button',{name:'儲存安排與回覆'}));await screen.findByText(/已更新。AI 分析/);const patch=fetch.mock.calls.find(([,o])=>o?.method==='PATCH');expect(JSON.parse(patch![1]!.body as string)).toEqual({version:7,status:'new',priority:'P1',publicReply:'我們已開始確認，謝謝你。'});expect(fetch.mock.calls[0][0]).not.toContain('status=');expect(fetch.mock.calls[0][0]).not.toContain('priority=');});
it('does not claim success when a stale human update is rejected',async()=>{vi.stubGlobal('fetch',vi.fn(async(url:string,opts?:RequestInit)=>({ok:opts?.method!=='PATCH',status:409,text:async()=>'{"error":"stale"}',json:async()=>url.endsWith('/history')?{items:[]}:{items:[item],hasMore:false}})));mount();fireEvent.click(await screen.findByRole('button',{name:/讀經出現問題/}));fireEvent.click(screen.getByRole('button',{name:'儲存安排與回覆'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('先更新列表'));expect(screen.queryByText(/已更新。AI 分析/)).toBeNull();});
