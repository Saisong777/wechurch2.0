import { BookOpen, Dumbbell, HandHeart, Home, Share2, type LucideIcon } from 'lucide-react';

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
    label: '查經',
    shortLabel: '查經',
    href: '/user',
    icon: Dumbbell,
    match: ['/user'],
  },
  {
    id: 'learn',
    label: '聖經',
    shortLabel: '聖經',
    href: '/learn',
    icon: BookOpen,
    match: ['/learn', '/bible', '/jesus-timeline'],
  },
  {
    id: 'share',
    label: '禱告',
    shortLabel: '禱告',
    href: '/share',
    icon: Share2,
    match: ['/share', '/prayer-wall', '/prayer-meeting'],
  },
  {
    id: 'care',
    label: '關懷',
    shortLabel: '關懷',
    href: '/care',
    icon: HandHeart,
    match: ['/care'],
  },
];

export function isNavItemActive(pathname: string, item: AppNavItem) {
  return item.match.some((prefix) => {
    if (prefix === '/') return pathname === '/';
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
