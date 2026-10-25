// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { defaultCastleProfile } from '@shared/castleAvatar';
const network = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/churchFetch', () => ({ churchFetch: network.fetch }));
vi.mock('./castle/CastleAvatarPreview', () => ({ default: ({ appearance }: {
        appearance: import('@shared/castleAvatar').CastleAppearance;
    }) => <div data-testid="actual-model-preview" data-look={JSON.stringify(appearance)}/> }));
import CastleAvatarWardrobe from './CastleAvatarWardrobe';
beforeEach(() => {
    network.fetch.mockReset();
});
afterEach(cleanup);
it('previews independent appearance choices before saving and sends the account CAS contract only on save', async () => {
    const profile = defaultCastleProfile('暱稱');
    network.fetch.mockImplementation(async (_url: string, init: RequestInit) => new Response(JSON.stringify(init.method === 'PUT' ? { profile: JSON.parse(init.body as string).profile, revision: 1 } : { profile, revision: 0 })));
    const saved = vi.fn(), close = vi.fn();
    render(<CastleAvatarWardrobe scope="account" open onOpenChange={close} onSaved={saved} returnFocus={{ current: null }}/>);
    await screen.findByLabelText('城堡暱稱');
    fireEvent.click(screen.getByRole('radio', { name: '女生' }));
    fireEvent.click(screen.getByRole('radio', { name: '外套' }));
    fireEvent.click(screen.getByRole('radio', { name: '銀灰' }));
    expect(screen.getByTestId('actual-model-preview').getAttribute('data-look')).toContain('jacket');
    expect(network.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '儲存造型' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(close).toHaveBeenCalledWith(false);
    expect(JSON.parse(network.fetch.mock.calls[1][1].body)).toMatchObject({ expectedRevision: 0, profile: { genderPresentation: 'female', outfit: 'jacket', hairColor: 'silver' } });
});
it('cancel never saves and a failed receipt keeps choices open with a retryable explanation', async () => {
    network.fetch.mockImplementation(async (_url: string, init: RequestInit) => init.method === 'PUT' ? new Response(JSON.stringify({ error: '另一視窗已更新' }), { status: 409 }) : new Response(JSON.stringify({ profile: defaultCastleProfile(), revision: 1 })));
    const close = vi.fn(), saved = vi.fn();
    render(<CastleAvatarWardrobe scope="a" open onOpenChange={close} onSaved={saved} returnFocus={{ current: null }}/>);
    await screen.findByLabelText('城堡暱稱');
    fireEvent.click(screen.getByRole('radio', { name: '裙裝' }));
    fireEvent.click(screen.getByRole('button', { name: '儲存造型' }));
    expect((await screen.findByRole('alert')).textContent).toContain('另一視窗');
    expect(screen.getByRole('radio', { name: '裙裝' })).toBeChecked();
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(close).toHaveBeenCalledWith(false);
    expect(network.fetch.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(1);
});

it('blocks cancel, X, Escape and outside dismissal until the save settles', async () => {
    let finish!: (response: Response) => void;
    network.fetch.mockImplementation(async (_url: string, init: RequestInit) => init.method === 'PUT'
        ? new Promise<Response>(resolve => { finish = resolve; })
        : new Response(JSON.stringify({ profile: defaultCastleProfile(), revision: 0 })));
    const close = vi.fn(), saved = vi.fn();
    render(<CastleAvatarWardrobe scope="account" open onOpenChange={close} onSaved={saved} returnFocus={{ current: null }} />);
    await screen.findByLabelText('城堡暱稱');
    fireEvent.click(screen.getByRole('button', { name: '儲存造型' }));
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '關閉我的造型' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('正在儲存');
    await act(async () => finish(new Response(JSON.stringify({ profile: defaultCastleProfile(), revision: 1 }))));
    expect(saved).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith(false);
});

it('shows a church refresh action instead of a CAS reload and disables stale choices/save', async () => {
    network.fetch.mockImplementation(async (_url: string, init: RequestInit) => new Response(JSON.stringify(init.method === 'PUT'
        ? { error: '教會已變更', code: 'CHURCH_CONTEXT_CHANGED' } : { profile: defaultCastleProfile(), revision: 1 }), { status: init.method === 'PUT' ? 409 : 200 }));
    render(<CastleAvatarWardrobe scope="account" open onOpenChange={vi.fn()} onSaved={vi.fn()} returnFocus={{ current: null }}/>);
    await screen.findByLabelText('城堡暱稱');
    fireEvent.click(screen.getByRole('button', { name: '儲存造型' }));
    const refresh = await screen.findByRole('link', { name: '重新整理並確認教會' });
    expect(refresh.getAttribute('href')).toBe('/');
    expect(screen.queryByRole('button', { name: /載入帳號已存/ })).toBeNull();
    expect(screen.getByRole('button', { name: '儲存造型' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '便服' })).toBeDisabled();
});
it('reveals save errors only within its own scroll viewport, keeps focus, and names the reload replacement', async () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('castle-wardrobe-scroll'))
            return { top: 100, bottom: 300 } as DOMRect;
        if (this.getAttribute('role') === 'alert')
            return { top: -300, bottom: -250 } as DOMRect;
        return original.call(this);
    });
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    });
    try {
        network.fetch.mockImplementation(async (_url: string, init: RequestInit) => new Response(JSON.stringify(init.method === 'PUT'
            ? { error: '另一視窗已更新' } : { profile: defaultCastleProfile(), revision: 1 }), { status: init.method === 'PUT' ? 409 : 200 }));
        render(<CastleAvatarWardrobe scope="account" open onOpenChange={vi.fn()} onSaved={vi.fn()} returnFocus={{ current: null }}/>);
        await screen.findByLabelText('城堡暱稱');
        const viewport = document.querySelector<HTMLElement>('.castle-wardrobe-scroll')!;
        viewport.scrollTop = 500;
        const submit = screen.getByRole('button', { name: '儲存造型' });
        submit.focus();
        fireEvent.click(submit);
        expect(await screen.findByRole('button', { name: '載入帳號已存造型（取代目前選項）' })).toBeTruthy();
        expect(viewport.scrollTop).toBe(92);
        expect(document.activeElement).toBe(submit);
        expect(pageScroll).not.toHaveBeenCalled();
    }
    finally {
        bounds.mockRestore();
        pageScroll.mockRestore();
    }
});
