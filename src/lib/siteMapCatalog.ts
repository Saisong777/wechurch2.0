import { BookOpen, CircleHelp, Heart, Shield, UserRound, Users, Wrench, type LucideIcon } from 'lucide-react';
import type { MyAccess } from '@shared/accessControl';

type StaffAccess = 'admin-entry' | 'pastoral-work' | 'crm' | 'groups' | 'devotions' | 'admin-only';
export type SiteMapEntry = { title: string; href: string; description: string; keywords?: string; staffAccess?: StaffAccess };
export type SiteMapSection = { id: string; title: string; icon: LucideIcon; entries: SiteMapEntry[] };

// Canonical destinations from App.tsx and the current member/admin portals.
// Aliases, retired SoulGym routes and pages needing a record ID are omitted.
export const siteMapSections: SiteMapSection[] = [
  { id: 'reading', title: '讀經與靈修', icon: BookOpen, entries: [
    { title: '今日首頁', href: '/', description: '從今天的讀經、禱告與關懷入口開始。' },
    { title: '每日靈修', href: '/learn/church-reading', description: '閱讀教會課表、補讀過去或預讀明天的經文與靈修。', keywords: '讀經進度 禱告' },
    { title: '聖經', href: '/learn/bible', description: '查找經文，搭配譯本、參考資料與個人筆記。', keywords: '搜尋 查經' },
    { title: '我的筆記', href: '/learn/my-notes', description: '回看與整理自己的讀經領受、靈修筆記。', keywords: '私人 記錄' },
    { title: '讀經計畫', href: '/learn/reading-plans', description: '選擇讀經計畫，接續自己的閱讀進度。' },
    { title: '耶穌時間軸', href: '/learn/jesus-timeline', description: '按時間脈絡認識耶穌生平與相關經文。' },
  ] },
  { id: 'prayer-care', title: '禱告與關懷', icon: Heart, entries: [
    { title: '我的禱告', href: '/grace-record', description: '記錄自己的禱告需要與回應，分享前自行選擇對象。', keywords: '私人 代禱' },
    { title: '恩典記錄簿', href: '/grace-record?view=grace', description: '回看蒙應允的禱告，記下生活中的恩典故事。' },
    { title: '關懷的人', href: '/care', description: '記下正在關心的人、最近互動與下一步提醒。' },
    { title: '尋求陪伴', href: '/support', description: '向教會提出陪伴需要，查看自己的聯繫進度。' },
  ] },
  { id: 'community', title: '小家與同行', icon: Users, entries: [
    { title: '我的小家', href: '/groups', description: '進入自己的小家，一起讀經、分享與彼此代禱。', keywords: '加入 邀請' },
    { title: '分享牆', href: '/walls', description: '選擇禱告牆或靈修牆，閱讀教會家人的分享。' },
    { title: '禱告牆', href: '/prayer-wall', description: '為已分享的需要禱告，留言關心與回應。' },
    { title: '靈修牆', href: '/devotion-wall', description: '閱讀家人分享的經文領受，也分享自己的亮光。' },
    { title: '愛的旅程', href: '/me/love-journey', description: '接續 28 天同行操練，留下每天的回應。' },
    { title: '門訓陪伴', href: '/me/mentoring', description: '查看自己的門訓同行與陪伴記錄。' },
  ] },
  { id: 'tools', title: '聚會小工具', icon: Wrench, entries: [
    { title: '工具總覽', href: '/play', description: '找到適合聚會暖場與互動的小工具。' },
    { title: '抽破冰題', href: '/icebreaker', description: '抽一個真心話題，讓家人更認識彼此。', keywords: '遊戲 暖場' },
    { title: '立即分組', href: '/grouper', description: '依現場人數快速分組。', keywords: '隨機 名單' },
    { title: '聖經問答', href: '/play/bible-quiz', description: '透過問答認識聖經人物與故事。', keywords: '遊戲 測驗' },
    { title: '門徒人格', href: '/play/disciple-quiz', description: '用互動測驗探索自己的門徒特質。', keywords: '遊戲 測驗' },
    { title: '話語卡', href: '/cards', description: '挑選與分享鼓勵人的話語卡片。', keywords: '信息卡 圖卡' },
  ] },
  { id: 'personal', title: '個人記錄與設定', icon: UserRound, entries: [
    { title: '個人設定', href: '/me', description: '調整個人資料、外觀與每日提醒。', keywords: '帳號 照片 名字 Email' },
    { title: '通知', href: '/notifications', description: '查看與自己有關的通知。' },
    { title: '待回應', href: '/me/activity', description: '找到需要自己回應的互動與事項。' },
    { title: '我的分享', href: '/me/sharing', description: '查看自己已送出的分享與相關回應。' },
  ] },
  { id: 'help', title: '使用說明與協助', icon: CircleHelp, entries: [
    { title: '使用說明', href: '/help', description: '重看快速導覽與各項功能的使用方式。' },
    { title: '意見反饋', href: '/feedback', description: '回報問題、提出建議，查看自己的處理進度。', keywords: '錯誤 聯絡' },
    { title: '登入', href: '/login', description: '使用原本的帳號登入，讓記錄接續在同一處。', keywords: 'Google 帳號' },
  ] },
  { id: 'staff', title: '同工管理', icon: Shield, entries: [
    { title: '同工工作區', href: '/work', description: '查看授權範圍內的牧養動態與陪伴工作。', staffAccess: 'pastoral-work' },
    { title: '管理後台', href: '/admin', description: '依目前職分與授權進入管理工具。', staffAccess: 'admin-entry' },
    { title: '會員與牧養', href: '/admin/crm', description: '在授權範圍內查看會員、跟進與牧養安排。', staffAccess: 'crm' },
    { title: '小家管理', href: '/groups?manage=1', description: '管理授權範圍內的小家、成員與申請。', staffAccess: 'groups' },
    { title: '每日靈修課表管理', href: '/admin/church-devotions', description: '匯入、編輯與發佈本教會的靈修課表。', staffAccess: 'devotions' },
    { title: '角色與權限', href: '/admin/access', description: '設定教會職分、管理授權與任命。', staffAccess: 'admin-only' },
    { title: '意見反饋管理', href: '/admin/feedback', description: '閱讀會友意見，安排處理順序與回覆。', staffAccess: 'admin-only' },
  ] },
];

