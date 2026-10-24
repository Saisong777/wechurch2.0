import {useEffect} from 'react';
import {UnsavedChangesGuard} from '@/components/layout/UnsavedChangesGuard';
import type {AmbientRequest} from './castle/ambientFriends';
import {CastleWindowContext} from '@/contexts/CastleWindowContext';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider, Routes, Route } from 'react-router-dom';
import { CastleHome, type CastleHomeProps } from './CastleHome';

vi.mock('./castle/CastleScene', () => ({ default: function StubScene({ places, onSelect, insets, friendRequest, onFriendSelect,onFriendsReady }: { places: { id: string; name: string; label: string }[]; onSelect: (id: string) => void; insets?:{top:number;right:number;bottom:number};friendRequest?:AmbientRequest;onFriendSelect?:(id:string)=>void;onFriendsReady?:(ready:boolean)=>void }) {useEffect(()=>onFriendsReady?.(true),[onFriendsReady]);return <div data-testid="scene-insets" data-insets={JSON.stringify(insets)} data-friend={JSON.stringify(friendRequest)}>{places.map(place => <button key={place.id} onClick={() => onSelect(place.id)} aria-label={`${place.name}・${place.label}`}>{place.name}</button>)}<button type="button" onClick={()=>onFriendSelect?.('ambient-cat-1')}>點場景小貓</button></div>;} }));

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const defaults: CastleHomeProps = { churchName: 'iM 行動教會', featureEnabled: () => true, featuresLoading: false, scripture: { reference: '測試經文', state: 'ready' }, hasDraft: false, onOpenNote: vi.fn(), showAdmin: false, showPastoral: false };
const show = (props: Partial<CastleHomeProps> = {}) => render(<MemoryRouter><CastleHome {...defaults} {...props} /></MemoryRouter>);

