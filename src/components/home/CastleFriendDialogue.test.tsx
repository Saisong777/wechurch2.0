// @vitest-environment jsdom
import {createRef} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {CastleFriendDialogue,type CastleFriendDialogueHandle} from './CastleFriendDialogue';
import {AMBIENT_FRIENDS,FRIEND_RESPONSES} from './castle/ambientFriends';
import {getFriendSpeech} from './castle/ambientDialogue';
afterEach(cleanup);
describe('head bubble speech and direct actions',()=>{
 it.each(AMBIENT_FRIENDS)('$name opens immediately, continues on one native button, and restarts without fabricating player dialogue',friend=>{
  const gesture=vi.fn(),close=vi.fn(),script=getFriendSpeech(friend.id)!;
  render(<CastleFriendDialogue friendId={friend.id} onGesture={gesture} onClose={close}/>);
  const region=screen.getByRole('region',{name:`${friend.name}的對話泡泡`}),speech=within(region).getAllByRole('button')[0];
  expect(screen.getByRole('status')).toHaveTextContent(script.lines[0]);expect(screen.queryByRole('heading',{name:'聊兩句'})).toBeNull();
  for(const line of script.lines.slice(1)){fireEvent.click(speech);expect(screen.getByRole('status')).toHaveTextContent(line);}
  expect(speech).toHaveTextContent('再點一下，重新聊');fireEvent.click(speech);expect(screen.getByRole('status')).toHaveTextContent(script.lines[0]);expect(gesture).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(region.querySelectorAll('[aria-live]')).toHaveLength(1);
 });
 it('keeps greeting and touch feedback in the same bubble and only explicit actions request body animation',()=>{
  const gesture=vi.fn(),close=vi.fn();render(<CastleFriendDialogue friendId="ambient-cat-1" onGesture={gesture} onClose={close}/>);
  fireEvent.click(screen.getByRole('button',{name:'招手'}));expect(screen.getByRole('status')).toHaveTextContent(FRIEND_RESPONSES.cat.hello);
  fireEvent.click(screen.getByRole('button',{name:FRIEND_RESPONSES.cat.action}));expect(screen.getByRole('status')).toHaveTextContent(FRIEND_RESPONSES.cat.affection);expect(gesture.mock.calls).toEqual([['hello'],['affection']]);
  fireEvent.click(screen.getByRole('button',{name:'關閉對話泡泡'}));expect(close).toHaveBeenCalledOnce();expect(gesture).toHaveBeenCalledTimes(2);
 });
 it('exposes typed keyboard focus without scrolling the page, preserves current line and resets on a new encounter key',()=>{
  const ref=createRef<CastleFriendDialogueHandle>(),gesture=vi.fn(),close=vi.fn();const view=render(<CastleFriendDialogue key="1" ref={ref} friendId="ambient-cat-1" onGesture={gesture} onClose={close}/>);
  const speech=screen.getAllByRole('button')[0];fireEvent.click(speech);ref.current?.focusSpeech();expect(speech).toHaveFocus();expect(screen.getByRole('status')).toHaveTextContent(getFriendSpeech('ambient-cat-1')!.lines[1]);
  view.rerender(<CastleFriendDialogue key="2" ref={ref} friendId="ambient-dog-2" onGesture={gesture} onClose={close}/>);expect(screen.getByRole('status')).toHaveTextContent(getFriendSpeech('ambient-dog-2')!.lines[0]);expect(gesture).not.toHaveBeenCalled();view.unmount();expect(ref.current).toBeNull();
 });
});
