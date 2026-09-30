import { z } from 'zod';

export const familyStatuses = { active: '運作中', paused: '暫停', archived: '已封存' } as const;
export const familyAudiences = { unspecified: '尚未分類', women: '女生小家', men: '男生小家', mixed: '男女混合', couples: '夫妻小家', other: '其他' } as const;
export const familyAudienceInput = z.enum(['unspecified', 'women', 'men', 'mixed', 'couples', 'other']);
export const familyJoinInput = z.object({ message: z.string().trim().max(1000).default('') });
export const matchingStatuses = { pending: '等待聯繫', contacting: '同工聯繫中', matched: '已安排小家', cancelled: '已取消' } as const;
export const matchingInput = z.object({
  church: z.string().trim().min(1).max(100),
  availability: z.string().trim().min(1, '請填方便聚會的時間').max(200),
  region: z.string().trim().max(200).default(''),
  contact: z.string().trim().min(1, '請填方便聯繫的方式').max(200),
  consent: z.literal(true),
});
export const matchingUpdateInput = z.object({
  version: z.number().int().positive(),
  status: z.enum(['contacting', 'matched', 'cancelled']),
  groupId: z.string().uuid().nullable().default(null),
  message: z.string().trim().max(500).default(''),
}).refine(v => v.status !== 'matched' || !!v.groupId, '請選擇安排的小家');
export const familySettingsInput = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500),
  meeting: z.string().trim().max(200),
  announcement: z.string().trim().max(2000),
  listed: z.boolean(),
  audience: familyAudienceInput.optional(),
  status: z.enum(['active', 'paused', 'archived']),
  leaderId: z.string().uuid().nullable(),
});
export const familyCreateInput = z.object({ name: z.string().trim().min(1).max(160), church: z.string().trim().min(1).max(100), audience: familyAudienceInput.default('unspecified'), description: z.string().trim().max(500).default(''), meeting: z.string().trim().max(200).default(''), listed: z.boolean().default(true) });
export const memberMoveInput = z.object({
  userId: z.string().uuid(), targetGroupId: z.string().uuid().nullable(),
  reason: z.string().trim().min(1, '請填異動原因').max(500),
});
export const invitationToken = z.string().trim().transform(s => s.replace(/[-\s]/g, '').toLowerCase())
  .pipe(z.string().regex(/^(?:[a-f0-9]{48}|[a-f0-9]{12})$/, '請輸入有效的小家邀請碼'));
export type FamilyDirectoryEntry = { id: string; name: string; church: string; description: string; meeting: string; audience?: keyof typeof familyAudiences; membershipStatus?: 'approved' | 'pending' | 'rejected' | null };
export type FamilyRequest = { id: string; church: string; availability: string; region: string; contact: string; status: keyof typeof matchingStatuses; message: string; version: number; createdAt: string; userId: string; name?: string; ownerName?: string; groupName?: string };
export type ManagedFamily = FamilyDirectoryEntry & { status: keyof typeof familyStatuses; listed: boolean; announcement: string; version: number; leaderId: string | null; memberCount: number; pendingRequestCount?: number; canManage: boolean };
