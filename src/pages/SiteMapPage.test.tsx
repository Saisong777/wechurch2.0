// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MyAccess } from '@shared/accessControl';
import { pageRequiresAuthentication } from '@shared/pageAccessPolicy';
import SiteMapPage from './SiteMapPage';

const state = vi.hoisted(() => ({ user: null as { id: string } | null, role: { loading: false, isAdmin: false, isLeader: false }, access: undefined as MyAccess | undefined, accessError: false, pastoralAvailable: false, pastoralError: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => state.role }));
vi.mock('@/hooks/useAccessControl', () => ({ useAccessControl: () => ({ data: state.access, isError: state.accessError }) }));
vi.mock('@/hooks/usePastoralAccess', () => ({ usePastoralAccess: () => ({ data: { available: state.pastoralAvailable }, isError: state.pastoralError }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>網站導覽</header> }));
beforeEach(() => { state.user = null; state.role = { loading: false, isAdmin: false, isLeader: false }; state.access = undefined; state.accessError = false; state.pastoralAvailable = false; state.pastoralError = false; });
afterEach(cleanup);
function Location() { const location = useLocation(); return <div data-testid="location">{location.pathname + location.search}</div>; }
function App() { return <MemoryRouter initialEntries={['/sitemap']}><Location /><SiteMapPage /></MemoryRouter>; }

it('uses the shared page policy for guest login labels and returns to the selected destination', () => {
  render(<App />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('link', { name: '使用說明' })).toHaveAttribute('href', '/help');
  expect(main.getByRole('link', { name: '我的筆記，需登入' })).toHaveAttribute('href', '/login?returnTo=%2Flearn%2Fmy-notes');
  for (const link of main.getAllByRole('link').filter(link => !link.getAttribute('href')?.startsWith('#'))) {
    const href = link.getAttribute('href')!;
    if (href.startsWith('/login?returnTo=')) {
      const destination = new URL(href, 'https://test').searchParams.get('returnTo')!;
      expect(destination).toMatch(/^\/(?!\/)/);
      expect(pageRequiresAuthentication(destination.split('?')[0])).toBe(true);
      expect(link).toHaveAccessibleName(/需登入/);
    } else if (href !== '/login') expect(pageRequiresAuthentication(href.split('?')[0])).toBe(false);
  }
  fireEvent.click(main.getByRole('link', { name: '我的筆記，需登入' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/login?returnTo=%2Flearn%2Fmy-notes');
  expect(screen.queryByRole('region', { name: '同工管理' })).toBeNull();
});

it('searches and recovers an empty result, with focusable category destinations', () => {
  render(<App />);
  const search = screen.getByRole('searchbox', { name: '搜尋網站功能' });
  fireEvent.change(search, { target: { value: '預讀 明天' } });
  expect(screen.getByRole('status')).toHaveTextContent('找到 1 項功能');
  expect(screen.getByRole('link', { name: /^每日靈修/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /^我的小家/ })).toBeNull();
  const category = screen.getByRole('link', { name: '讀經與靈修' });
  expect(category).toHaveAttribute('href', '#sitemap-reading');
  expect(screen.getByRole('heading', { name: '讀經與靈修' })).toHaveAttribute('tabindex', '-1');
  fireEvent.change(search, { target: { value: '找不到的功能' } });
  expect(screen.getByRole('status')).toHaveTextContent('沒有符合的功能');
  fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }));
  expect(search).toHaveValue('');
  expect(screen.getByRole('link', { name: /^我的小家/ })).toBeTruthy();
});

it('updates member and staff discovery when identity and effective capabilities change', () => {
  const view = render(<App />);
  state.user = { id: 'member' };
  view.rerender(<App />);
  expect(screen.getByRole('link', { name: '我的筆記' })).toHaveAttribute('href', '/learn/my-notes');
  expect(screen.queryByRole('link', { name: '管理後台' })).toBeNull();
  state.access = { permissions: ['devotions.manage'], grants: [], canManageAccess: false, canEnterCrm: false, canEnterAdmin: true };
  view.rerender(<App />);
  expect(screen.getByRole('link', { name: '管理後台' })).toHaveAttribute('href', '/admin');
  expect(screen.getByRole('link', { name: '每日靈修課表管理' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: '角色與權限' })).toBeNull();
  state.accessError = true;
  view.rerender(<App />);
  expect(screen.queryByRole('link', { name: '管理後台' })).toBeNull();
  state.role.isLeader = true;
  view.rerender(<App />);
  expect(screen.getByRole('link', { name: '會員與牧養' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: '意見反饋管理' })).toBeNull();
  state.role.isAdmin = true;
  view.rerender(<App />);
  expect(screen.getByRole('link', { name: '角色與權限' })).toBeTruthy();
  state.user = null;
  view.rerender(<App />);
  expect(screen.queryByRole('link', { name: '管理後台' })).toBeNull();
});

it('shows appointment-based work only when pastoral access is confirmed', () => {
  state.user = { id: 'appointed-member' }; state.pastoralAvailable = true;
  const view = render(<App />);
  expect(screen.getByRole('link', { name: '同工工作區' })).toHaveAttribute('href', '/work');
  expect(screen.queryByRole('link', { name: '管理後台' })).toBeNull();
  state.pastoralError = true;
  view.rerender(<App />);
  expect(screen.queryByRole('link', { name: '同工工作區' })).toBeNull();
});
