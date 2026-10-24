import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Hand, X } from 'lucide-react';
import { getFriendSpeech } from './castle/ambientDialogue';
import { FRIEND_RESPONSES, type AmbientAction } from './castle/ambientFriends';

export type CastleFriendDialogueHandle = { focusSpeech: () => void };
type Props = { friendId: string; onClose: () => void; onGesture: (action: AmbientAction) => void };
/** A finite, nonmodal speech bubble. Every displayed sentence belongs to the scene character. */
export const CastleFriendDialogue = forwardRef<CastleFriendDialogueHandle, Props>(function CastleFriendDialogue({ friendId, onClose, onGesture }, ref) {
  const script = getFriendSpeech(friendId);
  const [step, setStep] = useState(0), [feedback, setFeedback] = useState<string>();
  const speech = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({ focusSpeech: () => speech.current?.focus({ preventScroll: true }) }), []);
  if (!script) return null;
  const last = step === script.lines.length - 1;
  const gesture = (action: AmbientAction) => { setFeedback(FRIEND_RESPONSES[script.friend.kind][action]); onGesture(action); };
  return <section className="castle-rpg-speech" aria-label={`${script.friend.name}的對話泡泡`}>
    <button ref={speech} type="button" className="castle-rpg-text" onClick={() => { setFeedback(undefined); setStep(value => value === script.lines.length - 1 ? 0 : value + 1); }}>
      <span className="castle-rpg-name">{script.friend.name}<small>{script.friend.kind === 'resident' ? '場景居民' : '場景動物'}</small></span>
      <span className="castle-rpg-line" role="status" aria-live="polite" aria-atomic="true">{feedback || script.lines[step]}</span>
      <span className="castle-rpg-hint">{last ? '再點一下，重新聊' : '輕點或按 Enter 接下一句'}</span>
    </button>
    <div className="castle-rpg-actions">
      <button type="button" onClick={() => gesture('hello')}><Hand size={16} aria-hidden="true"/>招手</button>
      <button type="button" onClick={() => gesture('affection')}>{FRIEND_RESPONSES[script.friend.kind].action}</button>
      <button type="button" onClick={onClose} aria-label="關閉對話泡泡"><X size={18} aria-hidden="true"/></button>
    </div>
  </section>;
});
