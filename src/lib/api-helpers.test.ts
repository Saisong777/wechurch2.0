import { afterEach, expect, it, vi } from 'vitest';
import { assignLatecomerToGroup, joinSession } from './api-helpers';

afterEach(() => vi.unstubAllGlobals());
it('uses the server-assigned latecomer group instead of sending a desired group', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ participant: { group_number: 3 } })));
  vi.stubGlobal('fetch', fetcher);
  expect(await assignLatecomerToGroup('member', 'session')).toBe(3);
  expect(fetcher.mock.calls[0][0]).toBe('/api/participants/member/late-join');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ sessionId: 'session' });
});
it('does not invent a group when assignment is denied', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
  expect(await assignLatecomerToGroup('member', 'session')).toBeNull();
});
it('shows the identity recovery error rather than a generic failed join', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '請聯絡管理員恢復身份' }), { status: 403 })));
  await expect(joinSession('session', 'Name', 'guest@example.test', 'male')).rejects.toThrow('請聯絡管理員恢復身份');
  vi.restoreAllMocks();
});
