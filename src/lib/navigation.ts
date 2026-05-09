import { BookOpen, Dumbbell, Gamepad2, Home, Share2, type LucideIcon } from 'lucide-react';

export interface AppNavItem {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  match: string[];
}

export const appNavItems: AppNavItem[] = [
  {
    id: 'home',
    label: '首頁',
    shortLabel: '首頁',
    href: '/',
    icon: Home,
    match: ['/'],
  },
  {
    id: 'live',
    label: 'SoulGym',
    shortLabel: 'SoulGym',
    href: '/user',
    icon: Dumbbell,
    match: ['/user'],
  },
  {
    id: 'learn',
    label: '讀聖經',
    shortLabel: '讀聖經',
    href: '/learn',
    icon: BookOpen,
    match: ['/learn', '/bible', '/jesus-timeline'],
  },
  {
    id: 'play',
    label: '小工具',
    shortLabel: '小工具',
    href: '/play',
    icon: Gamepad2,
    match: ['/play', '/icebreaker', '/grouper', '/card', '/cards'],
  },
  {
    id: 'share',
    label: '來禱告',
    shortLabel: '來禱告',
    href: '/share',
    icon: Share2,
    match: ['/share', '/prayer-wall', '/prayer-meeting'],
  },
];

export function isNavItemActive(pathname: string, item: AppNavItem) {
  return item.match.some((prefix) => {
    if (prefix === '/') return pathname === '/';
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
