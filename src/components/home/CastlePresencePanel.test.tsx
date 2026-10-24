// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CastlePresencePanel } from './CastlePresencePanel';
import type { useCastlePresence } from '@/hooks/useCastlePresence';
afterEach(cleanup);
function model(): ReturnType<typeof useCastlePresence> { return { view: { scope: 'church', status: 'ready', roster: null, receivedAt: 0, message: '' }, join: vi.fn(), leave: vi.fn(), retry: vi.fn(), move: vi.fn() }; }
it('requires explicit alias and preset consent rather than turning a login into an avatar', () => { const presence = model(); render(<MemoryRouter><CastlePresencePanel presence={presence} signedIn/></MemoryRouter>); expect(presence.join).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '加入城堡' })); expect(presence.join).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('城堡暱稱'), { target: { value: '我的暱稱' } }); fireEvent.change(screen.getByLabelText('玩偶配色'), { target: { value: 'coral' } }); fireEvent.click(screen.getByRole('button', { name: '確認加入城堡' })); expect(presence.join).toHaveBeenCalledWith({ alias: '我的暱稱', preset: 'coral' }); });
it('gives guests a real login route and no join action', () => { const presence = model(); presence.view.scope = null; render(<MemoryRouter><CastlePresencePanel presence={presence} signedIn={false}/></MemoryRouter>); expect(screen.getByRole('link', { name: '登入加入' }).getAttribute('href')).toBe('/login'); expect(screen.queryByRole('button', { name: '加入城堡' })).toBeNull(); });
