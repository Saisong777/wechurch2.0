// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CastlePresencePanel } from './CastlePresencePanel';
import type { useCastlePresence } from '@/hooks/useCastlePresence';
afterEach(cleanup);
function model(): ReturnType<typeof useCastlePresence> {
    return { view: { scope: 'church', status: 'ready', roster: null, receivedAt: 0, message: '' }, join: vi.fn(), leave: vi.fn(), retry: vi.fn(), move: vi.fn(), refresh: vi.fn() };
}
it('opens the account wardrobe without a second consent form and lets explicit leavers re-enter', () => {
    const presence = model(), open = vi.fn();
    render(<MemoryRouter><CastlePresencePanel presence={presence} signedIn onWardrobe={open}/></MemoryRouter>);
    const button = screen.getByRole('button', { name: '我的造型' });
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith(button);
    expect(presence.join).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('城堡暱稱')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新入場' }));
    expect(presence.join).toHaveBeenCalledTimes(1);
});
it('gives guests a real login route and unconfirmed members no avatar or editor', () => {
    const presence = model();
    presence.view.scope = null;
    const view = render(<MemoryRouter><CastlePresencePanel presence={presence} signedIn={false} onWardrobe={vi.fn()}/></MemoryRouter>);
    expect(screen.getByRole('link', { name: '登入加入' }).getAttribute('href')).toBe('/login');
    view.rerender(<MemoryRouter><CastlePresencePanel presence={presence} signedIn onWardrobe={vi.fn()}/></MemoryRouter>);
    expect(screen.getByText('等待教會確認')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '我的造型' })).toBeNull();
});
it('keeps errors/retry and leave separate from changing clothes', () => {
    const presence = model();
    presence.view.status = 'expired';
    const view = render(<MemoryRouter><CastlePresencePanel presence={presence} signedIn onWardrobe={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '重新連線' }));
    expect(presence.retry).toHaveBeenCalledTimes(1);
    presence.view.status = 'joined';
    view.rerender(<MemoryRouter><CastlePresencePanel presence={presence} signedIn onWardrobe={vi.fn()}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '離開' }));
    expect(presence.leave).toHaveBeenCalledTimes(1);
});
