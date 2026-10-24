import {createRef} from 'react';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CastleFriendDialogue, type CastleFriendDialogueHandle } from './CastleFriendDialogue';
import { AMBIENT_FRIENDS } from './castle/ambientFriends';
import { getFriendDialogue } from './castle/ambientDialogue';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('local two-round dialogue', () => {
  it.each(AMBIENT_FRIENDS)('lets $name reach every topic and reply branch, then replay or change topic', friend => {
    const script = getFriendDialogue(friend.id)!;
    for (const topic of script.topics) for (const followUp of topic.followUps) {
      const view = render(<CastleFriendDialogue friendId={friend.id} />);
      expect(screen.getByRole('status')).toHaveTextContent(script.opening);
      fireEvent.click(screen.getByRole('button', { name: topic.line })); expect(screen.getByRole('status')).toHaveTextContent(topic.reply);
      expect(screen.getByRole('status')).toHaveFocus(); expect(screen.getByText(topic.line)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: followUp.line })); expect(screen.getByRole('status')).toHaveTextContent(followUp.reply);
      expect(screen.getByRole('status')).toHaveFocus(); expect(screen.getByText(followUp.line)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '再聊這個話題' })); expect(screen.getByRole('status')).toHaveTextContent(topic.reply); expect(screen.queryByText(followUp.reply)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '換個話題' })); expect(screen.getByRole('status')).toHaveTextContent(script.opening); expect(screen.getByRole('status')).toHaveFocus();
      expect(within(screen.getByRole('group', { name: '選一句話開始' })).getAllByRole('button')).toHaveLength(2); expect(screen.queryByText(topic.reply)).toBeNull(); view.unmount();
    }
  });
  it('moves only the owned scroll viewport to each new reply, without returning to an earlier heading or announcing history', () => {
    let replyTop = 260;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.classList.contains('castle-drawer-scroll') ? 100 : replyTop;
      return { x: 0, y: top, top, bottom: top + 52, left: 0, right: 250, width: 250, height: 52, toJSON: () => ({}) } as DOMRect;
    });
    const view = render(<div className="castle-drawer-scroll"><CastleFriendDialogue friendId="ambient-cat-1" /></div>), viewport = view.container.firstElementChild as HTMLElement;
    viewport.scrollTop = 70; const script = getFriendDialogue('ambient-cat-1')!, topic = script.topics[0];
    fireEvent.click(screen.getByRole('button', { name: topic.line })); expect(viewport.scrollTop).toBe(222); const first = screen.getByRole('status'); expect(first).toHaveFocus();
    replyTop = 330; fireEvent.click(screen.getByRole('button', { name: topic.followUps[0].line })); expect(viewport.scrollTop).toBe(444); expect(first.isConnected).toBe(false); expect(screen.getByRole('status')).toHaveFocus();
    expect(view.container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1); expect(view.container.querySelector('.castle-dialogue-history')).toHaveAttribute('aria-live', 'off');
    expect(screen.queryByRole('textbox')).toBeNull(); expect(view.container.querySelectorAll('.castle-dialogue-history p').length).toBeLessThanOrEqual(4);
  });
  it('clears dialogue when changing character or unmounting and rejects unknown characters', () => {
    const first = getFriendDialogue('ambient-cat-1')!, next = getFriendDialogue('ambient-dog-2')!;
    const view = render(<CastleFriendDialogue friendId="ambient-cat-1" />); fireEvent.click(screen.getByRole('button', { name: first.topics[0].line }));
    view.rerender(<CastleFriendDialogue friendId="ambient-dog-2" />); expect(screen.getByRole('status')).toHaveTextContent(next.opening); expect(screen.queryByText(first.topics[0].reply)).toBeNull();
    view.unmount(); render(<CastleFriendDialogue friendId="ambient-cat-1" />); expect(screen.getByRole('status')).toHaveTextContent(first.opening); cleanup();
    render(<CastleFriendDialogue friendId="real-member" />); expect(screen.queryByRole('status')).toBeNull();
  });
  it('exposes a typed entry that focuses the opening or current reply without resetting progress or rebuilding history',()=>{
    const handle=createRef<CastleFriendDialogueHandle>(),script=getFriendDialogue('ambient-cat-1')!;
    const view=render(<div className="castle-drawer-scroll"><button type="button" onClick={()=>handle.current?.focusLatestReply()}>上方聊兩句入口</button><CastleFriendDialogue ref={handle} friendId="ambient-cat-1"/></div>);
    const entry=screen.getByRole('button',{name:'上方聊兩句入口'});fireEvent.click(entry);expect(screen.getByRole('status')).toHaveTextContent(script.opening);expect(screen.getByRole('status')).toHaveFocus();
    fireEvent.click(screen.getByRole('button',{name:script.topics[0].line}));fireEvent.click(screen.getByRole('button',{name:script.topics[0].followUps[0].line}));const latest=screen.getByRole('status'),history=view.container.querySelector('.castle-dialogue-history')!.textContent;
    fireEvent.click(entry);expect(latest).toHaveFocus();expect(screen.getByRole('status')).toBe(latest);expect(view.container.querySelector('.castle-dialogue-history')!.textContent).toBe(history);expect(screen.getByRole('button',{name:'再聊這個話題'})).toBeTruthy();view.unmount();expect(handle.current).toBeNull();
  });

});
