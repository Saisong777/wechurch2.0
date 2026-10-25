// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { defaultCastleProfile } from '@shared/castleAvatar';
const network = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/churchFetch', () => ({ churchFetch: network.fetch }));
import { useCastleAvatarProfile } from './useCastleAvatarProfile';
const receipt = { profile: defaultCastleProfile('A'), revision: 1 }, response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const flush = () => act(async () => {
    for (let i = 0; i < 8; i++)
        await Promise.resolve();
});
beforeEach(() => {
    network.fetch.mockReset();
    network.fetch.mockResolvedValue(response(receipt));
});
afterEach(cleanup);
it('loads only when open, saves using the server revision and accepts only a strict server receipt', async () => {
    const view = renderHook(({ open }) => useCastleAvatarProfile('account/church', open), { initialProps: { open: false } });
    await flush();
    expect(network.fetch).not.toHaveBeenCalled();
    view.rerender({ open: true });
    await flush();
    expect(view.result.current.state.data?.revision).toBe(1);
    network.fetch.mockResolvedValue(response({ ...receipt, revision: 2 }));
    await act(async () => {
        await view.result.current.save({ ...receipt.profile, outfit: 'skirt' });
    });
    expect(JSON.parse(network.fetch.mock.calls.at(-1)![1].body)).toMatchObject({ expectedRevision: 1, profile: { outfit: 'skirt' } });
    expect(view.result.current.state.data?.revision).toBe(2);
});
it('keeps the editable draft on CAS conflict and explicitly reloads for reconciliation', async () => {
    const view = renderHook(() => useCastleAvatarProfile('account', true));
    await flush();
    network.fetch.mockResolvedValue(response({ error: '另一視窗已更新' }, 409));
    await act(async () => {
        expect(await view.result.current.save(receipt.profile)).toBeNull();
    });
    expect(view.result.current.state.conflict).toBe(true);
    expect(view.result.current.state.data).toEqual(receipt);
    network.fetch.mockResolvedValue(response({ ...receipt, revision: 4 }));
    await act(async () => {
        await view.result.current.load();
    });
    expect(view.result.current.state.data?.revision).toBe(4);
});
it('aborts closing and account changes even when the old JSON decoder resolves late', async () => {
    let decode!: (value: unknown) => void;
    network.fetch.mockResolvedValue({ ok: true, json: () => new Promise(r => decode = r) });
    const view = renderHook(({ scope, open }) => useCastleAvatarProfile(scope, open), { initialProps: { scope: 'old', open: true } });
    await flush();
    const signal = network.fetch.mock.calls[0][1].signal;
    view.rerender({ scope: 'new', open: false });
    await flush();
    await act(async () => decode(receipt));
    expect(signal.aborted).toBe(true);
    expect(view.result.current.state.data).toBeNull();
    expect(view.result.current.state.scope).toBe('new');
});
it('does not claim a save succeeded when the connection or receipt is uncertain', async () => {
    const view = renderHook(() => useCastleAvatarProfile('account', true));
    await flush();
    network.fetch.mockRejectedValue(Error('network'));
    await act(async () => {
        expect(await view.result.current.save(receipt.profile)).toBeNull();
    });
    expect(view.result.current.state.error).toContain('尚未確認');
    expect(view.result.current.state.data?.revision).toBe(1);
});

it('bounds a hung PUT, releases saving and ignores its late receipt while allowing explicit reconciliation', async () => {
    vi.useFakeTimers();
    try {
        const view = renderHook(() => useCastleAvatarProfile('account', true));
        await flush();
        let finish!: (response: Response) => void;
        network.fetch.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
        let result: unknown;
        act(() => { void view.result.current.save(receipt.profile).then(value => { result = value; }); });
        expect(view.result.current.state.saving).toBe(true);
        await act(async () => vi.advanceTimersByTimeAsync(20001));
        expect(view.result.current.state.saving).toBe(false);
        expect(view.result.current.state.error).toContain('尚未確認');
        expect(result).toBeNull();
        await act(async () => finish(response({ ...receipt, revision: 2 })));
        expect(view.result.current.state.data?.revision).toBe(1);
        network.fetch.mockResolvedValue(response({ ...receipt, revision: 2 }));
        await act(async () => { await view.result.current.load(); });
        expect(view.result.current.state.data?.revision).toBe(2);
    } finally { vi.useRealTimers(); }
});
