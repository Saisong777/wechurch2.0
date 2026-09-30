import { afterEach,expect,it,vi } from 'vitest';
vi.mock('./db',()=>({pool:{query:vi.fn()}}));
import { buildInteractionEmail,runInteractionEmails } from './notificationEmail';
import { emailProviderStatus } from './emailPolicy';
import { emailPreferencesInput } from '../shared/email';
import { markNotificationsReadInput,notificationTargetId } from '../shared/notifications';
afterEach(() => vi.unstubAllEnvs());
it('keeps email generic and same-origin without names or prayer/comment bodies',() => {
  vi.stubEnv('PUBLIC_BASE_URL','https://b.example.test');
  const email=buildInteractionEmail();expect(email.text).toContain('https://b.example.test/notifications');expect(email.html).toContain('#email-settings');expect(email.subject).toBe('WeChurch｜有人回應你了');
});
it('requires both deployment permission and explicit interaction scheduling',async() => {
  const base={RESEND_API_KEY:'test',RESEND_FROM_EMAIL:'mail@example.test',RESEND_REPLY_TO:'reply@example.test',APP_ENV:'staging',INTERACTION_EMAIL_SCHEDULER_ENABLED:'1'};
  expect(emailProviderStatus(base).interactionNotificationsEnabled).toBe(false);
  expect(emailProviderStatus({...base,STAGING_CONTROLLED_EMAIL_ENABLED:'1'}).interactionNotificationsEnabled).toBe(true);
  expect(emailProviderStatus({...base,STAGING_CONTROLLED_EMAIL_ENABLED:'1',DISABLE_OUTBOUND_EMAIL:'1'}).interactionNotificationsEnabled).toBe(false);
  vi.stubEnv('INTERACTION_EMAIL_SCHEDULER_ENABLED','0');await expect(runInteractionEmails({dryRun:false})).rejects.toThrow('INTERACTION_EMAIL_DISABLED');
});
it('accepts only explicit boolean consent and precise server timestamps',() => {
  expect(emailPreferencesInput.parse({interactionEmailEnabled:true,userId:'forged'})).toEqual({interactionEmailEnabled:true});
  expect(emailPreferencesInput.safeParse({interactionEmailEnabled:'yes'}).success).toBe(false);
  expect(markNotificationsReadInput.safeParse({before:'2026-09-30T10:01:00.123456Z'}).success).toBe(true);
  expect(markNotificationsReadInput.safeParse({before:'tomorrow'}).success).toBe(false);
  expect(notificationTargetId('https://evil.test')).toBe('');expect(notificationTargetId(null)).toBe('');
});
