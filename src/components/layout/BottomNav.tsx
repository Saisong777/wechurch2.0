import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { cn, vibrate } from '@/lib/utils';
import { appNavItems, isNavItemActive } from '@/lib/navigation';

export const BottomNav = () => {
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nav = (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-[1000] border-t border-border/70 bg-background/95 shadow-[0_-18px_40px_-32px_rgba(30,58,95,0.45)] backdrop-blur-xl md:hidden"
      data-testid="nav-bottom"
    >
      <div className="mx-auto flex h-14 max-w-xl items-center justify-around px-2">
        {appNavItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(location.pathname, item);

          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                "relative flex h-full flex-1 flex-col items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active ? "text-primary" : "text-muted-foreground active:bg-muted/70"
              )}
              onClick={() => vibrate(50)}
              data-testid={`nav-link-${item.id}`}
            >
              {active && (
                <span
                  className="absolute inset-x-2 top-1.5 h-10 rounded-lg bg-primary/10"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={cn(
                  "relative mb-0.5 h-5 w-5 transition-transform duration-150",
                  active ? "scale-105 text-primary" : "scale-100 text-muted-foreground"
                )}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span
                className={cn(
                  "relative text-[11px] leading-tight",
                  active
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-foreground"
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

  return mounted ? createPortal(nav, document.body) : nav;
};
