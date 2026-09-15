import { z } from 'zod';

export const personalPrayerInput = z.object({
  title: z.string().trim().min(1).max(160),
  prayer: z.string().trim().max(10000),
  response: z.string().trim().max(10000).default(''),
  status: z.enum(['waiting', 'answered', 'grace_response']).default('waiting'),
  responseType: z.enum(['ended', 'blocked', 'grace', 'keep_waiting', 'other']).nullable().default(null),
});

export type PersonalPrayerInput = z.infer<typeof personalPrayerInput>;
export type PersonalPrayer = PersonalPrayerInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
