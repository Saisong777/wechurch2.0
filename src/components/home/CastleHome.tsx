import { useId, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookHeart, BookOpen, Castle, ChevronDown, Compass, Footprints, Gamepad2, Heart, HandHeart, Map, MessageCircle, Moon, Pause, Play, Settings, Sun, Users, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react';
import './castle-home.css';

type Place = { id: string; name: string; label: string; description: string; href: string; action: string; icon: LucideIcon; x: number; y: number; feature?: string };
const PLACES: Place[] = [
  { id: 'chapel', name: '同行主堡', label: '每日靈修', description: '每天留一點時間，與神相遇。從教會每日讀經開始，寫下今天的領受。', href: '/learn/church-reading', action: '前往每日靈修', icon: Castle, x: 50, y: 32, feature: 'we_learn' },
  { id: 'bible', name: '話語之塔', label: '聖經', description: '打開聖經，在神的話語裡，找到生活的方向。', href: '/learn/bible', action: '打開聖經', icon: BookOpen, x: 22, y: 28, feature: 'we_learn' },
  { id: 'prayer', name: '禱告花園', label: '禱告', description: '把心裡的話帶到神面前，也為你所愛的人守望。', href: '/share', action: '前往禱告', icon: Heart, x: 80, y: 30, feature: 'we_share' },
  { id: 'groups', name: '小家聚落', label: '小家', description: '信仰的路，一起走。在小家裡分享生活、彼此扶持。', href: '/groups', action: '前往我的小家', icon: Users, x: 17, y: 51 },
  { id: 'grace', name: '恩典書庫', label: '恩典記錄', description: '把值得記得的恩典留下來。回頭看見，在日常中一路同行的神。', href: '/grace-record?view=grace', action: '打開恩典記錄簿', icon: BookHeart, x: 86, y: 49, feature: 'we_share' },
  { id: 'square', name: '同行廣場', label: '分享牆', description: '在這裡聽見彼此的故事，分享生活，也送出一份鼓勵。', href: '/walls', action: '前往分享牆', icon: MessageCircle, x: 43, y: 53 },
  { id: 'play', name: '相聚小亭', label: '工具', description: '準備一場相聚。用話語卡、破冰與分組工具，讓人更靠近。', href: '/play', action: '探索相聚工具', icon: Gamepad2, x: 65, y: 58, feature: 'we_play' },
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
  const [zoom, setZoom] = useState(1);
  const [night, setNight] = useState(false);
  const [paused, setPaused] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const detailId = useId();
  const placesId = useId();
  const selectPlace = (id: string) => {
    setSelectedId(id);
    setVisited(previous => previous.includes(id) ? previous : [...previous, id]);
  };
  const resetView = () => { setZoom(1); if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } };
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

      <div className="castle-map-shell">
        <div className="castle-map-viewport" ref={viewport} role="region" aria-label="城堡全景地圖，可使用地點清單瀏覽" tabIndex={0}>
          <div className="castle-world" style={{ width: `${zoom * 100}%` }}>
            <img className="castle-world-image" src="/im-castle-world.webp" alt="青綠海水環繞的城堡小島，中央主堡連著話語之塔、禱告花園、小家聚落、恩典書庫與同行廣場。" width="1536" height="1024" fetchPriority="high" />
            <div className="castle-world-shade" aria-hidden="true" />
            <div className="castle-map-caption" aria-hidden="true">WELCOME HOME</div>
            {places.map(place => { const Icon = place.icon; return <button key={place.id} type="button" className={`castle-hotspot ${selected?.id === place.id ? 'is-selected' : ''}`} style={{ '--place-x': `${place.x}%`, '--place-y': `${place.y}%` } as CSSProperties} aria-label={`${place.name}・${place.label}`} aria-pressed={selected?.id === place.id} aria-controls={detailId} onClick={() => selectPlace(place.id)}>
              <span className="castle-hotspot-icon"><Icon aria-hidden="true" size={19} /></span><span className="castle-hotspot-label">{place.name}<small>{place.label}</small></span>
            </button>; })}
          </div>
        </div>
        <div className="castle-map-controls" role="group" aria-label="地圖顯示設定">
          <button type="button" onClick={resetView} aria-label="重設為城堡全景"><Map size={17} aria-hidden="true" /><span>全景</span></button>
          <button type="button" onClick={() => setZoom(current => Math.max(1, current - .5))} disabled={zoom === 1} aria-label="縮小地圖"><ZoomOut size={18} aria-hidden="true" /></button>
          <output aria-label="地圖縮放比例">{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => setZoom(current => Math.min(2, current + .5))} disabled={zoom === 2} aria-label="放大地圖"><ZoomIn size={18} aria-hidden="true" /></button>
          <span className="castle-control-divider" />
          <button type="button" onClick={() => setNight(current => !current)} aria-pressed={night} aria-label={night ? '切換日間景色' : '切換夜間景色'}>{night ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button>
          <button type="button" onClick={() => setPaused(current => !current)} aria-pressed={paused} aria-label={paused ? '開啟地圖動態' : '暫停地圖動態'}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
        </div>
        <p className="castle-image-credit">AI 城堡概念示意</p>
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
