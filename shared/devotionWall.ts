import { z } from 'zod';

export function devotionDayWindow(now: Date) {
  const day = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0,10);
  return { day, serverNow: now.toISOString(), expiresAt: new Date(Date.parse(`${day}T00:00:00+08:00`) + 86400000).toISOString() };
}
export const DEVOTION_SHARE_MAX_LENGTH = 20000;
const wallCursor = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
}).strict();
export const devotionWallPageInput = z.object({
  limit: z.string().regex(/^\d{1,2}$/).default('30').transform(Number).pipe(z.number().int().min(1).max(50)),
  cursor: z.string().max(256).transform((value, ctx) => {
    try { return JSON.parse(value); }
    catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid cursor' }); return z.NEVER; }
  }).pipe(wallCursor).optional(),
});
export function devotionWallCursor(day: string, createdAt: string, id: string): string {
  return JSON.stringify(wallCursor.parse({ day, createdAt, id }));
}
export const devotionWallShareInput = z.object({
  sourceId: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(DEVOTION_SHARE_MAX_LENGTH),
  reference: z.string().trim().min(1).max(200),
  anonymous: z.boolean(),
  consent: z.literal(true),
});
export type DevotionShareSection = { key:string;label:string;text:string };
export type DevotionShareDraft = { sourceId:string;title:string;body:string;reference:string;sections?:DevotionShareSection[] };
export type DevotionWallPost = { id:string;title:string;body:string;reference:string;authorName:string;anonymous:boolean;isOwner:boolean;createdAt:string;expiresAt:string };
export type DevotionWallFeed = ReturnType<typeof devotionDayWindow> & { posts:DevotionWallPost[];nextCursor:string|null };
export function wallTimeRemaining(feed:Pick<DevotionWallFeed,'serverNow'|'expiresAt'>,elapsedMs:number) {
  return Math.max(0,Date.parse(feed.expiresAt)-Date.parse(feed.serverNow)-Math.max(0,elapsedMs));
}
