import { z } from 'zod';

export type ChurchChoice = { id: string; name: string };
export type ChurchOnboardingStatus = {
  currentChurch: string | null; canChoose: boolean; choiceLocked: boolean;
  choices: ChurchChoice[]; reason: 'choose' | 'assigned' | 'no_church' | 'manager_required';
};
export type ChurchChoiceResult = {
  ok: true; currentChurch: string | null; initialChoiceChurch: string | null;
  replayed: boolean; choiceLocked: true;
};
export const churchOnboardingStatusSchema = z.object({
  currentChurch: z.string().nullable(), canChoose: z.boolean(), choiceLocked: z.boolean(),
  choices: z.array(z.object({id:z.string().min(1),name:z.string().min(1)})),
  reason: z.enum(['choose','assigned','no_church','manager_required']),
}).refine(s => s.canChoose === (s.reason === 'choose') && s.choiceLocked !== s.canChoose &&
  (!['choose','no_church'].includes(s.reason) || s.currentChurch === null) &&
  (s.reason !== 'assigned' || s.choices.some(c => c.id === s.currentChurch)), '無法確認教會選擇狀態。');
export type ChurchLoginSummary = {
  canManage: boolean; scopeChurch: string | null; unhandledArrivals: number;
  unassignedArrivals: number; unassignedUnreadDigestDays: number; unreadDigestDays: number; total: number;
};
export type ChurchArrival = {
  id: string; userId: string; name: string; email: string | null; currentChurch: string | null;
  church: string | null; reason: 'first_login' | 'initial_choice' | 'church_changed' | 'needs_affiliation';
  choiceNone: boolean;
  status: 'pending' | 'handled'; version: number; createdAt: string; updatedAt: string;
};
export type ChurchLoginDay = {
  day: string; uniqueMembers: number; loginCount: number;
  firstLoginAt: string; lastLoginAt: string; read: boolean; inProgress: boolean;
};
export type ChurchLoginInbox = {
  canManage: boolean; scopeChurch: string | null; scope: 'church' | 'unassigned';
  arrivals: ChurchArrival[]; nextCursor: string | null; days: ChurchLoginDay[];
  today: string; counts: ChurchLoginSummary;
};
export type ChurchLoginDayMember = { userId: string | null; name: string; loginCount: number; firstLoginAt: string; lastLoginAt: string; affiliationChanged: boolean };
export type ChurchLoginDayDetail = { day: string; scopeChurch: string | null; scope: 'church' | 'unassigned'; members: ChurchLoginDayMember[]; nextCursor: string | null; inProgress: boolean };
export const initialChurchChoiceInput = z.object({ churchId: z.string().trim().min(1).max(120).nullable(), requestId: z.string().uuid() }).strict();
export const churchArrivalHandleInput = z.object({ version: z.number().int().positive() }).strict();
export const churchLoginDayReadInput = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), scope:z.enum(['church','unassigned']).optional() }).strict();
export const churchLoginInboxQuery = z.object({
  scope: z.enum(['church','unassigned']).optional(), cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
