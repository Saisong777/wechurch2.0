// @vitest-environment jsdom
const pastoral = vi.hoisted(() => ({ data: { available: false } }));
vi.mock('@/hooks/usePastoralAccess', () => ({ usePastoralAccess: () => pastoral }));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileAccountActions } from './MobileAccountActions';

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false, signOut: vi.fn() }));
const roles = vi.hoisted(() => ({ isAdmin: false, isLeader: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => roles }));
afterEach(() => { cleanup(); pastoral.data.available = false; auth.user = null; roles.isAdmin = false; roles.isLeader = false; vi.restoreAllMocks(); auth.signOut.mockClear(); });
const renderActions = () => render(<MemoryRouter><MobileAccountActions close={vi.fn()} /></MemoryRouter>);

it('keeps staff destinations hidden from guests and ordinary members', () => {
  const view = renderActions();
  expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('region', { name: '同工管理' })).toBeNull();
  auth.user = { id: 'member' };
  view.rerender(<MemoryRouter><MobileAccountActions close={vi.fn()} /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: '登入' })).toBeNull();
  expect(screen.queryByRole('region', { name: '同工管理' })).toBeNull();
  expect(screen.getByRole('button', { name: '登出' })).toBeVisible();
});
it.each(['isAdmin', 'isLeader'] as const)('retains both existing work destinations for %s', role => {
  auth.user = { id: 'staff' }; roles[role] = true; renderActions();
  expect(screen.getByRole('link', { name: '同工工作區' })).toHaveAttribute('href', '/work');
  expect(screen.getByRole('link', { name: '管理後台' })).toHaveAttribute('href', '/admin');
});
it('does not sign out when the unsaved-content confirmation is cancelled', () => {
  auth.user = { id: 'member' }; vi.spyOn(window, 'confirm').mockReturnValue(false); renderActions();
  fireEvent.click(screen.getByRole('button', { name: '登出' }));
  expect(auth.signOut).not.toHaveBeenCalled();
});

it('shows the work entry for an appointed leader without granting the admin entry', () => {
  auth.user = { id: 'appointed-member' }; pastoral.data.available = true;
  renderActions();
  expect(screen.getByRole('link', { name: '同工工作區' })).toHaveAttribute('href', '/work');
  expect(screen.queryByRole('link', { name: '管理後台' })).toBeNull();
});
