import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Footprints } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import type { useCastlePresence } from '@/hooks/useCastlePresence';
import type { CastlePreset } from '@shared/castlePresence';
export function CastlePresencePanel({ presence, signedIn }: {
    presence: ReturnType<typeof useCastlePresence>;
    signedIn: boolean;
}) {
    const [alias, setAlias] = useState(() => `同行者${Math.floor(100 + Math.random() * 900)}`), [preset, setPreset] = useState<CastlePreset>('jade'), [open, setOpen] = useState(false);
    const { view } = presence;
    const joined = view.status === 'joined', count = view.roster?.avatars.length || 0;
    return <section className="castle-presence" aria-label="真人城堡連線" data-presence-state={view.status}>
  <div className="castle-presence-summary"><Users size={15} aria-hidden="true"/><span>{view.roster ? `城堡內 ${count} 人` : view.status === 'connecting' ? '正在連接城堡…' : '城堡空間'}</span>
   {joined ? <button type="button" onClick={presence.leave}>離開</button> : signedIn && view.scope ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" disabled={view.status === 'joining'}>加入城堡</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>用自己的玩偶加入城堡</DialogTitle><DialogDescription>同教會、開著城堡的人會看見你的暱稱與玩偶。離開畫面後會離場，最慢約 25 秒更新。</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); presence.join({ alias: alias.trim(), preset }); setOpen(false); }} className="castle-presence-form"><label>城堡暱稱<input value={alias} maxLength={24} required onChange={event => setAlias(event.target.value)} autoComplete="off"/></label><label>玩偶配色<select value={preset} onChange={event => setPreset(event.target.value as CastlePreset)}><option value="jade">青綠</option><option value="coral">珊瑚</option><option value="sunshine">日光黃</option><option value="blue">湖藍</option><option value="ivory">米白</option><option value="violet">紫藤</option></select></label><button type="submit" className="castle-primary-link" disabled={!alias.trim()}>確認加入城堡</button></form></DialogContent></Dialog> : !signedIn ? <Link to="/login">登入加入</Link> : <span>等待教會確認</span>}
  </div>
  <p role="status">{view.message || (joined ? '點步道移動，或選地點後按「走到這裡」。' : view.roster ? count ? '這些玩偶是已確認加入的同行者。' : '目前沒有人加入，你可以先逛逛。' : !signedIn ? '登入並確認加入，才會出現你的玩偶。' : '先確認教會歸屬，再加入同行。')}</p>
  {(view.status === 'disconnected' || view.status === 'expired') && <button type="button" onClick={presence.retry}>重新連線</button>}
  {!!count && <details><summary><Footprints size={13} aria-hidden="true"/> 誰在城堡裡</summary><ul>{view.roster!.avatars.map(avatar => <li key={avatar.avatarId}>{avatar.alias}{avatar.isSelf ? '（我）' : ''}</li>)}</ul></details>}
 </section>;
}
