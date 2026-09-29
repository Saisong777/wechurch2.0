import { z } from 'zod';

export const permissionKeys = ['members.read', 'members.manage', 'groups.manage', 'care.manage', 'visits.manage', 'email.send', 'devotions.manage', 'wall.moderate'] as const;
export type Permission = typeof permissionKeys[number];
export const permissionLabels: Record<Permission, string> = {
  'members.read': '查看會員名單', 'members.manage': '編修會員資料',
  'groups.manage': '管理小家與成員異動', 'care.manage': '管理門訓階段與跟進任務',
  'visits.manage': '安排牧者探訪', 'email.send': '寄送教會通知',
  'devotions.manage': '管理全站靈修課表', 'wall.moderate': '管理全站公開分享',
};
export const globalPermissions: Permission[] = ['devotions.manage', 'wall.moderate'];
export const rolePresets = ['主任牧師', '牧者', '同工', '小家長', '長老', '執事', '會友'];
const permissions = z.array(z.enum(permissionKeys)).max(permissionKeys.length).refine(v => new Set(v).size === v.length, '權限不可重複');
export const roleTemplateInput = z.object({ name: z.string().trim().min(1).max(40), permissions, version: z.number().int().positive().optional() }).strict();
export const grantInput = z.object({
  userId: z.string().uuid(), roleId: z.string().uuid(), permissions,
  scope: z.enum(['church', 'group', 'member', 'site']), church: z.string().trim().min(1).max(120),
  groupId: z.string().uuid().nullable(), memberId: z.string().uuid().nullable(),
  expiresAt: z.string().datetime().nullable(), reason: z.string().trim().min(1).max(500),
  version: z.number().int().positive().optional(),
  requestId: z.string().uuid().optional(),
}).strict().superRefine((v, ctx) => {
  if ((v.scope === 'group') !== !!v.groupId || (v.scope === 'member') !== !!v.memberId) ctx.addIssue({ code: 'custom', message: '範圍與指定對象不一致' });
  if (v.permissions.some(p => globalPermissions.includes(p)) && v.scope !== 'site') ctx.addIssue({ code: 'custom', message: '全站功能須使用全站範圍' });
  if (v.scope === 'site' && v.permissions.some(p => !globalPermissions.includes(p))) ctx.addIssue({ code: 'custom', message: '會員與牧養權限必須限定教會範圍' });
  if (v.permissions.includes('visits.manage') && v.scope !== 'church') ctx.addIssue({ code: 'custom', message: '探訪收件匣須限定一間教會' });
  if (v.permissions.includes('groups.manage') && v.scope === 'member') ctx.addIssue({ code: 'custom', message: '小家管理須指定教會或小家' });
});
export type AccessGrant = {
  id: string; userId: string; roleId: string; roleName: string; permissions: Permission[];
  scope: 'church' | 'group' | 'member' | 'site'; church: string; groupId: string | null; memberId: string | null;
  expiresAt: string | null; active: boolean; version: number; reason: string;
  scopeName?: string;
};
export type AccessTemplate = { id: string; name: string; permissions: Permission[]; version: number; editable: boolean };
export type MyAccess = { permissions: Permission[]; grants: AccessGrant[]; canManageAccess: boolean; canEnterCrm: boolean; canEnterAdmin: boolean };
