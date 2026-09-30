import { z } from 'zod';

export const emailStaffRoles = ['admin', 'senior_pastor', 'pastor'] as const;
export const canComposeEmail = (role?: string | null) => emailStaffRoles.some(value => value === role);

export type EmailProviderStatus = {
  configured: boolean;
  canSend: boolean;
  mode: 'resend_api_key' | 'preview_only';
  reason: 'ready' | 'staging' | 'disabled' | 'not_configured';
  message: string;
  remindersEnabled?: boolean;
};

export const mailbox = z.string().trim().email().max(254);
export const profileNotificationInput = z.object({
  email: mailbox, name: z.string().trim().max(200),
  requestId: z.string().uuid().optional(),
  type: z.enum(['welcome', 'session_invite', 'notification', 'unverified_email', 'incomplete_profile', 'potential_member']),
  redirectUrl: z.string().max(2000).default('/'),
});
export const emailPreferencesInput = z.object({
  dailyFollowEnabled: z.boolean().optional(),
  dailyFollowTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().trim().max(80).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
  }, '無效的時區').optional(),
});
export const bulkEmailInput = z.object({
  requestId: z.string().uuid(),
  recipients: z.array(z.object({ email: mailbox, name: z.string().max(200).optional() })).min(1).max(100),
  subject: z.string().trim().min(1).max(200).refine(v => !/[\r\n]/.test(v)),
  body: z.string().trim().min(1).max(200000),
  isHtml: z.boolean().default(true),
  attachments: z.array(z.object({
    filename: z.string().min(1).max(180).refine(v => !/[\r\n/\\]/.test(v)),
    content: z.string().min(1).max(2800000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })).max(5).optional(),
}).refine(v => (v.attachments || []).reduce((n, a) => n + a.content.length, 0) <= 2800000, '附件總量不可超過 2MB');
