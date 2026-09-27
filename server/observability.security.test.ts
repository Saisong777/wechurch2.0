import { beforeEach, expect, it, vi } from 'vitest';
import type { Request } from 'express';

const { values } = vi.hoisted(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./db', () => ({ db: { insert: vi.fn(() => ({ values })) } }));
import { recordAppEvent, recordErrorEvent, recordAiUsage, requestContext } from './observability';

beforeEach(() => values.mockClear());

it('scrubs direct event submissions independently of the browser', async () => {
  await recordAppEvent({
    eventName: 'page_view', path: '/reset-password?token=SECRET#SECRET',
    metadata: { search: '?token=SECRET', nested: { password: 'SECRET' }, referrer: 'https://example.test/path?token=SECRET', viewport: '800x600' },
    userAgent: 'Browser token=SECRET',
  });
  const row = values.mock.calls[0][0];
  expect(JSON.stringify(row)).not.toContain('SECRET');
  expect(row.path).toBe('/reset-password');
  expect(row.metadata).toEqual({ referrer: 'https://example.test', viewport: '800x600' });
});

it('scrubs error messages, stacks, filenames and AI errors before persistence', async () => {
  await recordErrorEvent({ message: 'Failed /reset?token=SECRET', stack: 'Error: token=SECRET\n at run (/app.js#SECRET)', path: '/page#SECRET', metadata: { filename: '/app.js?token=SECRET', lineno: 10 } });
  await recordAiUsage({ provider: 'test', model: 'test', feature: 'test', status: 'error', errorMessage: 'Authorization: Bearer SECRET' });
  expect(JSON.stringify(values.mock.calls)).not.toContain('SECRET');
  expect(values.mock.calls[0][0]).toMatchObject({ path: '/page', metadata: { filename: '/app.js', lineno: 10 } });
});

it('strips request URL query and fragment without needing a live request', () => {
  const req = { originalUrl: '/path?token=SECRET#SECRET', path: '/path', method: 'GET', get: () => undefined } as unknown as Request;
  expect(requestContext(req).path).toBe('/path');
});

it('does not echo failed database parameters to the fallback log', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  values.mockRejectedValueOnce(new Error('query parameters: token=SECRET'));
  await recordErrorEvent({ message: 'failure' });
  expect(log).toHaveBeenCalledWith('[observability] failed to record error event');
  expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
  log.mockRestore();
});
