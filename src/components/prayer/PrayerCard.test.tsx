// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrayerCard } from './PrayerCard';
import type { Prayer } from '@/hooks/usePrayerWall';

const state = vi.hoisted(() => ({ admin:false, mutate:vi.fn(), busy:false, mobile:true }));
vi.mock('@/components/ui/avatar',()=>({
  Avatar:({children,...props}:React.HTMLAttributes<HTMLSpanElement>)=><span {...props}>{children}</span>,
  AvatarImage:(props:React.ImgHTMLAttributes<HTMLImageElement>)=><img {...props}/>,
  AvatarFallback:({children}:React.PropsWithChildren)=><span>{children}</span>,
}));
vi.mock('@/hooks/use-mobile', () => ({useIsMobile:()=>state.mobile}));
vi.mock('@/hooks/useUserRole', () => ({useUserRole:()=>({isAdmin:state.admin})}));
vi.mock('@/hooks/useAccessControl',()=>({useAccessControl:()=>({data:undefined})}));
vi.mock('@/hooks/usePrayerWall', () => {
  const mutation = () => ({mutate:state.mutate,isPending:state.busy});
  return { usePrayerReaction:mutation,useUrgentPrayer:mutation,useClosePrayer:mutation,useDeletePrayer:mutation,useToggleAmen:mutation,useTogglePinPrayer:mutation,useMarkPrayerAnswered:mutation,CATEGORY_LABELS:{supplication:'代求'} };
});
vi.mock('./PrayerComments', () => ({PrayerComments:({readOnly,enabled}:{readOnly:boolean;enabled:boolean})=><span data-testid="comments" data-enabled={String(enabled)}>{readOnly?'唯讀回應':'可寫回應'}</span>}));
const prayer:Prayer = {id:'prayer',content:'為家人禱告',isAnonymous:true,createdAt:'2026-09-28T00:00:00Z',userId:null,category:'supplication',isPinned:false,isAnswered:false,answeredAt:null,scriptureReference:null,authorName:'匿名',authorAvatar:null,amenCount:1,isOwner:true,hasAmened:false};
beforeEach(()=>{state.admin=false;state.busy=false;state.mobile=true;state.mutate.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({top:10,bottom:110,left:0,right:300,width:300,height:100,x:0,y:10,toJSON:()=>({})});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function menu(){fireEvent.keyDown(screen.getByRole('button',{name:'管理禱告'}),{key:'ArrowDown'});await screen.findByRole('menu');}
it('keeps owner management tucked away and exposes all existing actions with keyboard access',async()=>{
  render(<PrayerCard prayer={prayer}/>);
  expect(screen.queryByRole('menuitem')).toBeNull();
  expect(screen.getByRole('button',{name:/^為你禱告\s*1$/})).toBeVisible();
  await menu();
  for(const name of ['標記蒙應允','置頂','標記緊急','結束代禱','刪除'])expect(screen.getByRole('menuitem',{name})).toBeVisible();
});
it('does not expose owner controls to another member',()=>{
  render(<PrayerCard prayer={{...prayer,isOwner:false}}/>);
  expect(screen.queryByRole('button',{name:'管理禱告'})).toBeNull();
});
it('keeps the photo next to the name in the compact row',()=>{
  render(<PrayerCard prayer={{...prayer,isAnonymous:false,authorName:'測試成員',authorAvatar:'/member-photo.png'}}/>);
  const row=screen.getByText('測試成員').parentElement!.parentElement!;
  expect(row.querySelector('img')).toHaveAttribute('src','/member-photo.png');
  expect(row.querySelector('img')?.parentElement).toHaveClass('h-8','w-8','shrink-0');
});
it('never renders a supplied member photo on anonymous prayers',()=>{
  render(<PrayerCard prayer={{...prayer,authorAvatar:'/private-photo.png'}}/>);
  expect(document.querySelector('img')).toBeNull();
});
it('toggles mobile details without unmounting the original actions',()=>{
  render(<PrayerCard prayer={{...prayer,content:'為家人禱告\n需要完整保留的需求',isUrgent:true}}/>);
  const expand=screen.getByRole('button',{name:'展開代禱：匿名，為家人禱告'});
  const regions=expand.getAttribute('aria-controls')!.split(' ').map(id=>document.getElementById(id)!);
  expect(expand).toHaveAttribute('aria-expanded','false');
  regions.forEach(region=>expect(region).toHaveClass('hidden'));
  expect(screen.getByRole('img',{name:'緊急代禱'})).toBeTruthy();
  const originalComment=screen.getByText('可寫回應');
  fireEvent.click(expand);
  expect(expand).toHaveAttribute('aria-expanded','true');
  regions.forEach(region=>expect(region).not.toHaveClass('hidden'));
  expect(screen.getByText(/需要完整保留的需求/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'收合代禱：匿名，為家人禱告'}));
  expect(screen.getByText('可寫回應')).toBe(originalComment);
  expect(state.mutate).not.toHaveBeenCalled();
});
it('allows a moderator to delete, not change another member prayer status',async()=>{
  state.admin=true;render(<PrayerCard prayer={{...prayer,isOwner:false}}/>);await menu();
  expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  expect(screen.getByRole('menuitem',{name:'刪除'})).toBeVisible();
});
it.each([
  ['標記蒙應允',{prayerId:'prayer',isAnswered:false}],
  ['置頂',{prayerId:'prayer',isPinned:false}],
  ['標記緊急',{prayerId:'prayer',isUrgent:true}],
  ['結束代禱',{prayerId:'prayer',isClosed:true}],
] as const)('preserves the %s mutation contract',async(name,payload)=>{
  render(<PrayerCard prayer={prayer}/>);await menu();fireEvent.click(screen.getByRole('menuitem',{name}));
  expect(state.mutate).toHaveBeenCalledWith(payload);
});
it('retains a separate delete confirmation and cancellation',async()=>{
  render(<PrayerCard prayer={prayer}/>);await menu();fireEvent.click(screen.getByRole('menuitem',{name:'刪除'}));
  await screen.findByRole('alertdialog');expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'取消'}));
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(state.mutate).not.toHaveBeenCalled();
  await menu();fireEvent.click(screen.getByRole('menuitem',{name:'刪除'}));
  fireEvent.click(await screen.findByRole('button',{name:'刪除'}));expect(state.mutate).toHaveBeenCalledWith('prayer');
});
it('keeps completed prayers read-only and retains explicit reopening',async()=>{
  render(<PrayerCard prayer={{...prayer,isAnswered:true}}/>);
  expect(screen.queryByRole('button',{name:/為你禱告/})).toBeNull();
  expect(screen.getByText('唯讀回應')).toBeVisible();await menu();
  expect(screen.queryByRole('menuitem',{name:'標記蒙應允'})).toBeNull();
  fireEvent.click(screen.getByRole('menuitem',{name:'重新公開'}));
  expect(state.mutate).toHaveBeenCalledWith({prayerId:'prayer',isClosed:false});
});

