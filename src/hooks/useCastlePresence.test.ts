// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const network = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/churchFetch', () => ({ churchFetch: network.fetch }));
import { useCastlePresence } from './useCastlePresence';
const epoch = '11111111-1111-4111-8111-111111111111', avatarId = '22222222-2222-4222-8222-222222222222';
const avatar = { avatarId, alias: '我', preset: 'jade', isSelf: true, motion: { sequence: 0, path: [[0, 15]], startedAt: 1000, durationMs: 0 } };
const roster = (avatars: any[] = [], serverNow = 1000) => ({ instanceEpoch: epoch, serverNow, ttlMs: 25000, avatars });
const response = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); network.fetch.mockReset(); network.fetch.mockImplementation(async () => response(roster())); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('scoped castle presence client', () => {
    it('never joins or polls anonymously, joins only on consent and releases only its lease on unmount', async () => {
        const view = renderHook(({ scope }) => useCastlePresence(scope), { initialProps: { scope: null as string | null } });
        await flush();
        expect(network.fetch).not.toHaveBeenCalled();
        view.rerender({ scope: 'member/church' });
        await flush();
        expect(view.result.current.view.status).toBe('ready');
        expect(network.fetch.mock.calls.every(([url]) => url === '/api/castle-presence')).toBe(true);
        network.fetch.mockImplementation(async (url: string) => response(url.endsWith('/join') ? { ...roster([avatar]), avatarId, leaseToken: 'x'.repeat(43) } : url.endsWith('/leave') ? { ok: true } : roster([avatar])));
        act(() => view.result.current.join({ alias: '我', preset: 'jade' }));
        await flush();
        expect(view.result.current.view.status).toBe('joined');
        view.unmount();
        expect(network.fetch.mock.calls.some(([url, init]) => url.endsWith('/leave') && init.headers['X-Castle-Lease'] === 'x'.repeat(43) && init.keepalive)).toBe(true);
    });
    it('clears immediately on scope change and ignores JSON that resolves after abort', async () => { let decode!: (v: unknown) => void; network.fetch.mockResolvedValue({ ok: true, json: () => new Promise(resolve => decode = resolve) }); const view = renderHook(({ scope }) => useCastlePresence(scope), { initialProps: { scope: 'old' } }); await flush(); view.rerender({ scope: null as any }); await flush(); await act(async () => decode(roster([avatar]))); expect(view.result.current.view.roster).toBeNull(); expect(view.result.current.view.scope).toBeNull(); });
    it('handles a join body arriving after a newer roster and still retains the lease', async () => {
        let joined!: (v: unknown) => void;
        let now = 1000;
        network.fetch.mockImplementation(async (url: string) => url.endsWith('/join') ? { ok: true, json: () => new Promise(resolve => joined = resolve) } : response(roster(now > 1000 ? [avatar] : [], now)));
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        act(() => view.result.current.join({ alias: '我', preset: 'jade' }));
        await flush();
        now = 2000;
        await act(async () => vi.advanceTimersByTimeAsync(2000));
        await act(async () => joined({ ...roster([avatar], 1500), avatarId, leaseToken: 'x'.repeat(43) }));
        expect(view.result.current.view.status).toBe('joined');
        act(() => view.result.current.leave());
        expect(network.fetch.mock.calls.some(([url, init]) => url.endsWith('/leave') && init.headers['X-Castle-Lease'] === 'x'.repeat(43))).toBe(true);
    });
    it('expires a roster while obeying a long rate-limit cooldown', async () => { const view = renderHook(() => useCastlePresence('member/church')); await flush(); network.fetch.mockResolvedValue(response({ error: 'slow' }, 429, { 'Retry-After': '60' })); await act(async () => vi.advanceTimersByTimeAsync(26000)); expect(view.result.current.view.roster).toBeNull(); expect(view.result.current.view.status).toBe('disconnected'); expect(network.fetch).toHaveBeenCalledTimes(2); });
    it('hides and clears, then requires renewed consent rather than rejoining automatically', async () => {
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(view.result.current.view.roster).toBeNull();
        await act(async () => vi.advanceTimersByTimeAsync(10000));
        expect(network.fetch).toHaveBeenCalledTimes(1);
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        await flush();
        expect(view.result.current.view.status).toBe('ready');
        expect(network.fetch.mock.calls.every(([url]) => !url.endsWith('/join'))).toBe(true);
    });
    it('coalesces repeated movement to the latest destination and clears on authorization failure', async () => {
        const moved: number[] = [];
        network.fetch.mockImplementation(async (url: string, init: RequestInit) => { if (url.endsWith('/join'))
            return response({ ...roster([avatar]), avatarId, leaseToken: 'x'.repeat(43) }); if (url.endsWith('/move'))
            moved.push(JSON.parse(init.body as string).targetNode); return response(roster([avatar])); });
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        act(() => view.result.current.join({ alias: '我', preset: 'jade' }));
        await flush();
        act(() => { for (let i = 0; i < 50; i++)
            view.result.current.move(i % 16); });
        await act(async () => vi.advanceTimersByTimeAsync(1501));
        expect(moved).toEqual([1]);
        network.fetch.mockResolvedValue(response({ error: 'revoked' }, 401));
        await act(async () => vi.advanceTimersByTimeAsync(2100));
        expect(view.result.current.view.roster).toBeNull();
        expect(view.result.current.view.status).toBe('expired');
    });
});
