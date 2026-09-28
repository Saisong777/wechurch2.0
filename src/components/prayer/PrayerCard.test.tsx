// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrayerCard } from './PrayerCard';
import type { Prayer } from '@/hooks/usePrayerWall';

const state = vi.hoisted(() => ({ admin:false, mutate:vi.fn(), busy:false }));
vi.mock('@/hooks/useUserRole', () => ({useUserRole:()=>({isAdmin:state.admin})}));
vi.mock('@/hooks/usePrayerWall', () => {
  const mutation = () => ({mutate:state.mutate,isPending:state.busy});
  return { usePrayerReaction:mutation,useUrgentPrayer:mutation,useClosePrayer:mutation,useDeletePrayer:mutation,useToggleAmen:mutation,useTogglePinPrayer:mutation,useMarkPrayerAnswered:mutation,CATEGORY_LABELS:{supplication:'代求'} };
});
vi.mock('./PrayerComments', () => ({PrayerComments:({readOnly}:{readOnly:boolean})=><span>{readOnly?'唯讀回應':'可寫回應'}</span>}));
const prayer:Prayer = {id:'prayer',content:'為家人禱告',isAnonymous:true,createdAt:'2026-09-28T00:00:00Z',userId:null,category:'supplication',isPinned:false,isAnswered:false,answeredAt:null,scriptureReference:null,authorName:'匿名',authorAvatar:null,amenCount:1,isOwner:true,hasAmened:false};
beforeEach(()=>{state.admin=false;state.busy=false;state.mutate.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
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
