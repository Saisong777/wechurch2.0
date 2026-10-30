// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCastleProfile } from '@shared/castleAvatar';
const network = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/churchFetch', () => ({ churchFetch: network.fetch }));
import { useCastlePresence } from './useCastlePresence';
const epoch = '11111111-1111-4111-8111-111111111111', avatarId = '22222222-2222-4222-8222-222222222222';
const avatar = { avatarId, alias: '我', preset: 'jade', isSelf: true, motion: { sequence: 0, path: [[0, 15]], startedAt: 1000, durationMs: 0 } };
const roster = (avatars: any[] = [], serverNow = 1000) => ({ instanceEpoch: epoch, serverNow, ttlMs: 25000, avatars });
const response = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const profile = { profile: defaultCastleProfile('我'), revision: 0 };
const joined = { ...roster([avatar]), avatarId, leaseToken: 'x'.repeat(43) };
const flush = () => act(async () => {
    for (let i = 0; i < 12; i++)
        await Promise.resolve();
});
function normal(url: string) {
    return response(url.endsWith('/profile') ? profile : url.endsWith('/join') ? joined : url.endsWith('/leave') ? { ok: true } : roster([avatar]));
}
beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    network.fetch.mockReset();
    network.fetch.mockImplementation(async (url: string) => normal(url));
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});
describe('account-driven scoped castle presence', () => {
    it('never creates a guest, then automatically reads the account and joins without leaking an alias body', async () => {
        const view = renderHook(({ scope }) => useCastlePresence(scope), { initialProps: { scope: null as string | null } });
        await flush();
        expect(network.fetch).not.toHaveBeenCalled();
        view.rerender({ scope: 'member/church' });
        await flush();
        expect(view.result.current.view.status).toBe('joined');
        const calls = network.fetch.mock.calls;
        expect(calls[0][0]).toContain('/join');
        expect(calls.some(([url]) => url.endsWith('/profile'))).toBe(false);
        expect(JSON.parse(calls[0][1].body)).toEqual({});
        expect(calls[0][1].headers['X-Castle-Protocol']).toBe('2');
        view.unmount();
        expect(network.fetch.mock.calls.some(([url, init]) => url.endsWith('/leave') && init.headers['X-Castle-Lease'] === 'x'.repeat(43) && init.keepalive)).toBe(true);
    });
    it('clears immediately on account/church change and ignores JSON resolving after abort', async () => {
        let decode!: (v: unknown) => void;
        network.fetch.mockResolvedValue({ ok: true, json: () => new Promise(resolve => decode = resolve) });
        const view = renderHook(({ scope }) => useCastlePresence(scope), { initialProps: { scope: 'old' as string | null } });
        await flush();
        view.rerender({ scope: null });
        await flush();
        await act(async () => decode(joined));
        expect(view.result.current.view.roster).toBeNull();
        expect(view.result.current.view.scope).toBeNull();
        expect(network.fetch).toHaveBeenCalledTimes(1);
    });
    it('keeps an out-of-order join lease while a newer manually refreshed roster is retained', async () => {
        let complete!: (v: unknown) => void;
        network.fetch.mockImplementation(async (url: string) => url.endsWith('/join') ? { ok: true, json: () => new Promise(resolve => complete = resolve) } : url.endsWith('/profile') ? response(profile) : response(roster([avatar], 2000)));
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        act(() => view.result.current.refresh());
        await flush();
        await act(async () => complete({ ...joined, serverNow: 1500 }));
        expect(view.result.current.view.status).toBe('joined');
        expect(view.result.current.view.roster?.serverNow).toBe(2000);
        act(() => view.result.current.leave());
        expect(network.fetch.mock.calls.some(([url, init]) => url.endsWith('/leave') && init.headers['X-Castle-Lease'] === 'x'.repeat(43))).toBe(true);
    });
    it('expires stale roster while respecting a long Retry-After cooldown', async () => {
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        network.fetch.mockResolvedValue(response({ error: 'slow' }, 429, { 'Retry-After': '60' }));
        await act(async () => vi.advanceTimersByTimeAsync(26000));
        expect(view.result.current.view.roster).toBeNull();
        expect(view.result.current.view.status).toBe('disconnected');
        expect(network.fetch.mock.calls.filter(([url]) => url.endsWith('/join'))).toHaveLength(1);
    });
    it('releases when hidden and automatically restores only desired presence; explicit leave survives hiding', async () => {
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(view.result.current.view.roster).toBeNull();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        await flush();
        expect(view.result.current.view.status).toBe('joined');
        act(() => view.result.current.leave());
        await flush();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        await flush();
        expect(view.result.current.view.status).toBe('ready');
        expect(network.fetch.mock.calls.filter(([url]) => url.endsWith('/join'))).toHaveLength(2);
    });
    it('coalesces movements and clears unauthorized sessions without automatically joining again', async () => {
        const moved: number[] = [];
        network.fetch.mockImplementation(async (url: string, init: RequestInit) => {
            if (url.endsWith('/move'))
                moved.push(JSON.parse(init.body as string).targetNode);
            return normal(url);
        });
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        act(() => {
            for (let i = 0; i < 50; i++)
                view.result.current.move(i % 16);
        });
        await act(async () => vi.advanceTimersByTimeAsync(1501));
        expect(moved).toEqual([1]);
        network.fetch.mockResolvedValue(response({ error: 'revoked' }, 401));
        await act(async () => vi.advanceTimersByTimeAsync(2100));
        expect(view.result.current.view.roster).toBeNull();
        expect(view.result.current.view.status).toBe('expired');
        const before = network.fetch.mock.calls.length;
        await act(async () => vi.advanceTimersByTimeAsync(30000));
        expect(network.fetch).toHaveBeenCalledTimes(before);
    });
    it('refreshes appearance without a second join or releasing the existing lease', async () => {
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        network.fetch.mockImplementation(async (url: string) => response({ ...roster([{ ...avatar, alias: '新名字' }]), serverNow: 2000 }));
        act(() => view.result.current.refresh());
        await flush();
        expect(view.result.current.view.roster?.avatars[0].alias).toBe('新名字');
        expect(network.fetch.mock.calls.filter(([url]) => url.endsWith('/join'))).toHaveLength(1);
        expect(network.fetch.mock.calls.some(([url]) => url.endsWith('/leave'))).toBe(false);
    });
});

it('sends a secure v4 movement command on a browser without randomUUID', async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    try {
        const view = renderHook(() => useCastlePresence('member/church'));
        await flush();
        act(() => view.result.current.move(2));
        await act(async () => vi.advanceTimersByTimeAsync(1501));
        const move = network.fetch.mock.calls.find(([url]) => url.endsWith('/move'));
        expect(move).toBeTruthy();
        expect(move![1].headers['X-Castle-Command-ID']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(JSON.parse(move![1].body)).toEqual({ targetNode: 2 });
    }
    finally {
        vi.unstubAllGlobals();
    }
});
