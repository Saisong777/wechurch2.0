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
    label: 'Soul Gym',
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
    label: '實用小工具',
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom md:hidden" data-testid="nav-bottom">
      <div className="flex items-center justify-around h-14 sm:h-16 max-w-xl mx-auto px-1 sm:px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 sm:py-2 px-1 transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-link-${item.id}`}
            >
              <Icon className={cn(
                "w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 transition-transform",
                active && "scale-110"
              )} />
              <span className={cn(
                "text-[11px] sm:text-xs font-medium",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-1 sm:bottom-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
