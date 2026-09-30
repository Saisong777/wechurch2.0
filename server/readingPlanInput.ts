import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const selection = z.object({
  bookName: z.string().trim().min(1).max(100),
  chapterStart: z.number().int().min(1).max(150).default(1),
  chapterEnd: z.number().int().min(1).max(150).optional(),
}).refine(value => (value.chapterEnd ?? value.chapterStart) >= value.chapterStart, 'Invalid chapter range');

export const readingPlanBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  startDate: date,
  templateId: z.string().uuid().nullable().optional(),
  bookSelections: z.array(selection).min(1).max(66).optional(),
  chaptersPerDay: z.number().int().min(1).max(150).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMorning: time.optional(),
  reminderNoon: time.optional(),
  reminderEvening: time.optional(),
}).refine(value => !!value.templateId || (!!value.bookSelections?.length && !!value.chaptersPerDay), 'Missing template or custom plan');

export function readingItemReference(item: { scriptureReference?: string | null; bookName?: string | null; chapterStart?: number | null; chapterEnd?: number | null }) {
  if (item.scriptureReference?.trim()) return item.scriptureReference.trim();
  if (!item.bookName?.trim()) return '';
  const start = item.chapterStart || 1;
  return `${item.bookName.trim()} ${start}${item.chapterEnd && item.chapterEnd !== start ? `-${item.chapterEnd}` : ''}`;
}

export function readingDateForDay(startDate: string, dayNumber: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}
