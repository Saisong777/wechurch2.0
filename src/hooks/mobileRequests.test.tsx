// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { churchOnboardingRequest } from './useChurchOnboarding';
import { notificationRequest, useNotifications } from './useNotifications';
import { setChurchScope } from '@/lib/churchFetch';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' }, loading: false }) }));
vi.mock('@/contexts/ChurchContext', () => ({ useChurchContext: () => null, useChurchScopeKey: () => 'verified-scope' }));
const flush = async () => {
    for (let i = 0; i < 10; i++)
        await Promise.resolve();
};
const variants = [
    ['onboarding', (signal?: AbortSignal) => churchOnboardingRequest('/api/me/church-onboarding', { signal })],
    ['notifications', (signal?: AbortSignal) => notificationRequest('', undefined, signal)],
] as const;
beforeEach(() => {
    vi.useFakeTimers();
    class LegacySignal extends AbortSignal {
    }
    Object.defineProperties(LegacySignal, { any: { value: undefined }, timeout: { value: undefined } });
    vi.stubGlobal('AbortSignal', LegacySignal);
    setChurchScope({ actorId: 'member', actorChurch: 'IM 行動教會', selectedChurch: 'IM 行動教會', isSystemAdmin: false });
});
afterEach(() => {
    cleanup();
    setChurchScope(null, false);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
it.each(variants)('%s actual request works with neither AbortSignal static helper and retains scoped credentials', async (_name, run) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await run()).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-WeChurch-Church')).toBe(encodeURIComponent('IM 行動教會'));
});
it.each(variants)('%s does not send a pre-aborted caller request', async (_name, run) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const caller = new AbortController();
    caller.abort();
    await expect(run(caller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it.each(variants)('%s rejects cancellation while response headers are still pending and never starts late JSON parsing', async (_name, run) => {
    let headers!: (response: Response) => void;
    const json = vi.fn().mockResolvedValue({ private: 'stale' });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => {
        headers = resolve;
    })));
    const caller = new AbortController(), accepted = vi.fn();
    const result = run(caller.signal).then(accepted, error => error);
    await flush();
    caller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    headers({ ok: true, json } as unknown as Response);
    await flush();
    expect(json).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it.each(variants)('%s keeps the 15-second deadline through JSON decoding and ignores its late body', async (_name, run) => {
    let decode!: (data: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => {
            decode = resolve;
        }) }));
    const accepted = vi.fn(), result = run().then(accepted, error => error);
    await flush();
    await vi.advanceTimersByTimeAsync(14999);
    expect(accepted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    expect(vi.getTimerCount()).toBe(0);
    decode({ private: 'stale' });
    await flush();
    expect(accepted).not.toHaveBeenCalled();
});
it.each(variants)('%s rejects an upstream abort during JSON decoding and clears its timer', async (_name, run) => {
    let decode!: (data: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => {
            decode = resolve;
        }) }));
    const caller = new AbortController(), accepted = vi.fn(), result = run(caller.signal).then(accepted, error => error);
    await flush();
    caller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    decode({ private: 'stale' });
    await flush();
    expect(accepted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it.each(variants)('%s keeps church generation isolation for a decoded old body', async (_name, run) => {
    let decode!: (data: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => {
            decode = resolve;
        }) }));
    const accepted = vi.fn(), result = run().then(accepted, error => error);
    await flush();
    setChurchScope({ actorId: 'other', actorChurch: '火樂', selectedChurch: '火樂', isSystemAdmin: false });
    decode({ private: 'old member' });
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(accepted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it('retains onboarding server messages and mutation headers/body while cleaning errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '資料已鎖定' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(churchOnboardingRequest('/api/me/church-onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test': 'kept' }, body: '{"churchId":null}' })).rejects.toThrow('資料已鎖定');
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe('{"churchId":null}');
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('X-Test')).toBe('kept');
    expect(vi.getTimerCount()).toBe(0);
});
it('cleans a failed error body timeout rather than replacing cancellation with a generic onboarding error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: () => new Promise(() => {
        }) }));
    const result = churchOnboardingRequest('/api/me/church-onboarding').catch(error => error);
    await flush();
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    expect(vi.getTimerCount()).toBe(0);
});
it('passes the actual notification query cancellation signal through on unmount', async () => {
    let headers!: (response: Response) => void;
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(resolve => {
        headers = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const hook = renderHook(() => useNotifications(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(flush);
    const signal = fetchMock.mock.calls[0][1]!.signal as AbortSignal;
    hook.unmount();
    expect(signal.aborted).toBe(true);
    headers(new Response('{"private":"late"}'));
    await act(flush);
    expect(client.getQueryData(['/api/notifications', 'member', null, 'verified-scope'])).toBeUndefined();
    client.clear();
});
