// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: '女生' }));
    fireEvent.click(screen.getByRole('button', { name: '外套' }));
    fireEvent.click(screen.getByRole('button', { name: '銀灰' }));
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
    fireEvent.click(screen.getByRole('button', { name: '裙裝' }));
    fireEvent.click(screen.getByRole('button', { name: '儲存造型' }));
    expect((await screen.findByRole('alert')).textContent).toContain('另一視窗');
    expect(screen.getByRole('button', { name: '裙裝' }).getAttribute('aria-pressed')).toBe('true');
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(close).toHaveBeenCalledWith(false);
    expect(network.fetch.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(1);
});
