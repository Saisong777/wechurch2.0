import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { withRequestTimeout } from './requestTimeout';
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};
beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
it('returns success without AbortSignal static helpers and removes the caller listener and timer', async () => {
    const caller = new AbortController(), add = vi.spyOn(caller.signal, 'addEventListener'), remove = vi.spyOn(caller.signal, 'removeEventListener');
    let effective!: AbortSignal;
    expect(await withRequestTimeout(caller.signal, async (signal) => {
        effective = signal;
        return 'ok';
    })).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    caller.abort();
    expect(effective.aborted).toBe(false);
});
it('does not start any work for a pre-aborted caller', async () => {
    const caller = new AbortController(), work = vi.fn();
    caller.abort();
    await expect(withRequestTimeout(caller.signal, work)).rejects.toMatchObject({ name: 'AbortError' });
    expect(work).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
it('cancels during work and ignores its eventual completion without leaking cleanup', async () => {
    const caller = new AbortController(), remove = vi.spyOn(caller.signal, 'removeEventListener');
    let finish!: (value: string) => void, effective!: AbortSignal;
    const accepted = vi.fn();
    const result = withRequestTimeout(caller.signal, signal => {
        effective = signal;
        return new Promise<string>(resolve => {
            finish = resolve;
        });
    }).then(accepted, error => error);
    await flush();
    caller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(effective.aborted).toBe(true);
    finish('stale');
    await flush();
    expect(accepted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
});
it('enforces exactly 15 seconds even if work never observes abort', async () => {
    let signal!: AbortSignal;
    const result = withRequestTimeout(undefined, value => {
        signal = value;
        return new Promise(() => {
        });
    }).catch(error => error);
    await flush();
    await vi.advanceTimersByTimeAsync(14999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
});
it.each(['throw', 'reject'] as const)('cleans up a synchronous/asynchronous %s', async (mode) => {
    const caller = new AbortController(), remove = vi.spyOn(caller.signal, 'removeEventListener');
    await expect(withRequestTimeout(caller.signal, () => {
        if (mode === 'throw')
            throw Error('failed');
        return Promise.reject(Error('failed'));
    })).rejects.toThrow('failed');
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
});
