import { Link, useLocation } from 'react-router-dom';
import { cn, vibrate } from '@/lib/utils';
import { appNavItems, isNavItemActive } from '@/lib/navigation';

export function MobileNavLinks({ onNavigate, placement = 'footer' }: {
  onNavigate?: () => void;
  placement?: 'header' | 'footer';
}) {
  const { pathname, search, hash } = useLocation();
  return <div className={cn('mx-auto grid max-w-xl gap-1 p-2', placement === 'header' ? 'grid-cols-2' : 'grid-cols-5')}>
    {appNavItems.map(item => {
      const Icon = item.icon;
      const active = isNavItemActive(pathname, item);
      return <Link key={item.id} to={item.href} aria-current={active ? 'page' : undefined}
        data-testid={placement === 'footer' ? `nav-link-${item.id}` : `mobile-menu-${item.id}`}
        onClick={event => {
          if (pathname === item.href && !search && !hash) {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'instant' });
          }
          vibrate(50); onNavigate?.();
        }}
        className={cn('flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          placement === 'footer' && 'flex-col gap-1', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{item.shortLabel}</span>
      </Link>;
    })}
  </div>;
}

// Kept as an in-flow footer, never pinned to the viewport.
export const BottomNav = () => <nav aria-label="頁尾導覽" className="mobile-footer-nav border-t border-border/70 bg-background md:hidden" data-testid="nav-bottom">
  <MobileNavLinks />
</nav>;