describe('castle navigation', () => {
  it('keeps all seven existing destinations accessible without using the image', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '開啟城堡地點' }));
    const list = screen.getByRole('navigation', { name: '城堡所有地點' });
    const hrefs = within(list).getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(['/learn/church-reading', '/learn/bible', '/share', '/groups', '/grace-record?view=grace', '/walls', '/play']);
    expect(screen.queryByRole('link', { name: /牧養概況/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /主持與管理/ })).toBeNull();
  });

  it('hides disabled features from markers, details, and the alternative list', () => {
    const { container } = show({ featureEnabled: key => key !== 'we_play' && key !== 'we_learn' });
    expect(container.querySelector('a[href="/play"]')).toBeNull();
    expect(container.querySelector('a[href="/learn/church-reading"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /相聚小亭/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /同行主堡/ })).toBeNull();
    expect(screen.queryByText('今日讀經：測試經文')).toBeNull();
  });

  it('opens real content in one scene activation and pushes once per list link', async () => {
    const router=createMemoryRouter([{path:'*',element:<Routes><Route path="/" element={<CastleHome {...defaults}/>}/><Route path="/share" element={<p>禱告內容</p>}/><Route path="/learn/bible" element={<p>聖經內容</p>}/></Routes>}],{initialEntries:['/?mode=castle']});
    render(<RouterProvider router={router}/>);const transitions:string[]=[];const stop=router.subscribe(state=>transitions.push(state.location.pathname));
    fireEvent.click(await screen.findByRole('button',{name:'禱告花園・禱告'}));expect(await screen.findByText('禱告內容')).toBeTruthy();expect(transitions).toEqual(['/share']);
    await act(async()=>router.navigate(-1));transitions.length=0;fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));const list=screen.getByRole('navigation',{name:'城堡所有地點'});fireEvent.click(within(list).getByRole('link',{name:/話語之塔/}));expect(await screen.findByText('聖經內容')).toBeTruthy();expect(transitions).toEqual(['/learn/bible']);stop();
    expect(screen.queryByText(/禱告完成|靈修完成|積分|排行榜/)).toBeNull();
  });

  it('uses the original unsaved guard for direct building activation',async()=>{
    const router=createMemoryRouter([{path:'/',element:<><UnsavedChangesGuard dirty/><CastleHome {...defaults}/></>},{path:'/share',element:<p>已開啟禱告內容</p>}],{initialEntries:['/']});render(<RouterProvider router={router}/>);
    fireEvent.click(await screen.findByRole('button',{name:'禱告花園・禱告'}));expect(await screen.findByRole('alertdialog')).toBeTruthy();expect(router.state.location.pathname).toBe('/');fireEvent.click(screen.getByRole('button',{name:'繼續編輯'}));expect(screen.getByTestId('castle-home')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'禱告花園・禱告'}));fireEvent.click(await screen.findByRole('button',{name:'放棄修改並離開'}));expect(await screen.findByText('已開啟禱告內容')).toBeTruthy();
  });

  it.each(['loading', 'error', 'unpublished'] as const)('does not show fallback reading as published during %s', state => {
    show({ scripture: { reference: '不可顯示的備援經文', state } });
    expect(screen.queryByText(/不可顯示的備援經文/)).toBeNull();
    expect(screen.getByRole('link', { name: '前往每日靈修' })).toBeTruthy();
  });

  it('keeps the pavilion entry when one child activity is disabled', () => {
    const { container } = show({featureEnabled: key => key !== 'disciple_quiz'});
    expect(container.querySelector('a[href="/play/disciple-quiz"]')).toBeNull();
    expect(screen.getByRole('button', {name: /相聚小亭/})).toBeTruthy();
  });

  it('supports night mode, motion pause, and unsynced drafts', () => {
    const openNote = vi.fn();
    const { container } = show({ hasDraft: true, onOpenNote: openNote, showAdmin: true, showPastoral: true });
    fireEvent.click(screen.getByRole('button', { name: '切換夜間景色' }));
    expect(container.querySelector('.castle-home--night')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '暫停地圖動態' }));
    expect(container.querySelector('.castle-home--paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '開啟草稿' }));
    expect(openNote).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '開啟城堡選單' }));
    expect(screen.getByRole('link', { name: '牧養概況' }).getAttribute('href')).toBe('/work');
    expect(screen.getByRole('link', { name: '主持與管理' }).getAttribute('href')).toBe('/admin');
  });
  it('opens portrait place list only on demand and returns focus to the visible exploration trigger',async()=>{
    vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);show();
    expect(screen.queryByRole('region',{name:'目前選擇的地點'})).toBeNull();expect(screen.getByRole('link',{name:'登入加入'}).getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('button',{name:'切換夜間景色'})).toBeNull();fireEvent.click(await screen.findByRole('button',{name:'禱告花園・禱告'}));expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('closed');fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));expect(screen.getByRole('link',{name:'前往禱告'}).getAttribute('href')).toBe('/share');
    fireEvent.keyDown(document,{key:'Escape'});expect(document.activeElement).toBe(screen.getByRole('button',{name:'開啟城堡地點'}));expect(screen.queryByRole('region',{name:'目前選擇的地點'})).toBeNull();
  });
  it('surfaces an important notice badge and keeps retry, draft, mode and account controls in one mobile sheet',()=>{
    vi.stubGlobal('innerWidth',320);vi.stubGlobal('innerHeight',568);const retry=vi.fn(),draft=vi.fn();const{container}=show({hasDraft:true,onOpenNote:draft,notices:<div role="alert">筆記暫時無法載入<button onClick={retry}>重試筆記</button></div>,modeControls:<button>傳統模式</button>,accountControls:<button>帳號設定</button>});
    const trigger=screen.getByRole('button',{name:'開啟城堡選單'});expect(trigger.getAttribute('aria-describedby')).toBeTruthy();expect(screen.queryByRole('button',{name:'重試筆記'})).toBeNull();
    fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'重試筆記'}));fireEvent.click(screen.getByRole('button',{name:'開啟草稿'}));expect(retry).toHaveBeenCalledOnce();expect(draft).toHaveBeenCalledOnce();expect(screen.getAllByRole('button',{name:'傳統模式'})).toHaveLength(1);expect(screen.getAllByRole('button',{name:'帳號設定'})).toHaveLength(1);expect(container.querySelectorAll('.castle-presence')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'切換夜間景色'}));expect(container.querySelector('.castle-home--night')).toBeTruthy();fireEvent.keyDown(document,{key:'Escape'});expect(document.activeElement).toBe(trigger);
  });
  it('moves preference controls back to the desktop header without duplicating them after orientation changes',()=>{
    vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);const{container}=show({modeControls:<button>傳統模式</button>});expect(screen.queryByRole('button',{name:'傳統模式'})).toBeNull();vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);fireEvent(window,new Event('resize'));expect(screen.getAllByRole('button',{name:'傳統模式'})).toHaveLength(1);expect(container.querySelectorAll('.castle-presence')).toHaveLength(1);expect(screen.getByTestId('castle-home').dataset.castlePortrait).toBe('false');
  });

  it('announces notices that change inside an existing text node',async()=>{
    vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);const view=show({notices:<div role="alert"> </div>});const menu=screen.getByRole('button',{name:'開啟城堡選單'});expect(menu.hasAttribute('aria-describedby')).toBe(false);
    view.rerender(<MemoryRouter><CastleHome {...defaults} notices={<div role="alert">筆記載入失敗，請開選單重試</div>}/></MemoryRouter>);await waitFor(()=>expect(menu.hasAttribute('aria-describedby')).toBe(true));fireEvent.click(menu);expect(screen.getByRole('alert').textContent).toContain('筆記載入失敗');
  });

  it('resets drawer scroll only when switching panels, and does not consume Escape behind a feature window',()=>{
    const view=show();fireEvent.click(screen.getByRole('button',{name:'開啟城堡選單'}));const scroll=document.querySelector<HTMLElement>('.castle-drawer-scroll')!;scroll.scrollTop=450;fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));expect(scroll.scrollTop).toBe(0);scroll.scrollTop=120;
    view.rerender(<MemoryRouter><CastleWindowContext.Provider value><CastleHome {...defaults}/></CastleWindowContext.Provider></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('places');
  });

  it.each([[1280,720],[390,844],[320,568],[844,390],[640,360]])('keeps a direct mailbox entry outside the menu at %sx%s',async(width,height)=>{
    vi.stubGlobal('innerWidth',width);vi.stubGlobal('innerHeight',height);const router=createMemoryRouter([{path:'/',element:<CastleHome {...defaults}/>},{path:'/feedback',element:<p>私人信箱內容</p>}],{initialEntries:['/?mode=castle']});render(<RouterProvider router={router}/>);
    const entry=screen.getByRole('link',{name:'城堡信箱・意見與建議'});expect(entry).toBeVisible();expect(entry).toHaveAttribute('href','/feedback');expect(screen.queryByRole('navigation',{name:'我的日常與管理'})).toBeNull();fireEvent.click(entry);expect(await screen.findByText('私人信箱內容')).toBeTruthy();expect(router.state.location.state).toMatchObject({from:'/'});
  });

  it('measures the real mailbox bottom after a wrapped portrait brand and keeps one entry through orientation changes',async()=>{
    vi.stubGlobal('innerWidth',320);vi.stubGlobal('innerHeight',568);let brandBottom=95,mailBottom=150,notifyResize=()=>{};const observe=vi.fn();
    vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){notifyResize=()=>callback([],this as unknown as ResizeObserver);}observe=observe;disconnect(){} });
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const bottom=this.classList.contains('castle-topbar')?brandBottom:this.classList.contains('castle-mailbox-launch')?mailBottom:0;return {x:0,y:0,top:0,left:0,right:230,width:230,height:bottom,bottom,toJSON:()=>({})} as DOMRect;});
    const view=show({churchName:'一個需要換行的很長教會名稱與同行的家人',preview:true});const entry=screen.getByRole('link',{name:'城堡信箱・意見與建議'});expect(entry.parentElement).toHaveClass('castle-topbar');expect(entry.previousElementSibling).toHaveClass('castle-brand');expect(entry.closest('.castle-hud-actions')).toBeNull();expect(observe).toHaveBeenCalledWith(entry);
    const insets=()=>JSON.parse(screen.getByTestId('scene-insets').dataset.insets||'{}');await waitFor(()=>expect(insets().top).toBe(160));
    brandBottom=143;mailBottom=201;view.rerender(<MemoryRouter><CastleHome {...defaults} churchName="品牌與預覽標示換行之後仍需要安全空間的教會名稱" preview/></MemoryRouter>);act(()=>notifyResize());expect(insets().top).toBe(211);
    vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);brandBottom=80;fireEvent(window,new Event('resize'));expect(insets().top).toBe(90);const desktopEntry=screen.getByRole('link',{name:'城堡信箱・意見與建議'});expect(desktopEntry.closest('.castle-hud-actions')).toBeTruthy();expect(screen.getAllByRole('link',{name:'城堡信箱・意見與建議'})).toHaveLength(1);
  });

  it.each([[320,568],[390,844],[640,360],[641,360],[1280,720]])('uses the friends drawer only to choose a real scene actor at %sx%s, then returns to the world',async(width,height)=>{
    vi.stubGlobal('innerWidth',width);vi.stubGlobal('innerHeight',height);show();const launch=screen.getByRole('button',{name:'開啟城堡朋友'});fireEvent.click(launch);
    const list=screen.getByRole('list',{name:'所有場景朋友'});expect(within(list).getAllByRole('button')).toHaveLength(13);const scroll=list.closest('.castle-drawer-scroll') as HTMLElement;scroll.scrollTop=800;
    fireEvent.click(within(list).getByRole('button',{name:/豆豆小狗/}));await screen.findByTestId('scene-insets');expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('closed');expect(screen.queryByRole('list',{name:'所有場景朋友'})).toBeNull();expect(screen.queryByRole('heading',{name:'豆豆小狗'})).toBeNull();expect(JSON.parse(screen.getByTestId('scene-insets').dataset.friend||'{}')).toMatchObject({id:'ambient-dog-6',action:'hello',sequence:1});
    fireEvent.click(launch);expect(screen.getByRole('button',{name:'收合城堡面板'})).toHaveFocus();fireEvent.keyDown(document,{key:'Escape'});expect(launch).toHaveFocus();
    fireEvent.click(launch);fireEvent.click(screen.getByRole('button',{name:/豆豆小狗/}));expect(JSON.parse(screen.getByTestId('scene-insets').dataset.friend||'{}')).toMatchObject({id:'ambient-dog-6',sequence:2});expect(screen.queryByRole('button',{name:'聊兩句'})).toBeNull();
  });
  it('a mesh encounter keeps the drawer closed and does not issue a second scene request or navigate',async()=>{
    show();fireEvent.click(await screen.findByRole('button',{name:'點場景小貓'}));expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('closed');expect(screen.getByTestId('scene-insets').dataset.friend).toBeUndefined();expect(screen.getByTestId('castle-home')).toBeTruthy();expect(screen.queryByRole('heading',{name:'餅乾小貓'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));fireEvent.click(screen.getByRole('button',{name:'點場景小貓'}));expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('closed');
  });

  it('measures a short landscape friends drawer as a right sidebar while other small-screen panels keep their bottom insets',async()=>{
    vi.stubGlobal('innerWidth',640);vi.stubGlobal('innerHeight',360);let drawerLeft=300;
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const isDrawer=this.classList.contains('castle-drawer'),height=isDrawer?196:80,left=isDrawer?drawerLeft:10;return {x:left,y:0,top:0,left,right:left+330,width:330,height,bottom:height,toJSON:()=>({})} as DOMRect;});
    show();fireEvent.click(screen.getByRole('button',{name:'開啟城堡朋友'}));await screen.findByTestId('scene-insets');const insets=()=>JSON.parse(screen.getByTestId('scene-insets').dataset.insets||'{}');expect(insets()).toMatchObject({right:350,bottom:0});
    drawerLeft=266;fireEvent(window,new Event('resize'));expect(insets().right).toBe(384);fireEvent.click(screen.getByRole('button',{name:'開啟城堡地點'}));expect(insets()).toMatchObject({right:0,bottom:216});fireEvent.click(screen.getByRole('button',{name:'開啟城堡選單'}));expect(insets()).toMatchObject({right:0,bottom:216});
    fireEvent.click(screen.getByRole('button',{name:'開啟城堡朋友'}));vi.stubGlobal('innerWidth',320);vi.stubGlobal('innerHeight',568);fireEvent(window,new Event('resize'));expect(insets()).toMatchObject({right:64,bottom:216});
    vi.stubGlobal('innerWidth',641);vi.stubGlobal('innerHeight',360);fireEvent(window,new Event('resize'));expect(insets()).toMatchObject({right:358,bottom:0});
  });

  it('does not consume foreground Escape or clear a pending actor selection',async()=>{
    const content=(active:boolean)=><MemoryRouter><CastleWindowContext.Provider value={active}><CastleHome {...defaults}/></CastleWindowContext.Provider></MemoryRouter>;const view=render(content(false));fireEvent.click(screen.getByRole('button',{name:'開啟城堡朋友'}));fireEvent.click(screen.getByRole('button',{name:/餅乾小貓/}));await screen.findByTestId('scene-insets');const request=screen.getByTestId('scene-insets').dataset.friend;
    view.rerender(content(true));fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByTestId('castle-home').dataset.castlePanel).toBe('closed');expect(screen.getByTestId('scene-insets').dataset.friend).toBe(request);
  });
});
