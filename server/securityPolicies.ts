import { z } from "zod";
import { insertDevotionalNoteSchema } from "@shared/schema";

export const prayerBodySchema = z.object({
  content: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(80).optional(),
  isAnonymous: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isAnswered: z.boolean().optional(),
  scriptureReference: z.string().trim().max(120).optional().nullable(),
});

export const prayerPatchSchema = z.object({
  isPinned: z.boolean().optional(),
  isAnswered: z.boolean().optional(),
});

export const prayerCommentBodySchema = z.object({
  content: z.string().trim().min(1).max(1000),
});

export const devotionalNotePatchSchema = insertDevotionalNoteSchema.omit({ userId: true }).partial();

export function parseAuthenticatedPrayerBody(body: unknown, userId: string) {
  const parsed = prayerBodySchema.safeParse(body);
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { ...parsed.data, userId },
  };
}

export function parseDevotionalNotePatch(body: unknown) {
  return devotionalNotePatchSchema.safeParse(body);
}
