import { Link, useLocation } from 'react-router-dom';
import { cn, vibrate } from '@/lib/utils';
import { appNavItems, isNavItemActive } from '@/lib/navigation';

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/40 shadow-[0_-1px_0_0_rgba(0,0,0,0.08)] md:hidden pb-[env(safe-area-inset-bottom)]"
      style={{ WebkitTransform: 'translateZ(0)' }}
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-14 max-w-xl mx-auto px-2">
        {appNavItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(location.pathname, item);

          return (
            <Link
              key={item.id}
              to={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
              onClick={() => vibrate(50)}
              data-testid={`nav-link-${item.id}`}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-amber"
                />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 mb-0.5 transition-transform duration-150",
                  active ? "scale-110 text-brand-amber" : "scale-100 text-[#999]"
                )}
                fill={active ? "currentColor" : "none"}
                strokeWidth={active ? 1 : 1.5}
              />
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  active
                    ? "font-medium text-brand-amber"
                    : "font-normal text-[#999]"
                )}
              >
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
