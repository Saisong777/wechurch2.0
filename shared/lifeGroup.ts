import { z } from 'zod';
import { devotionDate } from './churchDevotion';

const title = z.string().trim().min(1, '請填標題').max(160);
export const GROUP_SHARE_MAX_LENGTH = 12000;
const body = z.string().trim().min(1, '請填內容').max(GROUP_SHARE_MAX_LENGTH);
export const groupCreateInput = z.object({ name: title });
export const shareInput = z.object({
  kind: z.enum(['note', 'prayer']), title, body,
  reference: z.string().trim().max(500).default(''),
  sourceId: z.string().uuid().nullable().default(null),
  anonymous: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: '請確認願意將此內容分享給小組' }) }),
});
export const shareEditInput = z.object({ title, body, reference: z.string().trim().max(500), version: z.number().int().positive(), answered: z.boolean() });
export const careStatuses = { new: '待聯絡', following: '持續陪伴', paused: '暫停', completed: '已完成' } as const;
export const careInput = z.object({
  name: z.string().trim().min(1, '請填稱呼').max(80), need: body,
  nextAction: z.string().trim().max(1000).default(''),
  dueDate: devotionDate.nullable().default(null),
  responsibleId: z.string().uuid().nullable().default(null),
  consent: z.literal(true, { errorMap: () => ({ message: '請確認已獲同意或已匿名處理' }) }),
});
export const careUpdateInput = z.object({
  body: z.string().trim().min(1, '請記下這次跟進').max(4000),
  status: z.enum(['new', 'following', 'paused', 'completed']),
  nextAction: z.string().trim().max(1000), dueDate: devotionDate.nullable(),
  responsibleId: z.string().uuid().nullable(), version: z.number().int().positive(),
});
export const commentInput = z.object({ body: z.string().trim().min(1).max(4000) });
export type GroupSummary = { id: string; name: string; church: string; manager: boolean; memberCount: number };
export type GroupMember = { id: string; name: string; manager: boolean };
export type GroupShare = { id: string; authorId: string | null; authorName: string; anonymous: boolean; isOwner: boolean; kind: 'note' | 'prayer'; title: string; body: string; reference: string; answered: boolean; version: number; createdAt: string; prayed: boolean; prayerCount: number; commentCount: number };
export type GroupComment = { id: string; authorId: string; authorName: string; body: string; createdAt: string };
export type GroupCare = { id: string; creatorId: string; name: string; need: string; status: keyof typeof careStatuses; nextAction: string; dueDate: string | null; responsibleId: string | null; version: number; watching: boolean; watcherCount: number; updatedAt: string };
export type CareUpdate = { id: string; authorId: string; authorName: string; body: string; createdAt: string; status: keyof typeof careStatuses; nextAction: string; dueDate: string | null; responsibleId: string | null };
export type ShareSource = { id: string; title: string; body: string; reference: string };
