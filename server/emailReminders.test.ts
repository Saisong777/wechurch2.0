import { afterEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));
vi.mock('./resend', () => ({ sendEmail: vi.fn() }));
import { buildSelfReminder, startEmailReminderScheduler } from './emailReminders';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks(); });

it('keeps the reminder generic, with same-site settings and no activity reads', () => {
  vi.stubEnv('PUBLIC_BASE_URL', 'https://b.example.test');
  const message = buildSelfReminder();
  expect(message.text).toContain('https://b.example.test/me');
  expect(message.html).toContain('更改時間或關閉提醒');
  expect(query).not.toHaveBeenCalled();
});

it('runs inside Railway only when explicitly enabled and stops cleanly', async () => {
  vi.useFakeTimers();
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('STAGING_CONTROLLED_EMAIL_ENABLED', '1');
  vi.stubEnv('DISABLE_OUTBOUND_EMAIL', '0');
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  vi.stubEnv('RESEND_FROM_EMAIL', 'mail@example.test');
  vi.stubEnv('RESEND_REPLY_TO', 'reply@example.test');
  vi.stubEnv('DAILY_EMAIL_SCHEDULER_ENABLED', '0');
  query.mockResolvedValue({ rows: [] });
  const stop = startEmailReminderScheduler();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(query).not.toHaveBeenCalled();
  vi.stubEnv('DAILY_EMAIL_SCHEDULER_ENABLED', '1');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(query).toHaveBeenCalledTimes(1);
  await stop();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(query).toHaveBeenCalledTimes(1);
});
