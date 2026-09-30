import { z } from 'zod';
import { devotionDate } from './churchDevotion';

export const attendanceLabels = { present: '出席', excused: '請假', absent: '未出席', unrecorded: '未填' } as const;
export type AttendanceStatus = keyof typeof attendanceLabels;
export const gatheringKinds = { group: '小家聚會', sunday: '主日聚會' } as const;
const personKey = z.string().regex(/^(user|membership):[0-9a-f-]{36}$/i);
export const createGatheringInput = z.object({
  date: devotionDate, kind: z.enum(['group', 'sunday']),
  roster: z.array(personKey).min(1, '請選擇當次應出席的成員').max(500),
}).strict().refine(v => new Set(v.roster).size === v.roster.length, '名單不可重複');
export const saveAttendanceInput = z.object({
  version: z.number().int().positive(),
  entries: z.array(z.object({ key: personKey, status: z.enum(['present', 'excused', 'absent', 'unrecorded']) }).strict()).max(500),
  visitors: z.number().int().min(0).max(10000), cancelled: z.boolean(),
}).strict().refine(v => new Set(v.entries.map(e => e.key)).size === v.entries.length, '名單不可重複');
export type DashboardGroup = { id: string; name: string; church: string; sharedReadable: boolean };
export type AttendanceCounts = Record<AttendanceStatus, number>;
export type Gathering = { id: string; groupId: string; groupName: string; date: string; kind: keyof typeof gatheringKinds; cancelled: boolean; visitors: number; version: number; counts: AttendanceCounts };
export type AttendanceEntry = { key: string; name: string; status: AttendanceStatus };
export type GatheringDetail = Gathering & { entries: AttendanceEntry[] };
export type DashboardCare = { id: string; groupId: string; groupName: string; name: string; status: string; dueDate: string | null; responsibleName: string | null; nextAction: string; updatedAt: string };
export type DashboardPrayer = { id: string; groupId: string; groupName: string; title: string; authorName: string; answered: boolean; updatedAt: string };
export type LeaderDashboardData = {
  groups: DashboardGroup[]; scope: string; today: string; since: string; updatedAt: string;
  care: { active: number; due: number; unassigned: number; items: DashboardCare[] };
  prayers: { recent: number; items: DashboardPrayer[] };
  gatherings: Gathering[]; groupsWithoutGathering: number;
};
