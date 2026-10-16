import { z } from 'zod';
import { devotionDate } from './churchDevotion';

const title = z.string().trim().min(1, '請填標題').max(160);
export const GROUP_SHARE_MAX_LENGTH = 12000;
const body = z.string().trim().min(1, '請填內容').max(GROUP_SHARE_MAX_LENGTH);
export const groupCreateInput = z.object({ name: title });
export const shareInput = z.object({
  kind: z.enum(['note', 'prayer', 'message']), title, body,
  reference: z.string().trim().max(500).default(''),
  sourceId: z.string().uuid().nullable().default(null),
  anonymous: z.boolean().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: '請確認願意將此內容分享給小家' }) }),
}).refine(v => v.kind !== 'message' || (!v.sourceId && !v.anonymous), '生活留言不能引用私人筆記或匿名');
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
export type GroupSummary = { leaderName?: string | null; coLeaderName?: string | null; id: string; name: string; church: string; manager: boolean; memberCount: number; pendingRequestCount?: number };
export type GroupMember = { id: string; name: string; manager: boolean };
export type GroupShare = { id: string; authorId: string | null; authorName: string; anonymous: boolean; isOwner: boolean; kind: 'note' | 'prayer' | 'message'; title: string; body: string; reference: string; answered: boolean; version: number; createdAt: string; prayed: boolean; prayerCount: number; commentCount: number };
export type GroupComment = { id: string; authorId: string | null; isOwner?:boolean; authorName: string; body: string; createdAt: string };
export type GroupCare = { id: string; creatorId: string; name: string; need: string; status: keyof typeof careStatuses; nextAction: string; dueDate: string | null; responsibleId: string | null; version: number; watching: boolean; watcherCount: number; updatedAt: string };
export type CareUpdate = { id: string; authorId: string; authorName: string; body: string; createdAt: string; status: keyof typeof careStatuses; nextAction: string; dueDate: string | null; responsibleId: string | null };
export type ShareSource = { id: string; title: string; body: string; reference: string };

export const readingReflectionFields = ['observation', 'receiving', 'response'] as const;
export const readingReflectionLabels = { observation: '看見', receiving: '領受', response: '回應' } as const;
export const readingReflectionInput = z.object({
  devotionVersion: z.number().int().positive(),
  noteId: z.string().uuid().nullable(), noteVersion: z.number().int().positive().nullable(),
  observation: z.string().max(5000), receiving: z.string().max(5000), response: z.string().max(5000),
  shareFields: z.array(z.enum(readingReflectionFields)).min(1, '請至少選擇一欄分享。').max(3),
  markRead: z.boolean(), consent: z.literal(true),
}).strict().superRefine((input, ctx) => {
  if ((input.noteId === null) !== (input.noteVersion === null)) ctx.addIssue({ code: 'custom', message: '筆記版本不完整，請重新載入。' });
  if (new Set(input.shareFields).size !== input.shareFields.length) ctx.addIssue({ code: 'custom', path: ['shareFields'], message: '分享欄位重複。' });
  for (const field of input.shareFields) if (!input[field].trim()) ctx.addIssue({ code: 'custom', path: [field], message: `請填寫要分享的${readingReflectionLabels[field]}。` });
  if (composeReadingReflection(input).length > GROUP_SHARE_MAX_LENGTH) ctx.addIssue({ code: 'custom', path: ['shareFields'], message: '所選內容超過小家分享上限。' });
});
export type ReadingReflectionInput = z.infer<typeof readingReflectionInput>;
export function composeReadingReflection(input: { observation: string; receiving: string; response: string; shareFields: readonly typeof readingReflectionFields[number][] }) {
  return readingReflectionFields.filter(field => input.shareFields.includes(field)).map(field => `${readingReflectionLabels[field]}\n${input[field].trim()}`).join('\n\n');
}
export const readingNoteResponse = z.object({ note: z.object({
  id: z.string().uuid(), version: z.number().int().positive(), observation: z.string(), receiving: z.string(), response: z.string(),
}).strict().nullable() }).strict();
export type ReadingNoteResponse = z.infer<typeof readingNoteResponse>;
export const readingReflectionResult = z.object({
  noteId: z.string().uuid(), noteVersion: z.number().int().positive(), shareId: z.string().uuid(), markedRead: z.boolean(),
}).strict();
export type ReadingReflectionResult = z.infer<typeof readingReflectionResult>;
