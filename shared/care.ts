import { z } from 'zod';
import { devotionDate } from './churchDevotion';

export const careActionLabels = { care: '關心', call: '電話', message: '訊息', visit: '探訪', invite: '邀請', prayer: '代禱', note: '近況筆記' } as const;
export const careActionInput = z.object({
  id: z.string().uuid().optional(),
  actionType: z.enum(['care', 'call', 'message', 'visit', 'invite', 'prayer', 'note']).default('note'),
  note: z.string().trim().max(2000).optional(),
  nextCareDate: devotionDate.nullable().optional(),
  nextAction: z.string().trim().max(300).optional(),
});
export function careToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function needsCare(contact: { nextCareDate?: string | null; lastCaredAt: string | null; isArchived?: boolean }, today = careToday()) {
  return !contact.isArchived && (contact.nextCareDate ? contact.nextCareDate <= today : !contact.lastCaredAt);
}

export const visitStatusLabels = { open: '待安排', assigned: '已安排', completed: '已探訪', cancelled: '已取消' } as const;
export const visitCreate = z.object({
  contactId: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(2000),
  contactMethod: z.string().trim().min(1).max(300),
  urgency: z.enum(['normal', 'urgent']),
  consent: z.literal(true),
}).strict();
export const visitUpdate = z.object({
  version: z.number().int().positive(),
  status: z.enum(['open', 'assigned', 'completed', 'cancelled']),
  assigneeId: z.string().uuid().nullable(),
  dueDate: devotionDate.nullable(),
  note: z.string().trim().min(1).max(2000),
}).strict().refine(v => v.status !== 'assigned' || !!v.assigneeId, '請選擇探訪同工');
export interface VisitRequest {
  id: string; senderId: string; senderName: string; name: string; reason: string; contactMethod: string;
  urgency: 'normal' | 'urgent'; status: keyof typeof visitStatusLabels; assigneeId: string | null;
  assigneeName: string | null; dueDate: string | null; nextAction: string; version: number; createdAt: string;
}
