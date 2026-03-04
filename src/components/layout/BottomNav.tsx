import { Link, useLocation } from 'react-router-dom';
import { Dumbbell, BookOpen, Gamepad2, Share2, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    id: 'home',
    label: '首頁',
    href: '/',
    icon: Home,
  },
  {
    id: 'live',
    label: 'SoulGYM',
    href: '/user',
    icon: Dumbbell,
  },
  {
    id: 'learn',
    label: '讀聖經',
    href: '/learn',
    icon: BookOpen,
  },
  {
    id: 'play',
    label: '小工具',
    href: '/play',
    icon: Gamepad2,
  },
  {
    id: 'share',
    label: '來禱告',
    href: '/share',
    icon: Share2,
  },
];

export const BottomNav = () => {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    if (href === '/play') {
      return location.pathname.startsWith('/play') || location.pathname.startsWith('/icebreaker') || location.pathname.startsWith('/grouper');
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-sheet md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-14 max-w-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.id}
              to={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
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
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
