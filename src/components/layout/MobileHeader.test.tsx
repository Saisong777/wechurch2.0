// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { Header } from './Header';
import { MobileAccountActions } from './MobileAccountActions';

const auth = vi.hoisted(() => ({ user: null as null | { email: string }, loading: false, signOut: vi.fn() }));
const role = vi.hoisted(() => ({ isAdmin: false, isLeader: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role }));
vi.mock('@/components/user/ProfileSettingsDialog', () => ({ ProfileSettingsDialog: () => null }));
vi.mock('./NetworkStatusBanner', () => ({ NetworkStatusBanner: () => null }));
beforeEach(() => { auth.user = null; auth.loading = false; role.isAdmin = false; role.isLeader = false; auth.signOut.mockReset(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('merges page actions into the shared mobile menu and removes them after navigation', () => {
  const action = vi.fn();
  function Page() { return useLocation().pathname === '/' ? <Header rightContent={<button onClick={action}>字級</button>} /> : <Header title="關懷" />; }
  render(<MemoryRouter><AppLayout><Page /></AppLayout></MemoryRouter>);
  expect(screen.getByTestId('page-header')).toHaveClass('hidden', 'md:block');
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  fireEvent.click(within(screen.getByTestId('mobile-page-actions')).getByRole('button', { name: '字級' }));
  expect(action).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTestId('mobile-menu-care'));
  expect(screen.getByTestId('mobile-page-actions')).toBeEmptyDOMElement();
  expect(screen.queryByTestId('nav-bottom')).toBeNull();
});

it('preserves the dedicated header on login pages', () => {
  render(<MemoryRouter initialEntries={['/login']}><AppLayout><Header /></AppLayout></MemoryRouter>);
  expect(screen.getByTestId('page-header')).not.toHaveClass('hidden');
  expect(screen.queryByTestId('mobile-navigation')).toBeNull();
});

it('offers login for guests without administrator actions', () => {
  const close = vi.fn();
  render(<MemoryRouter><MobileAccountActions close={close} /></MemoryRouter>);
  expect(screen.queryByText('管理後台')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: '登入' }));
  expect(close).toHaveBeenCalledOnce();
});

it.each(['member', 'leader', 'admin'])('preserves account actions for %s', access => {
  auth.user = { email: 'test@example.test' }; role.isAdmin = access === 'admin'; role.isLeader = access === 'leader';
  render(<MemoryRouter><MobileAccountActions close={vi.fn()} /></MemoryRouter>);
  expect(!!screen.queryByRole('link', { name: '管理後台' })).toBe(access !== 'member');
  expect(screen.getByRole('button', { name: '登出' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: '登入' })).toBeNull();
});

it('does not sign out until confirmed', async () => {
  auth.user = { email: 'test@example.test' };
  const close = vi.fn();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<MemoryRouter><MobileAccountActions close={close} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '登出' }));
  expect(auth.signOut).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '登出' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(auth.signOut).toHaveBeenCalledOnce();
});
