import { lazy, Suspense, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookHeart, BookOpen, Castle, ChevronDown, Compass, Footprints, Gamepad2, Heart, HandHeart, MessageCircle, Moon, Pause, Play, Settings, Sun, Users, type LucideIcon } from 'lucide-react';
import './castle-home.css';
const CastleScene = lazy(() => import('./castle/CastleScene'));

type Place = { id: string; name: string; label: string; description: string; href: string; action: string; icon: LucideIcon; feature?: string };
const PLACES: Place[] = [
  { id: 'chapel', name: '同行主堡', label: '每日靈修', description: '每天留一點時間，與神相遇。從教會每日讀經開始，寫下今天的領受。', href: '/learn/church-reading', action: '前往每日靈修', icon: Castle, feature: 'we_learn' },
  { id: 'bible', name: '話語之塔', label: '聖經', description: '打開聖經，在神的話語裡，找到生活的方向。', href: '/learn/bible', action: '打開聖經', icon: BookOpen, feature: 'we_learn' },
  { id: 'prayer', name: '禱告花園', label: '禱告', description: '把心裡的話帶到神面前，也為你所愛的人守望。', href: '/share', action: '前往禱告', icon: Heart, feature: 'we_share' },
  { id: 'groups', name: '小家聚落', label: '小家', description: '信仰的路，一起走。在小家裡分享生活、彼此扶持。', href: '/groups', action: '前往我的小家', icon: Users },
  { id: 'grace', name: '恩典書庫', label: '恩典記錄', description: '把值得記得的恩典留下來。回頭看見，在日常中一路同行的神。', href: '/grace-record?view=grace', action: '打開恩典記錄簿', icon: BookHeart, feature: 'we_share' },
  { id: 'square', name: '同行廣場', label: '分享牆', description: '在這裡聽見彼此的故事，分享生活，也送出一份鼓勵。', href: '/walls', action: '前往分享牆', icon: MessageCircle },
  { id: 'play', name: '相聚小亭', label: '工具', description: '準備一場相聚。用話語卡、破冰與分組工具，讓人更靠近。', href: '/play', action: '探索相聚工具', icon: Gamepad2, feature: 'we_play' },
];

export interface CastleHomeProps {
  churchName: string;
  preview?: boolean;
  featureEnabled: (key: string) => boolean;
  featuresLoading: boolean;
  scripture: { reference: string; state: 'ready' | 'loading' | 'error' | 'unpublished' };
  hasDraft: boolean;
  onOpenNote: () => void;
  showAdmin: boolean;
  showPastoral: boolean;
}

