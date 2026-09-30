// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';
import { AppLayout } from './AppLayout';
import { MobileNavigation } from './MobileNavigation';
import { mobilePageTitle } from '@/lib/navigation';

vi.mock('./NetworkStatusBanner', () => ({ NetworkStatusBanner: () => null }));
vi.mock('./MobileAccountActions', () => ({ MobileAccountActions: () => null }));
vi.mock('@/components/notifications/NotificationBell',() => ({NotificationBell:() => null}));
beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); window.history.replaceState({ idx: 0 }, ''); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('renders an in-flow footer without a portal or viewport height', () => {
  const view = render(<MemoryRouter><BottomNav /></MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: '頁尾導覽' });
  expect(nav.parentElement).toBe(view.container);
  expect(nav).not.toHaveClass('fixed', 'absolute', 'sticky');
  expect(nav.style.height).toBe('');
  expect(screen.queryByTestId('nav-bottom-dock')).toBeNull();
  expect(within(nav).getAllByRole('link')).toHaveLength(5);
});

it('returns to the top when the current footer destination is selected', () => {
  render(<MemoryRouter initialEntries={['/']}><BottomNav /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('nav-link-home'));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
});

it('keeps the menu collapsed until requested, with explicit expanded state', () => {
  render(<MemoryRouter><MobileNavigation /></MemoryRouter>);
  const button = screen.getByRole('button', { name: '開啟導覽選單' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(within(screen.getByRole('navigation', { name: '行動導覽選單' })).getAllByRole('link')).toHaveLength(8);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

it('dismisses on outside interaction and keeps the existing destination order', () => {
  render(<MemoryRouter><MobileNavigation /><main>內容</main></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  expect(screen.getAllByRole('link').slice(1).map(el => el.getAttribute('href'))).toEqual(['/', '/learn/bible', '/share', '/walls', '/groups', '/care', '/me', '/play']);
  fireEvent.pointerDown(screen.getByRole('main'));
  expect(screen.queryByRole('navigation')).toBeNull();
});

it('prioritizes daily destinations while retaining all appearance choices', () => {
  render(<MemoryRouter><MobileNavigation /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  const menu = screen.getByRole('navigation', { name: '行動導覽選單' });
  const appearance = within(menu).getByRole('region', { name: '外觀' });
  const daily = within(menu).getByRole('region', { name: '日常與同行' });
  expect(daily.compareDocumentPosition(appearance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(daily).getAllByRole('link')).toHaveLength(6);
  expect(within(daily).getByTestId('mobile-menu-care')).toHaveAttribute('href', '/care');
  expect(within(within(appearance).getByRole('group', { name: '顯示模式' })).getAllByRole('radio').map(el => el.textContent)).toEqual(['明亮', '深色', '跟隨系統']);
  expect(within(appearance).getByText('文字大小與字型')).toBeInTheDocument();
  expect(within(menu).getAllByRole('group', { name: '顯示模式' })).toHaveLength(1);
  expect(within(menu).getAllByRole('link')).toHaveLength(8);
});

it('navigates, closes the menu and marks the active destination', () => {
  function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
  render(<MemoryRouter><AppLayout><Location /></AppLayout></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  fireEvent.click(screen.getByTestId('mobile-menu-learn'));
  expect(screen.getByTestId('location')).toHaveTextContent('/learn/bible');
  expect(screen.queryByRole('navigation', { name: '行動導覽選單' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  expect(screen.getByTestId('mobile-menu-learn')).toHaveAttribute('aria-current', 'page');
});

it.each([0, 1])('returns home for deep links and to the previous route for app history (idx %s)', idx => {
  window.history.replaceState({ idx }, '');
  function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
  render(<MemoryRouter initialEntries={['/share', '/learn/church-reading']} initialIndex={1}><MobileNavigation /><Location /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '返回上一頁' }));
  expect(screen.getByTestId('location').textContent).toBe(idx === 0 ? '/' : '/share');
});

it('has one shared sticky navigation outside page headers with no extra bottom space', () => {
  render(<MemoryRouter><AppLayout><header>標題</header><main>內容</main></AppLayout></MemoryRouter>);
  const bar = screen.getByTestId('mobile-navigation');
  expect(bar).toHaveClass('sticky', 'top-0', 'md:hidden');
  expect(bar).not.toHaveClass('fixed');
  expect(bar.style.height).toBe('');
  expect(screen.getByRole('main').parentElement).toHaveClass('mobile-page-content');
  expect(screen.getByRole('main').parentElement).not.toHaveClass('mobile-nav-content');
  expect(screen.queryByTestId('nav-bottom')).toBeNull();
  expect(screen.queryByRole('navigation', { name: '頁尾導覽' })).toBeNull();
});

it.each(['/login', '/admin/crm', '/user/study/session'])('preserves dedicated navigation on %s', path => {
  render(<MemoryRouter initialEntries={[path]}><AppLayout><main>內容</main></AppLayout></MemoryRouter>);
  expect(screen.queryByTestId('mobile-navigation')).toBeNull();
  expect(screen.queryByTestId('nav-bottom')).toBeNull();
});

it('labels nested destinations specifically', () => {
  expect(mobilePageTitle('/learn/church-reading')).toBe('每日靈修');
  expect(mobilePageTitle('/groups/123')).toBe('我的小家');
  expect(mobilePageTitle('/me')).toBe('個人設定');
  expect(mobilePageTitle('/support')).toBe('尋求陪伴');
  expect(mobilePageTitle('/work/mentoring')).toBe('門訓陪伴');
  expect(mobilePageTitle('/work/settings')).toBe('陪伴設定');
  expect(mobilePageTitle('/work')).toBe('同工工作區');
  expect(mobilePageTitle('/unavailable')).toBe('WeChurch');
});

it('closes the mobile menu when returning home through the page title', () => {
  render(<MemoryRouter initialEntries={['/learn/my-notes']}><MobileNavigation /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  fireEvent.click(screen.getByRole('link', { name: '我的筆記，回首頁' }));
  expect(screen.queryByRole('navigation', { name: '行動導覽選單' })).toBeNull();
});

it('keeps navigation available when a page throws and recovers on a new route', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Page() { if (useLocation().pathname === '/') throw new Error('test page failure'); return <main>已恢復</main>; }
  render(<MemoryRouter><AppLayout><Page /></AppLayout></MemoryRouter>);
  expect(screen.getByText('這個頁面暫時無法載入')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }));
  fireEvent.click(screen.getByTestId('mobile-menu-learn'));
  expect(screen.getByRole('main')).toHaveTextContent('已恢復');
  consoleError.mockRestore();
});
