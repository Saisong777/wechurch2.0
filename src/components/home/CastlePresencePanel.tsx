import { Link } from 'react-router-dom';
import { Users, Footprints, Shirt } from 'lucide-react';
import type { useCastlePresence } from '@/hooks/useCastlePresence';
export function CastlePresencePanel({ presence, signedIn, onWardrobe }: {
    presence: ReturnType<typeof useCastlePresence>;
    signedIn: boolean;
    onWardrobe: (trigger: HTMLElement) => void;
}) {
    const { view } = presence, joined = view.status === 'joined', count = view.roster?.avatars.length || 0, busy = view.status === 'joining' || view.status === 'connecting';
    return <section className="castle-presence" aria-label="真人城堡連線" data-presence-state={view.status}>
  <div className="castle-presence-summary"><Users size={15} aria-hidden="true"/><span>{view.roster ? `城堡內 ${count} 人` : busy ? '玩偶正在入場…' : '城堡空間'}</span>
   {signedIn && view.scope ? <><button type="button" onClick={event => onWardrobe(event.currentTarget)}><Shirt size={15} aria-hidden="true"/>我的造型</button>{joined ? <button type="button" onClick={presence.leave}>離開</button> : view.status === 'ready' ? <button type="button" onClick={presence.join}>重新入場</button> : null}</> : !signedIn ? <Link to="/login">登入加入</Link> : <span>等待教會確認</span>}
  </div>
  <p role="status">{view.message || (joined ? '點步道移動，或選地點後按「走到這裡」。' : busy ? '使用帳號造型加入，同教會的人會看見你的暱稱與玩偶。' : view.roster ? '已離開這個分頁的城堡；其他已開啟的分頁仍可留在場內。' : !signedIn ? '登入並確認教會後，就會有自己的玩偶。' : '先確認教會歸屬，才會出現自己的玩偶。')}</p>
  {(view.status === 'disconnected' || view.status === 'expired') && <button type="button" onClick={presence.retry}>重新連線</button>}
  {!!count && <details><summary><Footprints size={13} aria-hidden="true"/> 誰在城堡裡</summary><ul>{view.roster!.avatars.map(avatar => <li key={avatar.avatarId}>{avatar.alias}{avatar.isSelf ? '（我）' : ''}</li>)}</ul></details>}
 </section>;
}