export function CastleHome({ churchName, preview, featureEnabled, featuresLoading, scripture, hasDraft, onOpenNote, showAdmin, showPastoral }: CastleHomeProps) {
  const places = PLACES.filter(place => !place.feature || (!featuresLoading && featureEnabled(place.feature)));
  const [selectedId, setSelectedId] = useState('chapel');
  const selected = places.find(place => place.id === selectedId) || places[0];
  const [visited, setVisited] = useState<string[]>([]);
  const [night, setNight] = useState(false);
  const [paused, setPaused] = useState(false);
  const detailId = useId();
  const placesId = useId();
  const selectPlace = (id: string) => {
    setSelectedId(id);
    setVisited(previous => previous.includes(id) ? previous : [...previous, id]);
  };
  const SelectedIcon = selected?.icon || Compass;
  const seenCount = places.filter(place => visited.includes(place.id)).length;

  return <div className={`castle-home ${night ? 'castle-home--night' : ''} ${paused ? 'castle-home--paused' : ''}`} data-testid="castle-home">
    <section className="castle-explorer" aria-labelledby="castle-title">
      <div className="castle-intro">
        <p className="castle-eyebrow"><Castle size={17} aria-hidden="true" />{churchName}{preview && <span>概念預覽</span>}</p>
        <h1 id="castle-title">我們的城堡<span>，</span><br />也是你的家<span>。</span></h1>
        <p className="castle-intro-copy">一座歡迎你回來的堡壘。<br />在這裡親近神，也走近彼此。</p>
        <a href={`#${placesId}`} className="castle-explore-link"><Compass size={17} aria-hidden="true" />選一個地方，開始今天<ArrowRight size={16} aria-hidden="true" /></a>
      </div>

      <div className="castle-map-shell castle-map-shell--3d">
        <Suspense fallback={<div className="castle-3d-loading-fallback" role="status">正在打開城門…</div>}>
          <CastleScene places={places} selectedId={selected?.id} onSelect={selectPlace} paused={paused} night={night} detailId={detailId} />
        </Suspense>
        <div className="castle-atmosphere-controls" role="group" aria-label="城堡氣氛設定">
          <button type="button" onClick={() => setNight(current => !current)} aria-pressed={night} aria-label={night ? '切換日間景色' : '切換夜間景色'}>{night ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}<span>{night ? '夜晚' : '日光'}</span></button>
          <button type="button" onClick={() => setPaused(current => !current)} aria-pressed={paused} aria-label={paused ? '開啟地圖動態' : '暫停地圖動態'}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}<span>{paused ? '繼續漫步' : '暫停動態'}</span></button>
        </div>
      </div>

      <div className="castle-explorer-bottom">
        <div className="castle-place-detail" id={detailId} role="region" aria-label="目前選擇的地點" aria-live="polite">
          <span className="castle-detail-icon"><SelectedIcon size={27} aria-hidden="true" /></span>
          <div className="castle-detail-copy"><p className="castle-eyebrow">{selected?.label || '地圖導覽'}</p><h2>{selected?.name || '探索我們的城堡'}</h2><p>{selected?.description || '選擇一個地點，從這裡開始同行。'}</p>
            {selected?.id === 'chapel' && <p className="castle-today" role="status">{scripture.state === 'ready' ? `今日讀經：${scripture.reference}` : scripture.state === 'loading' ? '正在載入教會課表…' : scripture.state === 'unpublished' ? '今天的靈修尚未發佈' : '暫時無法載入教會課表'}</p>}
          </div>
          {selected && <Link className="castle-primary-link" to={selected.href}>{selected.action}<ArrowRight size={17} aria-hidden="true" /></Link>}
        </div>
        <div className="castle-exploration"><Footprints size={17} aria-hidden="true" /><span>你的探索足跡<strong>{seenCount} / {places.length}</strong></span><small>僅記錄這次瀏覽的地點</small></div>
      </div>
    </section>

    <details className="castle-places" id={placesId} open>
      <summary><span><Compass size={19} aria-hidden="true" />城堡地點清單<small>也可以直接從這裡出發</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
      <nav className="castle-place-list" aria-label="城堡所有地點">{places.map(place => { const Icon = place.icon; return <Link to={place.href} key={place.id} onClick={() => selectPlace(place.id)}><Icon size={19} aria-hidden="true" /><span>{place.name}<small>{place.label}</small></span><ArrowRight size={15} aria-hidden="true" /></Link>; })}</nav>
    </details>
    <nav className="castle-everyday-links" aria-label="我的日常與管理">
      <span>把信仰帶回生活</span>
      {featureEnabled('we_learn') && !featuresLoading && <Link to="/learn/my-notes"><BookOpen size={16} aria-hidden="true" />我的筆記</Link>}
      {featureEnabled('care') && !featuresLoading && <Link to="/care"><HandHeart size={16} aria-hidden="true" />關懷清單</Link>}
      <Link to="/me/activity"><Heart size={16} aria-hidden="true" />待回應</Link>
      {showPastoral && <Link to="/work"><Users size={16} aria-hidden="true" />牧養概況</Link>}
      {showAdmin && <Link to="/admin"><Settings size={16} aria-hidden="true" />主持與管理</Link>}
    </nav>
    {hasDraft && <div className="castle-draft" role="status"><p>你有一份此裝置的靈修草稿，尚未同步。</p><button type="button" onClick={onOpenNote}>開啟草稿<ArrowRight size={16} aria-hidden="true" /></button></div>}
  </div>;
}
