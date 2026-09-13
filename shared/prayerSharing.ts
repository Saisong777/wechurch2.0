import { z } from 'zod';

export const prayerSharingInput = z.object({
  items: z.array(z.object({
    sourceId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1, '請填分享內容').max(10000),
  })).min(1).max(20).refine(items => new Set(items.map(i => i.sourceId)).size === items.length, '不可重複選取同一筆禱告'),
  groupId: z.string().uuid().nullable().default(null),
  publicWall: z.boolean(),
  anonymous: z.boolean(),
  consent: z.literal(true),
}).refine(value => value.groupId || value.publicWall, '請選擇分享對象');

export type PrayerSharingInput = z.infer<typeof prayerSharingInput>;
export type PrayerShareDelivery = { prayerId: string; destination: string; groupId: string | null; postId: string; name: string; anonymous: boolean; createdAt: string; content?: string };
