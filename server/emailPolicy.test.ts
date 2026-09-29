import { describe, expect, it } from 'vitest';
import { bulkEmailInput, emailPreferencesInput } from '@shared/email';
import { dailyEmailDue, emailAppUrl, emailProviderStatus, escapeEmailHtml, senderAddress } from './emailPolicy';

const configured = { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'WeChurch <mail@example.test>', RESEND_REPLY_TO: 'reply@example.test' };
const preference = { dailyFollowEnabled: true, dailyFollowTime: '07:00', timezone: 'Asia/Taipei', lastDailyFollowSentAt: null };

describe('email policy', () => {
  it('requires a sender and reply address, not just an API key', () => {
    expect(emailProviderStatus({ RESEND_API_KEY: 'test' }).canSend).toBe(false);
    expect(emailProviderStatus(configured).canSend).toBe(true);
    expect(emailProviderStatus({ ...configured, RESEND_REPLY_TO: 'invalid' }).configured).toBe(false);
  });
  it('B is preview-only even when credentials exist', () => {
    for (const env of [{ APP_ENV: 'staging' }, { RAILWAY_ENVIRONMENT_NAME: 'staging' }]) {
      expect(emailProviderStatus({ ...configured, ...env })).toMatchObject({ configured: true, canSend: false, reason: 'staging' });
    }
    expect(emailProviderStatus({ ...configured, DISABLE_OUTBOUND_EMAIL: '1' }).reason).toBe('disabled');
  });
  it('rejects header injection and escapes template values', () => {
    expect(senderAddress('Church <mail@example.test>')).toBeTruthy();
    expect(senderAddress('mail@example.test\r\nBcc: victim@example.test')).toBeNull();
    expect(escapeEmailHtml('<a "x">&\'')).toBe('&lt;a &quot;x&quot;&gt;&amp;&#39;');
  });
  it('keeps B links on B and rejects unsafe protocols and redirects', () => {
    const env = { APP_ENV: 'staging', PUBLIC_BASE_URL: 'https://b.example.test', APP_URL: 'https://a.example.test' };
    expect(emailAppUrl('/me', env)).toBe('https://b.example.test/me');
    expect(() => emailAppUrl('/', { APP_ENV: 'staging' })).toThrow('EMAIL_APP_URL_NOT_CONFIGURED');
    for (const route of ['https://evil.test', '//evil.test', 'javascript:alert(1)']) expect(() => emailAppUrl(route, env)).toThrow();
    for (const url of ['ftp://localhost', 'http://evil.test', 'https://user:pass@example.test']) expect(() => emailAppUrl('/', { APP_URL: url })).toThrow();
    expect(emailAppUrl('/me', { APP_URL: 'http://127.0.0.1:5100' })).toBe('http://127.0.0.1:5100/me');
  });
  it('validates real clock values and timezone names', () => {
    for (const dailyFollowTime of ['25:00', '12:60', '7:00']) expect(emailPreferencesInput.safeParse({ dailyFollowTime }).success).toBe(false);
    expect(emailPreferencesInput.safeParse({ timezone: 'Invalid/Zone' }).success).toBe(false);
    expect(emailPreferencesInput.safeParse({ dailyFollowTime: '23:59', timezone: 'Asia/Taipei' }).success).toBe(true);
  });
  it('honors opt-out, local time and one scheduled send per local day', () => {
    const now = new Date('2026-09-29T00:00:00Z');
    expect(dailyEmailDue(preference, now)).toBe(true);
    expect(dailyEmailDue({ ...preference, dailyFollowEnabled: false }, now)).toBe(false);
    expect(dailyEmailDue({ ...preference, dailyFollowTime: '09:00' }, now)).toBe(false);
    expect(dailyEmailDue({ ...preference, lastDailyFollowSentAt: '2026-09-28T23:30:00Z' }, now)).toBe(false);
    expect(dailyEmailDue({ ...preference, lastDailyFollowSentAt: '2026-09-28T12:00:00Z' }, now)).toBe(true);
    expect(dailyEmailDue({ ...preference, lastDailyFollowSentAt: '2026-09-30T00:00:00Z' }, now)).toBe(false);
    expect(dailyEmailDue({ ...preference, timezone: 'Invalid/Zone' }, now)).toBe(false);
  });
  it('bounds bulk size, attachments and retry request IDs', () => {
    const input = { requestId: 'c245d951-5205-4aa3-9855-677ac692c5e8', recipients: [{ email: 'member@example.test' }], subject: 'News', body: 'Hello' };
    expect(bulkEmailInput.safeParse(input).success).toBe(true);
    for (const patch of [{ requestId: '' }, { recipients: Array(101).fill(input.recipients[0]) }, { subject: 'Hi\r\nBcc: x' }, { attachments: [{ filename: '../secret', content: 'dGVzdA==' }] }, { attachments: [{ filename: 'test.txt', content: '' }] }]) expect(bulkEmailInput.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