export type SiteMapViewer = { signedIn: boolean; isAdmin: boolean; isLeader: boolean; access?: MyAccess; pastoralAvailable: boolean };

// Matches Header, MobileAccountActions and AdminPage. This controls discovery;
// destination pages and APIs remain responsible for enforcing authorization.
export function canDiscoverSiteMapEntry(entry: SiteMapEntry, viewer: SiteMapViewer) {
  if (!entry.staffAccess) return true;
  if (!viewer.signedIn) return false;
  const { isAdmin, isLeader, access } = viewer;
  const canAdmin = isAdmin || isLeader || !!access?.canEnterAdmin;
  switch (entry.staffAccess) {
    case 'admin-entry': return canAdmin;
    case 'pastoral-work': return canAdmin || viewer.pastoralAvailable;
    case 'crm': return isLeader || !!access?.canEnterCrm;
    case 'groups': return isAdmin || !!access?.canManageGroups || !!access?.permissions.includes('groups.manage');
    case 'devotions': return isAdmin || !!access?.permissions.includes('devotions.manage');
    case 'admin-only': return isAdmin;
  }
}

export function matchingSiteMapSections(viewer: SiteMapViewer, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return siteMapSections.map(section => ({ ...section, entries: section.entries.filter(entry => {
    if (!canDiscoverSiteMapEntry(entry, viewer)) return false;
    const text = `${section.title} ${entry.title} ${entry.description} ${entry.keywords || ''}`.toLocaleLowerCase();
    return words.every(word => text.includes(word));
  }) })).filter(section => section.entries.length > 0);
}