it('renders one author header and keeps collapsed mobile threads disabled until expansion', () => {
  render(<PrayerCard prayer={{...prayer,authorName:'很長的會員名字',isAnonymous:false}}/>);
  expect(screen.getAllByText('很長的會員名字')).toHaveLength(1);
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','false');
  fireEvent.click(screen.getByRole('button',{name:'展開代禱：很長的會員名字，為家人禱告'}));
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','true');
  expect(screen.getAllByText('很長的會員名字')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'收合代禱：很長的會員名字，為家人禱告'}));
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','false');
});
it('enables inline comments on desktop and expands a targeted mobile notification', () => {
  state.mobile=false;
  const view=render(<PrayerCard prayer={prayer}/>);
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','true');
  view.unmount();state.mobile=true;
  render(<PrayerCard prayer={prayer} targetCommentId="target"/>);
  expect(screen.getByRole('button',{name:'收合代禱：匿名，為家人禱告'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','true');
});
it('preserves the three reversible caring responses in restrained outlined controls', () => {
  render(<PrayerCard prayer={{...prayer,reactions:[{kind:'heart',selected:true,count:3}]}}/>);
  const reactions=screen.getByRole('group',{name:'關懷回應'});
  expect(reactions.querySelectorAll('button')).toHaveLength(3);
  const selected=reactions.querySelector('button[aria-pressed="true"]')!;
  expect(selected).toHaveClass('min-h-11','border-primary/40','bg-primary/5');
  fireEvent.click(selected);
  expect(state.mutate).toHaveBeenCalledWith({prayerId:'prayer',kind:'heart',selected:false});
});

it('opens an already-mounted mobile card when a new notification targets its reply', () => {
  const view=render(<PrayerCard prayer={prayer}/>);
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','false');
  view.rerender(<PrayerCard prayer={prayer} targetCommentId="new-target"/>);
  expect(screen.getByRole('button',{name:'收合代禱：匿名，為家人禱告'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','true');
});

it('loads only viewport-visible desktop threads and stops polling when they scroll out', () => {
  state.mobile=false;
  const observers:Array<{callback:IntersectionObserverCallback;node?:Element;disconnect:()=>void}>=[];
  vi.stubGlobal('IntersectionObserver',class {
    entry:{callback:IntersectionObserverCallback;node?:Element;disconnect:()=>void};
    constructor(callback:IntersectionObserverCallback){this.entry={callback,disconnect:vi.fn()};observers.push(this.entry);}
    observe(node:Element){this.entry.node=node;}
    disconnect(){this.entry.disconnect();}
  });
  const view=render(<>{Array.from({length:20},(_,i)=><PrayerCard key={i} prayer={{...prayer,id:'prayer-'+i}}/>)}</>);
  expect(observers).toHaveLength(20);
  expect(screen.getAllByTestId('comments').every(thread=>thread.getAttribute('data-enabled')==='false')).toBe(true);
  act(()=>observers[0].callback([{isIntersecting:true,target:observers[0].node!} as IntersectionObserverEntry],{} as IntersectionObserver));
  expect(screen.getAllByTestId('comments').filter(thread=>thread.getAttribute('data-enabled')==='true')).toHaveLength(1);
  const mounted=screen.getAllByTestId('comments')[0];
  act(()=>observers[0].callback([{isIntersecting:false,target:observers[0].node!} as IntersectionObserverEntry],{} as IntersectionObserver));
  expect(screen.getAllByTestId('comments')[0]).toBe(mounted);
  expect(mounted).toHaveAttribute('data-enabled','false');
  view.unmount();observers.forEach(observer=>expect(observer.disconnect).toHaveBeenCalled());
});

it('keeps offscreen threads idle even when IntersectionObserver is unavailable', () => {
  state.mobile=false;vi.stubGlobal('IntersectionObserver',undefined);
  const rect=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({top:900,bottom:1000,left:0,right:300,width:300,height:100,x:0,y:900,toJSON:()=>({})});
  render(<PrayerCard prayer={prayer}/>);
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','false');
  rect.mockReturnValue({top:10,bottom:110,left:0,right:300,width:300,height:100,x:0,y:10,toJSON:()=>({})});
  fireEvent.scroll(window);
  expect(screen.getByTestId('comments')).toHaveAttribute('data-enabled','true');
});
