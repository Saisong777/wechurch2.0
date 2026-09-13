import { BookOpen, HandHeart, Home, Share2, type LucideIcon } from 'lucide-react';

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

const mobileTitles: Record<string, string> = {
  '/me/activity': '待回應', '/me/sharing': '我的分享',
  '/': 'WeChurch', '/learn/church-reading': '每日靈修', '/learn/my-notes': '我的筆記',
  '/learn/reading-plans': '讀經計畫', '/learn/bible': '聖經', '/bible': '聖經',
  '/learn/jesus-timeline': '耶穌時間軸', '/jesus-timeline': '耶穌時間軸',
  '/prayer-meeting': '禱告會', '/prayer-wall': '禱告牆', '/devotion-wall': '靈修牆',
  '/grace-record': '禱告與恩典', '/groups': '我的小組', '/care': '關懷',
  '/learn': '聖經', '/share': '禱告', '/me/love-journey': '愛的旅程', '/me': '個人管理',
  '/play': '工具', '/user': 'SoulGym', '/cards': '話語卡', '/card': '話語卡',
  '/icebreaker': '破冰工具', '/grouper': '分組工具', '/notebook': '筆記',
};

export function mobilePageTitle(pathname: string) {
  const match = Object.keys(mobileTitles).sort((a, b) => b.length - a.length)
    .find(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
  return match ? mobileTitles[match] : 'WeChurch';
}
