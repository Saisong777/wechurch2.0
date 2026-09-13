import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { db } from './db';
import { readingPlanTemplates, readingPlanTemplateItems, userReadingPlans, userReadingProgress } from '@shared/schema';
import { readingPlanBodySchema, readingItemReference, readingDateForDay } from './readingPlanInput';

export class ReadingPlanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createReadingPlan(database: typeof db, userId: string, input: z.infer<typeof readingPlanBodySchema>) {
  return database.transaction(async tx => {
    let templateId = input.templateId;
    let totalDays: number;
    let items: { dayNumber: number; scriptureReference: string; bookName?: string; chapterStart?: number; chapterEnd?: number }[];
    if (templateId) {
      const [template] = await tx.select().from(readingPlanTemplates).where(eq(readingPlanTemplates.id, templateId)).for('share');
      if (!template || (!template.isPublic && template.createdBy !== userId)) throw new ReadingPlanError('Reading plan template not found', 404);
      totalDays = template.durationDays;
      const original = await tx.select().from(readingPlanTemplateItems).where(eq(readingPlanTemplateItems.templateId, templateId));
      items = original.map(item => ({ dayNumber: item.dayNumber, scriptureReference: readingItemReference(item) }));
      if (items.length !== totalDays || !Number.isInteger(totalDays) || totalDays < 1 || items.some(item => !item.scriptureReference || item.dayNumber < 1 || item.dayNumber > totalDays)
        || new Set(items.map(item => item.dayNumber)).size !== items.length) throw new ReadingPlanError('Reading plan template is incomplete');
    } else {
      if (!input.bookSelections || !input.chaptersPerDay) throw new ReadingPlanError('Missing custom plan');
      const chapters = input.bookSelections.flatMap(book => Array.from(
        { length: (book.chapterEnd ?? book.chapterStart) - book.chapterStart + 1 },
        (_, index) => ({ name: book.bookName, chapter: book.chapterStart + index }),
      ));
      totalDays = Math.ceil(chapters.length / input.chaptersPerDay);
      const [template] = await tx.insert(readingPlanTemplates).values({ name: `${input.name} - Personal`, description: input.description || null,
        category: 'personal', durationDays: totalDays, isPublic: false, createdBy: userId }).returning();
      templateId = template.id;
      items = Array.from({ length: totalDays }, (_, day) => {
        const slice = chapters.slice(day * input.chaptersPerDay!, (day + 1) * input.chaptersPerDay!);
        const first = slice[0], last = slice[slice.length - 1];
        const ranges: { name: string; start: number; end: number }[] = [];
        for (const chapter of slice) {
          const previous = ranges[ranges.length - 1];
          if (previous?.name === chapter.name && previous.end + 1 === chapter.chapter) previous.end = chapter.chapter;
          else ranges.push({ name: chapter.name, start: chapter.chapter, end: chapter.chapter });
        }
        const reference = ranges.map(range => `${range.name} ${range.start}${range.start === range.end ? '' : `-${range.end}`}`).join('; ');
        return { dayNumber: day + 1, scriptureReference: reference, bookName: first.name, chapterStart: first.chapter, chapterEnd: last.chapter };
      });
      await tx.insert(readingPlanTemplateItems).values(items.map(item => ({ ...item, templateId: template.id })));
    }
    const [plan] = await tx.insert(userReadingPlans).values({ userId, templateId, name: input.name, description: input.description || null,
      startDate: input.startDate, endDate: readingDateForDay(input.startDate, totalDays), totalDays, isActive: true,
      reminderEnabled: input.reminderEnabled ?? true, reminderMorning: input.reminderMorning ?? '07:00',
      reminderNoon: input.reminderNoon ?? '12:00', reminderEvening: input.reminderEvening ?? '20:00' }).returning();
    await tx.insert(userReadingProgress).values(items.map(item => ({ userId, planId: plan.id, dayNumber: item.dayNumber,
      readingDate: readingDateForDay(input.startDate, item.dayNumber), scriptureReference: item.scriptureReference, isCompleted: false })));
    return plan;
  });
}
