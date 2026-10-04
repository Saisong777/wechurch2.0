import { BookOpen, CircleHelp, Heart, MessageSquare, NotebookPen, Users } from 'lucide-react';

export const TOUR_KEY = 'wechurch:introduction:v1';
export const introductionEvent = 'wechurch:open-introduction';
export const guideSteps = [
  { title: '歡迎一起讀經、同行', icon: CircleHelp, text: '可以先瀏覽聖經與每日靈修。使用 Google 帳號登入後，就能保存自己的讀經記錄與筆記，並參與小家的同行。請使用原本的帳號，讓記錄接續在同一處。', href: '/login?returnTo=%2Fhelp', link: '登入後繼續' },
  { title: '從「今日」開始', icon: BookOpen, text: '首頁整理今日的讀經入口。每日靈修依教會的讀經計畫提供經文、重點與生活練習；上方「聖經」也能直接查找經文。手機點右上角「選單」，電腦使用上方選單。', href: '/learn/church-reading', link: '前往每日靈修' },
  { title: '把領受留在自己的筆記', icon: NotebookPen, text: '讀經時可記下心得；登入後，在「我的筆記」查看與整理自己的記錄。筆記是否分享由你選擇，私人內容請留在私人筆記。', href: '/learn/my-notes', link: '查看我的筆記' },
  { title: '與小家一起讀經', icon: Users, text: '「小家」連結你所屬的小家。每日靈修最下面的「與小家一起讀經」會帶你進入自己的小家；若加入多個小家，先選要進入的小家。尚未加入時，可以查看並申請加入。', href: '/groups', link: '前往小家' },
  { title: '禱告，也彼此回應', icon: Heart, text: '「禱告」讓你記錄禱告與恩典；「分享牆」可閱讀分享並彼此回應。送出任何分享前，先確認公開或小家的分享範圍。不要公開他人的私人資料。', href: '/walls', link: '看看分享牆' },
  { title: '有疑問，就讓我們知道', icon: MessageSquare, text: '選單裡的「使用說明」隨時可重看。「意見反饋」可以回報問題與建議，也能查看自己的處理進度。管理團隊會閱讀原文，AI 協助整理與建議順序，最後由團隊安排處理。', href: '/feedback', link: '前往意見反饋' },
];
export function openIntroduction() { window.dispatchEvent(new Event(introductionEvent)); }
