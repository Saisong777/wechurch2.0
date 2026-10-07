// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { afterEach } from 'vitest';
const state=vi.hoisted(()=>({auth:{user:{id:'new-member'} as {id:string}|null,loading:false},church:{loading:false,error:''},onboarding:{isPending:false,isError:false,data:{canChoose:true,reason:'choose'} as {canChoose:boolean;reason:string}|undefined}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>state.auth}));
vi.mock('@/hooks/useChurchOnboarding',()=>({useChurchOnboarding:()=>state.onboarding}));
vi.mock('@/contexts/ChurchContext',()=>({useChurchContext:()=>state.church,ChurchPageBoundary:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('@/components/onboarding/FirstChurchChoice',()=>({FirstChurchChoice:()=> <p>選擇或重新確認教會</p>}));
vi.mock('@/components/onboarding/IntroductionTour',()=>({IntroductionTour:()=> <p>新手導覽</p>}));
vi.mock('./ChurchControl',()=>({ChurchControl:()=> <p>切換教會</p>}));
vi.mock('./NetworkStatusBanner',()=>({NetworkStatusBanner:()=>null}));
vi.mock('./MobileNavigation',()=>({MobileNavigation:()=> <p>主選單</p>}));
vi.mock('./ReadingScrollRestoration',()=>({ReadingScrollRestoration:()=>null}));
const mount= (path='/') => render(<MemoryRouter initialEntries={[path]}><AppLayout><p>實際頁面</p></AppLayout></MemoryRouter>);
beforeEach(()=>{state.auth={user:{id:'new-member'},loading:false};state.church={loading:false,error:''};state.onboarding={isPending:false,isError:false,data:{canChoose:true,reason:'choose'}};});
afterEach(cleanup);
it.each(['/','/learn/my-notes','/groups/synthetic-group','/admin','/learn/bible','/login'])('blocks an authenticated unconfirmed deep link %s',path=>{
 mount(path);expect(screen.getByText('選擇或重新確認教會')).toBeVisible();for(const text of ['實際頁面','主選單','切換教會','新手導覽'])expect(screen.queryByText(text)).toBeNull();
});
it.each(['auth','church','query','error','missing','context-error'])('does not mount children during %s uncertainty',kind=>{
 if(kind==='auth'){state.auth.user=null;state.auth.loading=true;}
 if(kind==='church')state.church.loading=true;
 if(kind==='query')state.onboarding.isPending=true;
 if(kind==='error')state.onboarding.isError=true;
 if(kind==='missing')state.onboarding.data=undefined;
 if(kind==='context-error')state.church.error='暫時失敗';
 mount();expect(screen.queryByText('實際頁面')).toBeNull();
});
it.each(['assigned','no_church','manager_required'])('releases confirmed or historical %s accounts without another selection',reason=>{
 state.onboarding.data={canChoose:false,reason};mount('/learn/my-notes');expect(screen.getByText('實際頁面')).toBeVisible();
});
it('preserves public access for an anonymous visitor',()=>{state.auth.user=null;state.onboarding.isPending=true;mount('/learn/bible');expect(screen.getByText('實際頁面')).toBeVisible();});
