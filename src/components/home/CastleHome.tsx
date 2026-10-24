import {useCastleWindowActive} from '@/contexts/CastleWindowContext';
import {isPortraitCastle} from './castle/camera';
import {useCastlePresence} from '@/hooks/useCastlePresence';
import {CastlePresencePanel} from './CastlePresencePanel';
import {PLACE_WALK_NODES} from '@shared/castleNavigation';
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookHeart, BookOpen, Castle, Compass, Footprints, Gamepad2, Heart, HandHeart, MessageCircle, Moon, Pause, Play, Settings, Sun, Users, Menu, X, ChevronUp, type LucideIcon } from 'lucide-react';
import './castle-home.css';
import './castle-fullscreen.css';
import { useImmersiveSurface } from '@/hooks/useImmersiveSurface';
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
  modeControls?: ReactNode;
  accountControls?: ReactNode;
  navigationControls?: ReactNode;
  churchControls?: ReactNode;
  notices?: ReactNode;
  presenceScope?:string|null;
  signedIn?:boolean;
}

export function CastleHome({ churchName, preview, featureEnabled, featuresLoading, scripture, hasDraft, onOpenNote, showAdmin, showPastoral, modeControls, accountControls, navigationControls, churchControls, notices, presenceScope=null,signedIn=false }: CastleHomeProps) {
  useImmersiveSurface();
  const navigate=useNavigate();
  const windowActive=useCastleWindowActive();
  const presence=useCastlePresence(presenceScope);
  const places = PLACES.filter(place => !place.feature || (!featuresLoading && featureEnabled(place.feature)));
  const [selectedId, setSelectedId] = useState('chapel');
  const selected = places.find(place => place.id === selectedId) || places[0];
  const [visited, setVisited] = useState<string[]>([]);
  const [night, setNight] = useState(false), [paused, setPaused] = useState(false);
  const [portrait,setPortrait]=useState(()=>isPortraitCastle(window.innerWidth,window.innerHeight));
  const [hasNotices,setHasNotices]=useState(false);
  const [panel, setPanel] = useState<'places' | 'menu' | null>(null);
  const [insets, setInsets] = useState({ top: 100, right: 0, bottom: 100 });
  const exploreButton=useRef<HTMLButtonElement>(null),messageArea=useRef<HTMLDivElement>(null);
  const topbar = useRef<HTMLDivElement>(null), drawer = useRef<HTMLElement>(null), compact = useRef<HTMLDivElement>(null), noticeArea = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null), wasOpen = useRef(false);
  const detailId = useId(), drawerId = useId(), messageId=useId();
  const selectPlace = (id: string) => { setSelectedId(id); setVisited(previous => previous.includes(id) ? previous : [...previous, id]); if(portrait){lastTrigger.current=exploreButton.current;setPanel('places');}else setPanel(current => current === 'menu' ? 'places' : current); };
  const activatePlace=(id:string)=>{const place=places.find(candidate=>candidate.id===id);if(!place)return;setSelectedId(id);setVisited(previous=>previous.includes(id)?previous:[...previous,id]);void navigate(place.href);};
  const openPanel = (next: 'places' | 'menu', trigger: HTMLButtonElement) => { lastTrigger.current = trigger; setPanel(current => current === next ? null : next); };
  useLayoutEffect(()=>{const resize=()=>setPortrait(isPortraitCastle(window.innerWidth,window.innerHeight));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  useLayoutEffect(() => {
    if (panel) { const content=drawer.current?.querySelector<HTMLElement>('.castle-drawer-scroll');if(content)content.scrollTop=0; drawer.current?.querySelector<HTMLButtonElement>('[data-castle-close]')?.focus({ preventScroll: true }); wasOpen.current = true; }
    else if (wasOpen.current) { lastTrigger.current?.focus({ preventScroll: true }); wasOpen.current = false; }
  }, [panel]);
  useEffect(() => {
    if (!panel||windowActive) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) setPanel(null); };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [panel,windowActive]);
  useLayoutEffect(() => {
    const measure = () => {
      const top = Math.max(topbar.current?.getBoundingClientRect().bottom || 0, portrait?0:noticeArea.current?.getBoundingClientRect().bottom || 0) + 10;
      setHasNotices(Boolean(messageArea.current?.textContent?.trim()));
      const bounds = drawer.current?.getBoundingClientRect(), small = window.innerWidth <= 640;
      const next = { top, right: portrait?64:!small && panel && bounds ? bounds.width + 28 : 0, bottom: small ? panel && bounds ? bounds.height + 20 : portrait?76:(compact.current?.getBoundingClientRect().height || 80) + 20 : 0 };
      setInsets(old => old.top === next.top && old.right === next.right && old.bottom === next.bottom ? old : next);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    [topbar.current, drawer.current, compact.current, noticeArea.current].forEach(node => node && observer?.observe(node));
    const chromeObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(measure) : null;
    chromeObserver?.observe(document.getElementById('root') || document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); chromeObserver?.disconnect(); window.removeEventListener('resize', measure); };
  }, [panel,portrait]);
  const SelectedIcon = selected?.icon || Compass;
  const seenCount = places.filter(place => visited.includes(place.id)).length;
  const selectedContent = <>
    <span className="castle-detail-icon"><SelectedIcon size={24} aria-hidden="true" /></span>
    <div className="castle-detail-copy"><p className="castle-eyebrow">{selected?.label || '地圖導覽'}</p><h2>{selected?.name || '探索我們的城堡'}</h2>
      {panel === 'places' && <p>{selected?.description || '選擇一個地點，從這裡開始同行。'}</p>}
      {selected?.id === 'chapel' && <p className="castle-today" role="status">{scripture.state === 'ready' ? `今日讀經：${scripture.reference}` : scripture.state === 'loading' ? '正在載入教會課表…' : scripture.state === 'unpublished' ? '今天的靈修尚未發佈' : '暫時無法載入教會課表'}</p>}
    </div>
    {selected&&presence.view.status==='joined'&&<button className="castle-walk-link" type="button" onClick={()=>presence.move(PLACE_WALK_NODES[selected.id as keyof typeof PLACE_WALK_NODES])}><Footprints size={15} aria-hidden="true"/>走到這裡</button>}
    {selected && <Link className="castle-primary-link" to={selected.href}>{selected.action}<ArrowRight size={16} aria-hidden="true" /></Link>}
  </>;

  const atmosphereControls=<div className="castle-atmosphere-controls" role="group" aria-label="城堡氣氛設定">
          <button type="button" onClick={() => setNight(current => !current)} aria-pressed={night} aria-label={night ? '切換日間景色' : '切換夜間景色'}>{night ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button>
          <button type="button" onClick={() => setPaused(current => !current)} aria-pressed={paused} aria-label={paused ? '開啟地圖動態' : '暫停地圖動態'}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
        </div>;
  const messageContent=<>{notices}{hasDraft&&<div className="castle-draft" role="status"><p>此裝置有靈修草稿，尚未同步。</p><button type="button" onClick={onOpenNote}>開啟草稿<ArrowRight size={16} aria-hidden="true"/></button></div>}</>;
  const noticesContent=<div className={portrait?'castle-menu-notices':'castle-hud-notices'} ref={noticeArea}>
    <CastlePresencePanel presence={presence} signedIn={signedIn}/>
    {portrait?<div ref={messageArea}>{messageContent}</div>:messageContent}
  </div>;

  return <div className={`castle-home castle-home--fullscreen ${night ? 'castle-home--night' : ''} ${paused ? 'castle-home--paused' : ''}`} data-testid="castle-home" data-castle-portrait={String(portrait)} data-castle-panel={panel || 'closed'} style={{ '--castle-panel-bottom': `${insets.bottom}px` } as CSSProperties}>
    <div className="castle-map-shell castle-map-shell--3d">
      <Suspense fallback={<div className="castle-3d-loading-fallback" role="status">正在打開城門…</div>}>
        <CastleScene places={places} selectedId={selected?.id} onSelect={activatePlace} paused={paused} night={night} detailId={detailId} insets={insets} presence={presence.view} onMove={presence.move} />
      </Suspense>
    </div>
    <div className="castle-hud" aria-label="城堡導覽與設定">
      <div className="castle-topbar" ref={topbar}>
        <div className="castle-brand" aria-labelledby="castle-title"><p><Castle size={16} aria-hidden="true" />{churchName}{preview && <span>預覽</span>}</p><h1 id="castle-title">我們的城堡</h1></div>
        {!portrait&&<div className="castle-hud-mode">{modeControls}</div>}
        {!portrait&&atmosphereControls}
        <div className="castle-hud-actions">
          <button ref={exploreButton} data-castle-explore type="button" aria-label="開啟城堡地點" aria-expanded={panel === 'places'} aria-controls={drawerId} onClick={event => openPanel('places', event.currentTarget)}><Compass size={18} aria-hidden="true" /><span>探索</span></button>
          <button type="button" aria-label="開啟城堡選單" aria-describedby={portrait&&(hasNotices||!!presence.view.message)?messageId:undefined} aria-expanded={panel === 'menu'} aria-controls={drawerId} onClick={event => openPanel('menu', event.currentTarget)}><Menu size={19} aria-hidden="true" /><span>選單</span>{portrait&&(hasNotices||!!presence.view.message)&&<i className="castle-message-badge"><span id={messageId} className="sr-only" role="status">有訊息待查看</span></i>}</button>
        </div>
      </div>
      {!portrait&&noticesContent}
      {portrait&&<div className="castle-mobile-entry">{!signedIn?<Link to="/login"><Users size={16} aria-hidden="true"/>登入加入</Link>:<button type="button" aria-controls={drawerId} aria-expanded={panel==='menu'} onClick={event=>openPanel('menu',event.currentTarget)}><Users size={16} aria-hidden="true"/>{presence.view.status==='disconnected'||presence.view.status==='expired'?'連線中斷・重連':presence.view.status==='connecting'?'城堡連線中…':presence.view.status==='joined'?`城堡內 ${presence.view.roster?.avatars.length||0} 人`:'加入城堡'}</button>}</div>}
      <aside ref={drawer} id={drawerId} className="castle-drawer" hidden={!panel} aria-labelledby={`${drawerId}-title`}>
        <div className="castle-drawer-heading"><h2 id={`${drawerId}-title`}>{panel === 'menu' ? '教會與我的日常' : '城堡地點'}</h2><button data-castle-close type="button" aria-label="收合城堡面板" onClick={() => setPanel(null)}><X size={19} aria-hidden="true" /></button></div>
        <div className="castle-drawer-scroll">
          {panel === 'places' && <>
            <div className="castle-place-detail" id={detailId} role="region" aria-label="目前選擇的地點" aria-live="polite">{selectedContent}</div>
            <nav className="castle-place-list" aria-label="城堡所有地點">{places.map(place => { const Icon = place.icon; return <Link to={place.href} key={place.id} onClick={() => selectPlace(place.id)}><Icon size={19} aria-hidden="true" /><span>{place.name}<small>{place.label}</small></span><ArrowRight size={15} aria-hidden="true" /></Link>; })}</nav>
            <div className="castle-exploration"><Footprints size={16} aria-hidden="true" /><span>你的探索足跡<strong>{seenCount} / {places.length}</strong></span><small>僅記錄這次瀏覽的地點</small></div>
          </>}
          <div hidden={panel!=='menu'}>
            {portrait&&<><div className="castle-mobile-preferences"><div className="castle-hud-mode">{modeControls}</div>{atmosphereControls}</div>{noticesContent}</>}
            {panel==='menu'&&<>
            <div className="castle-account-slot">{accountControls}</div>
            <div className="castle-nav-slot">{navigationControls}</div>
            <div className="castle-church-slot">{churchControls}</div>
            <nav className="castle-everyday-links" aria-label="我的日常與管理">
              {featureEnabled('we_learn') && !featuresLoading && <Link to="/learn/my-notes"><BookOpen size={16} aria-hidden="true" />我的筆記</Link>}
              {featureEnabled('care') && !featuresLoading && <Link to="/care"><HandHeart size={16} aria-hidden="true" />關懷清單</Link>}
              <Link to="/me/activity"><Heart size={16} aria-hidden="true" />待回應</Link>
              {showPastoral && <Link to="/work"><Users size={16} aria-hidden="true" />牧養概況</Link>}
              {showAdmin && <Link to="/admin"><Settings size={16} aria-hidden="true" />主持與管理</Link>}
              <Link to="/sitemap">網站導覽</Link><Link to="/help">使用說明</Link><Link to="/feedback" state={{ from: '/' }}>意見反饋</Link>
            </nav>
            </>}
          </div>
        </div>
      </aside>
      <div ref={compact} className="castle-compact-place" hidden={!!panel||portrait}>
        {!panel&&!portrait && <div className="castle-place-detail" id={detailId} role="region" aria-label="目前選擇的地點" aria-live="polite">{selectedContent}</div>}
        <button className="castle-compact-expand" type="button" aria-label="展開城堡地點" onClick={event => openPanel('places', event.currentTarget)}><ChevronUp size={16} aria-hidden="true" /></button>
      </div>
    </div>
  </div>;
}
