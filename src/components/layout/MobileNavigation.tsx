import { useContext, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu, X, UserRound, Wrench, CircleHelp, MessageSquare } from 'lucide-react';
import { mobilePageTitle } from '@/lib/navigation';
import { MobileNavLinks } from './BottomNav';
import { MobileHeaderContext } from './MobileHeaderContext';
import { MobileAccountActions } from './MobileAccountActions';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';
import { AppearanceControl } from '@/components/theme/AppearanceControl';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const mobileHeader = useContext(MobileHeaderContext);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = mobilePageTitle(pathname);

  useEffect(() => { setOpen(false); }, [pathname]);

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
    <div className="mobile-navigation-bar mx-auto grid min-h-[56px] max-w-xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[4px] px-[8px]">
      <button type="button" aria-label="返回上一頁" className="flex min-h-[48px] min-w-[44px] items-center justify-center whitespace-nowrap rounded-md text-[min(0.875rem,20px)] font-medium focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => { setOpen(false); if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate('/', { replace: true }); }}>
        <ChevronLeft className="h-[20px] w-[20px] shrink-0" aria-hidden="true" />返回
      </button>
      <Link to="/" onClick={() => setOpen(false)} aria-label={`${title}，回首頁`} className="flex min-h-[48px] min-w-0 items-center justify-center gap-[6px] text-center text-[min(1rem,22px)] font-semibold focus-visible:ring-2 focus-visible:ring-ring"><WeChurchLogo size={28} /><span className="truncate">{title}</span></Link>
      <div className="flex shrink-0 items-center gap-[4px]"><NotificationBell /><button ref={trigger} type="button" aria-expanded={open} aria-controls={menuId} aria-label={open ? '關閉導覽選單' : '開啟導覽選單'}
        className="flex min-h-[48px] min-w-[44px] items-center justify-center gap-[4px] whitespace-nowrap rounded-md text-[min(0.875rem,20px)] font-medium focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(!open)}>
        {open ? <X className="h-[20px] w-[20px]" aria-hidden="true" /> : <Menu className="h-[20px] w-[20px]" aria-hidden="true" />}選單
      </button></div>
    </div>
    <nav id={menuId} aria-label="行動導覽選單" hidden={!open} className="mobile-navigation-menu absolute inset-x-0 top-full overflow-y-auto overscroll-contain border-t border-border bg-background shadow-md">
      <div className="mobile-menu-content mx-auto max-w-xl">
        <div ref={mobileHeader?.setActionsTarget} data-testid="mobile-page-actions" className="mobile-menu-page-actions [&_button]:min-h-11 [&_button]:min-w-11" />
        <section aria-label="日常與同行">
          <h2 className="mobile-menu-label">日常與同行</h2>
          <MobileNavLinks placement="header" onNavigate={() => setOpen(false)} />
        </section>
        <div className="mobile-menu-utilities">
          {([{ href: '/me', label: '個人設定', icon: UserRound }, { href: '/play', label: '工具', icon: Wrench }, { href: '/help', label: '使用說明', icon: CircleHelp }, { href: '/feedback', label: '意見反饋', icon: MessageSquare }]).map(item => <Link
            key={item.href} to={item.href} state={item.href === '/feedback' ? {from:pathname} : undefined} data-testid={`mobile-menu-${item.href.slice(1)}`} onClick={() => setOpen(false)} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
            className="mobile-menu-utility">
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{item.label}
          </Link>)}
        </div>
        <section aria-label="外觀" className="mobile-menu-appearance">
          <h2 className="mobile-menu-label">外觀</h2>
          <AppearanceControl inline />
        </section>
        <MobileAccountActions close={() => setOpen(false)} />
      </div>
    </nav>
  </div>;
}
