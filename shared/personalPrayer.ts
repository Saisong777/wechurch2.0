import { z } from 'zod';

export const personalPrayerInput = z.object({
  title: z.string().trim().min(1).max(160),
  prayer: z.string().trim().max(10000),
  response: z.string().trim().max(10000).default(''),
  status: z.enum(['waiting', 'answered', 'grace_response']).default('waiting'),
  responseType: z.enum(['ended', 'blocked', 'grace', 'keep_waiting', 'other']).nullable().default(null),
});

export type PersonalPrayerInput = z.infer<typeof personalPrayerInput>;
export const personalPrayerWrite = personalPrayerInput.extend({
  expectedUpdatedAt: z.string().datetime().optional(),
  closePublicShare: z.boolean().optional(),
}).refine(input => !input.closePublicShare || input.status !== 'waiting', {
  message: '繼續等候的禱告不能同時結束公開代禱。',
});
export type PersonalPrayerWrite = z.infer<typeof personalPrayerWrite>;

export function responseStatus(type: PersonalPrayerInput['responseType']): PersonalPrayerInput['status'] {
  return type === 'keep_waiting' ? 'waiting' : type === 'grace' ? 'answered' : 'grace_response';
}
export type PersonalPrayer = PersonalPrayerInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
