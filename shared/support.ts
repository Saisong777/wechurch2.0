import { z } from 'zod';

export const supportStatuses = ['open', 'accepted', 'waiting_requester', 'waiting_support', 'completed', 'declined', 'cancelled'] as const;
export type SupportStatus = typeof supportStatuses[number];
export const supportStatusLabels: Record<SupportStatus, string> = {
  open: '待承接', accepted: '進行中', waiting_requester: '等待本人', waiting_support: '等待支援',
  completed: '已完成', declined: '已退回', cancelled: '已取消',
};
export const supportTarget = z.object({ kind: z.enum(['group', 'destination']), id: z.string().uuid(), receiverId: z.string().uuid() }).strict();
export const supportCreate = z.object({
  target: supportTarget, title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(10000),
  consent: z.literal(true),
}).strict();
export const supportUpdate = z.object({
  version: z.number().int().positive(), status: z.enum(supportStatuses),
  nextAction: z.string().trim().max(1000).default(''), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }).nullable(),
}).strict();
export const supportReply = z.object({ version: z.number().int().positive(), body: z.string().trim().min(1).max(10000), private: z.boolean().default(false) }).strict();

export function mayTransitionSupport(current: SupportStatus, next: SupportStatus, sender: boolean) {
  if (sender) return (next === 'cancelled' && current !== 'cancelled') || (next === 'open' && ['completed', 'declined', 'cancelled'].includes(current));
  if (['completed', 'declined', 'cancelled'].includes(current)) return false;
  return ['accepted', 'waiting_requester', 'waiting_support', 'completed', 'declined'].includes(next);
}

export interface SupportTarget {
  kind: 'group' | 'destination'; id: string; receiverId: string; name: string; receiverName: string;
}
export interface SupportRequest {
  id: string; senderId: string; receiverId: string; senderName: string; receiverName: string;
  title: string; body: string; status: SupportStatus; nextAction: string; dueDate: string | null;
  version: number; updatedAt: string; isSender: boolean;
}
export interface SupportEvent { id: string; authorName: string; body: string; private: boolean; createdAt: string; }
