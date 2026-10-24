// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {Header} from './Header';
import {MobileHeaderContext} from './MobileHeaderContext';
import {CastleContentPresentationContext} from '@/contexts/CastleContentPresentationContext';
const calls=vi.hoisted(()=>({auth:vi.fn(()=>({user:null,loading:false,signOut:vi.fn()}))}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:calls.auth}));
vi.mock('@/hooks/useUserProfile',()=>({useUserProfile:()=>({profile:null})}));
vi.mock('@/hooks/useUserRole',()=>({useUserRole:()=>({isAdmin:false,isLeader:false})}));
vi.mock('@/hooks/useAccessControl',()=>({useAccessControl:()=>({data:undefined})}));
vi.mock('@/components/user/ProfileSettingsDialog',()=>({ProfileSettingsDialog:()=>null}));
vi.mock('@/components/theme/AppearanceControl',()=>({AppearanceControl:()=> <button>外觀設定</button>}));
vi.mock('@/components/notifications/NotificationBell',()=>({NotificationBell:()=> <button>通知</button>}));
vi.mock('@/components/scripture/ReadingNavigation',()=>({ReadingNavigation:()=> <nav aria-label="讀經與靈修">三個讀經入口</nav>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps business actions once in foreground content and suppresses only the conventional header',()=>{
 const search=vi.fn(),font=vi.fn(),portal=document.createElement('div');document.body.append(portal);
 render(<MemoryRouter initialEntries={['/learn/bible']}><MobileHeaderContext.Provider value={{actionsTarget:portal,setActionsTarget:vi.fn()}}><CastleContentPresentationContext.Provider value><Header title="聖經" backTo="/" rightContent={<><button onClick={search}>搜尋經文</button><button onClick={font}>A+</button></>}/></CastleContentPresentationContext.Provider></MobileHeaderContext.Provider></MemoryRouter>);
 const tools=screen.getByRole('toolbar',{name:'內容工具'});fireEvent.click(within(tools).getByRole('button',{name:'搜尋經文'}));fireEvent.click(within(tools).getByRole('button',{name:'A+'}));expect(search).toHaveBeenCalledOnce();expect(font).toHaveBeenCalledOnce();expect(portal.childElementCount).toBe(0);expect(calls.auth).not.toHaveBeenCalled();
 expect(screen.queryByTestId('page-header')).toBeNull();expect(screen.queryByTestId('nav-top')).toBeNull();expect(screen.queryByRole('navigation',{name:'讀經與靈修'})).toBeNull();expect(screen.queryByRole('button',{name:'返回上一頁'})).toBeNull();expect(screen.queryByRole('button',{name:'登入'})).toBeNull();expect(screen.queryByRole('button',{name:'外觀設定'})).toBeNull();portal.remove();
});
it('has no empty content header and leaves the background and restored traditional header intact',()=>{
 const view=render(<MemoryRouter initialEntries={['/learn/bible']}><Header title="背景頁"/><CastleContentPresentationContext.Provider value><Header title="前景頁"/></CastleContentPresentationContext.Provider></MemoryRouter>);
 expect(screen.getAllByTestId('page-header')).toHaveLength(1);expect(screen.queryByText('前景頁')).toBeNull();expect(screen.getByRole('navigation',{name:'讀經與靈修'})).toBeTruthy();
 view.rerender(<MemoryRouter initialEntries={['/learn/bible']}><CastleContentPresentationContext.Provider value={false}><Header title="聖經" backTo="/" rightContent={<button>字級</button>}/></CastleContentPresentationContext.Provider></MemoryRouter>);
 expect(screen.getByTestId('nav-top')).toBeTruthy();expect(screen.getByRole('button',{name:'外觀設定'})).toBeTruthy();expect(screen.getByRole('button',{name:'登入'})).toBeTruthy();expect(screen.getAllByRole('button',{name:'返回上一頁'})).toHaveLength(2);expect(screen.getByRole('button',{name:'字級'})).toBeTruthy();
});
