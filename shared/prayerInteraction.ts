import { z } from 'zod';

export const REACTION_LABELS = { heart: '愛心', support: '陪伴', strength: '加油' } as const;
export type PrayerReaction = keyof typeof REACTION_LABELS;
export const STICKER_LABELS = { praying: '為你禱告', together: '與你同行', peace: '願你平安' } as const;
export type PrayerSticker = keyof typeof STICKER_LABELS;
export const COMMENT_LABELS = { encouragement: '鼓勵', prayer: '禱告', scripture: '話語', sticker: '貼圖' } as const;
export const prayerInteractionInput = z.object({
  content: z.string().trim().max(1000).default(''),
  kind: z.enum(['encouragement', 'prayer', 'scripture', 'sticker']).default('encouragement'),
  sticker: z.enum(['praying', 'together', 'peace']).optional(),
  requestId: z.string().uuid().optional(),
}).superRefine((v, ctx) => {
  if (v.kind === 'sticker' ? !v.sticker || !!v.content : !v.content || !!v.sticker)
    ctx.addIssue({ code: 'custom', message: '請填寫回應，或選擇一張貼圖。' });
});
export const prayerReactionInput = z.object({ selected: z.boolean() });
export const prayerReactionKind = z.enum(['heart', 'support', 'strength']);
export interface PrayerComment {
  id: string; prayerId: string; userId: string | null; content: string;
  kind: keyof typeof COMMENT_LABELS; sticker: PrayerSticker | null; createdAt: string;
  authorName: string; authorAvatar: string | null; isOwner: boolean; isAnonymous: boolean;
}
export function isClosedPrayer(p: { closedAt?: string | null; isAnswered: boolean }) {
  return !!p.closedAt || p.isAnswered;
}
export function isUrgentPrayer(p: { isUrgent?: boolean; isAnswered: boolean; closedAt?: string | null }) {
  return !!p.isUrgent && !isClosedPrayer(p);
}
export function compareWallPrayers(a: { isUrgent?: boolean; isAnswered: boolean; isPinned: boolean; createdAt: string }, b: typeof a) {
  return Number(isUrgentPrayer(b)) - Number(isUrgentPrayer(a)) || Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
