import { useContext, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu, X, HandHeart, UserRound, Wrench } from 'lucide-react';
import { mobilePageTitle } from '@/lib/navigation';
import { MobileNavLinks } from './BottomNav';
import { MobileHeaderContext } from './MobileHeaderContext';
import { MobileAccountActions } from './MobileAccountActions';

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const mobileHeader = useContext(MobileHeaderContext);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = mobilePageTitle(pathname);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div ref={root} className="mobile-navigation sticky top-0 z-40 shrink-0 border-b border-border bg-background md:hidden" data-testid="mobile-navigation">
    <div className="mx-auto grid min-h-14 max-w-xl grid-cols-[5rem_minmax(0,1fr)_5rem] items-center gap-1 px-2">
      <button type="button" aria-label="返回上一頁" className="flex min-h-12 items-center justify-center rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => { setOpen(false); if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate('/', { replace: true }); }}>
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden="true" />返回
      </button>
      <Link to="/" aria-label={`${title}，回首頁`} className="flex min-h-12 min-w-0 items-center justify-center text-center text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring"><span className="truncate">{title}</span></Link>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={menuId} aria-label={open ? '關閉導覽選單' : '開啟導覽選單'}
        className="flex min-h-12 items-center justify-center gap-1 rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(!open)}>
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}選單
      </button>
    </div>
    <nav id={menuId} aria-label="行動導覽選單" hidden={!open} className="mobile-navigation-menu absolute inset-x-0 top-full overflow-y-auto overscroll-contain border-y border-border bg-background shadow-md">
      <div ref={mobileHeader?.setActionsTarget} data-testid="mobile-page-actions" className="[&_button]:min-h-11 [&_button]:min-w-11" />
      <MobileNavLinks placement="header" onNavigate={() => setOpen(false)} />
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-1 border-t border-border p-2">
        {([{ href: '/care', label: '關懷', icon: HandHeart }, { href: '/me', label: '個人設定', icon: UserRound }, { href: '/play', label: '工具', icon: Wrench }]).map(item => <Link
          key={item.href} to={item.href} data-testid={`mobile-menu-${item.href.slice(1)}`} onClick={() => setOpen(false)} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
          className="flex min-h-12 items-center justify-center gap-1 rounded-md text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{item.label}
        </Link>)}
      </div>
      <MobileAccountActions close={() => setOpen(false)} />
    </nav>
  </div>;
}
