import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendBulkEmail, sendEmail } from './resend';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', 'production');
  vi.stubEnv('DISABLE_OUTBOUND_EMAIL', '0');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'WeChurch <mail@example.test>');
  vi.stubEnv('RESEND_REPLY_TO', 'reply@example.test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ id: 'provider-id' }), { status: 200 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const message = { to: 'member@example.test', subject: 'Hello', text: 'Content', idempotencyKey: 'test/123' };

describe('Resend delivery boundary', () => {
  it('sends one recipient with configurable sender, reply-to and an idempotency header', async () => {
    expect(await sendEmail(message)).toEqual({ data: { id: 'provider-id' }, error: null });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers['Idempotency-Key']).toBe('test/123');
    expect(JSON.parse(options.body)).toMatchObject({ from: 'WeChurch <mail@example.test>', reply_to: 'reply@example.test', to: ['member@example.test'] });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('never calls the provider from B or without full configuration', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_DISABLED_IN_TEST_ENVIRONMENT');
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('RESEND_FROM_EMAIL', '');
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_PROVIDER_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects multiple recipients and header injection before network access', async () => {
    await expect(sendEmail({ ...message, to: ['a@example.test', 'b@example.test'] })).rejects.toThrow('EMAIL_ONE_RECIPIENT_REQUIRED');
    await expect(sendEmail({ ...message, subject: 'Hello\r\nBcc: x' })).rejects.toThrow('EMAIL_SUBJECT_INVALID');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('opens only explicitly authorized B purposes and preserves the kill switch', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('STAGING_CONTROLLED_EMAIL_ENABLED', '1');
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_DISABLED_IN_TEST_ENVIRONMENT');
    await sendEmail({ ...message, purpose: 'staff' });
    await sendEmail({ ...message, purpose: 'self' });
    vi.stubEnv('DISABLE_OUTBOUND_EMAIL', '1');
    await expect(sendEmail({ ...message, purpose: 'self' })).rejects.toThrow('EMAIL_DISABLED_IN_TEST_ENVIRONMENT');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([[429, 'EMAIL_RATE_LIMITED'], [409, 'EMAIL_REQUEST_CONFLICT'], [403, 'EMAIL_PROVIDER_REJECTED']])('redacts provider response for status %s', async (status, error) => {
    fetchMock.mockResolvedValue(new Response('private account details', { status }));
    await expect(sendEmail(message)).rejects.toThrow(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not call an uncertain network result successful or automatically retry it', async () => {
    fetchMock.mockRejectedValue(new Error('private request details'));
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_SEND_UNCONFIRMED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(new Response('{}'));
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_SEND_UNCONFIRMED');
  });
  it('deduplicates recipients and reuses per-recipient keys on retry', async () => {
    vi.useFakeTimers();
    const recipients = [{ email: 'a@example.test' }, { email: 'A@example.test' }, { email: 'b@example.test' }];
    const id = 'c245d951-5205-4aa3-9855-677ac692c5e8';
    const first = sendBulkEmail(recipients, 'News', 'Content', false, undefined, id);
    await vi.runAllTimersAsync();
    expect(await first).toMatchObject({ sent: 2, failed: 0, acceptedOnly: true });
    const keys = fetchMock.mock.calls.map(([, options]) => options.headers['Idempotency-Key']);
    const retry = sendBulkEmail(recipients, 'News', 'Content', false, undefined, id);
    await vi.runAllTimersAsync();
    await retry;
    expect(fetchMock.mock.calls.slice(2).map(([, options]) => options.headers['Idempotency-Key'])).toEqual(keys);
    expect(new Set(keys).size).toBe(2);
    for (const [, options] of fetchMock.mock.calls) expect(JSON.parse(options.body).to).toHaveLength(1);
  });
});
