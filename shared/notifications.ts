import { z } from 'zod';

export const notificationLabels = {
  prayer_amen: '有人為你禱告',
  prayer_reaction: '有人關心你的代禱',
  prayer_comment: '你參與的代禱有新的回應',
  family_prayed: '小家有人為你禱告',
  family_comment: '你參與的小家分享有新的留言',
} as const;
export type NotificationKind = keyof typeof notificationLabels;
export interface InteractionNotification {
  id: string; kind: NotificationKind; title: string; createdAt: string; readAt: string | null; href: string;
}
export interface NotificationFeed {
  items: InteractionNotification[]; unreadCount: number; nextCursor: string | null; snapshotAt: string;
}
export const markNotificationsReadInput = z.object({ before: z.string().datetime({ offset: true }) });
export function notificationTargetId(value: string | null) {
  return z.string().uuid().safeParse(value).success ? value! : '';
}
