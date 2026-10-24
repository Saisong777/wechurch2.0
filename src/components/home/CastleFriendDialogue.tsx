import { forwardRef, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ForwardedRef } from 'react';
import { getFriendDialogue } from './castle/ambientDialogue';

type Dialogue = NonNullable<ReturnType<typeof getFriendDialogue>>;
type Turn = { topic: 0 | 1; followUp?: 0 | 1 };
export type CastleFriendDialogueHandle = { focusLatestReply: () => void };
export const CastleFriendDialogue = forwardRef<CastleFriendDialogueHandle, { friendId: string }>(function CastleFriendDialogue({ friendId }, ref) {
  const dialogue = getFriendDialogue(friendId);
  return dialogue ? <DialogueSession key={friendId} dialogue={dialogue} replyHandle={ref} /> : null;
});
function DialogueSession({ dialogue, replyHandle }: { dialogue: Dialogue; replyHandle: ForwardedRef<CastleFriendDialogueHandle> }) {
  const [turn, setTurn] = useState<Turn>();
  const [revision, setRevision] = useState(0);
  const response = useRef<HTMLParagraphElement>(null);
  const titleId = useId();
  const topic = turn ? dialogue.topics[turn.topic] : undefined;
  const followUp = turn?.followUp === undefined ? undefined : topic?.followUps[turn.followUp];
  const latest = followUp?.reply || topic?.reply || dialogue.opening;
  const advance = (next?: Turn) => { setTurn(next); setRevision(value => value + 1); };
  const focusLatestReply = useCallback(() => {
    const node = response.current;
    const viewport = node?.closest<HTMLElement>('.castle-drawer-scroll');
    if (node && viewport) {
      // Scroll only the owned drawer to this new reply; preserve the world and earlier dialogue.
      viewport.scrollTop = Math.max(0, viewport.scrollTop + node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 8);
    }
    node?.focus({ preventScroll: true });
  }, []);
  useImperativeHandle(replyHandle, () => ({ focusLatestReply }), [focusLatestReply]);
  useLayoutEffect(() => { if (revision) focusLatestReply(); }, [revision, focusLatestReply]);
  return <section className="castle-dialogue" aria-labelledby={titleId}>
    <h4 id={titleId}>聊兩句</h4>
    <p className="castle-dialogue-help">選一句話接續，這是場景角色的固定對話。</p>
    <div className="castle-dialogue-history" aria-live="off">
      {topic && <><p>{dialogue.opening}</p><p className="is-player"><b>你：</b>{topic.line}</p></>}
      {followUp && <><p>{topic?.reply}</p><p className="is-player"><b>你：</b>{followUp.line}</p></>}
    </div>
    <p key={revision} ref={response} className="castle-dialogue-reply" tabIndex={-1} role="status" aria-live="polite" aria-atomic="true"><span className="sr-only">{dialogue.friend.name}：</span>{latest}</p>
    <div className="castle-dialogue-choices" role="group" aria-label={followUp ? '接下來聊什麼' : topic ? '選一句接話' : '選一句話開始'}>
      {!turn && dialogue.topics.map((item, index) => <button key={item.id} type="button" onClick={() => advance({ topic: index as 0 | 1 })}>{item.line}</button>)}
      {turn && topic && !followUp && topic.followUps.map((item, index) => <button key={item.line} type="button" onClick={() => advance({ ...turn, followUp: index as 0 | 1 })}>{item.line}</button>)}
      {turn && followUp && <button type="button" onClick={() => advance({ topic: turn.topic })}>再聊這個話題</button>}
      {turn && <button className="castle-dialogue-change" type="button" onClick={() => advance()}>換個話題</button>}
    </div>
  </section>;
}
