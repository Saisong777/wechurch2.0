// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { Header } from './Header';
import HelpPage from '@/pages/HelpPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useChurchOnboarding', () => ({ useChurchOnboarding: () => ({ isPending: false, isError: false }) }));
vi.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: false, isLeader: false }) }));
vi.mock('@/hooks/useAccessControl', () => ({ useAccessControl: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePastoralAccess', () => ({ usePastoralAccess: () => ({ data: { available: false } }) }));
vi.mock('@/components/user/ProfileSettingsDialog', () => ({ ProfileSettingsDialog: () => null }));
vi.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/onboarding/IntroductionTour', () => ({ IntroductionTour: () => null }));
vi.mock('@/components/onboarding/FirstChurchChoice', () => ({ FirstChurchChoice: () => null }));
vi.mock('./NetworkStatusBanner', () => ({ NetworkStatusBanner: () => null }));
vi.mock('./ChurchControl', () => ({ ChurchControl: () => null }));
beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output>; }

it('provides desktop and footer discovery without replacing existing navigation', () => {
  render(<MemoryRouter><Location /><AppLayout><Header /></AppLayout></MemoryRouter>);
  expect(within(screen.getByTestId('page-header')).getByRole('link', { name: '網站導覽' })).toHaveAttribute('href', '/sitemap');
  const footer = within(screen.getByRole('contentinfo'));
  expect(footer.getByRole('link', { name: '網站導覽' })).toHaveAttribute('href', '/sitemap');
  expect(footer.getByRole('link', { name: '使用說明' })).toHaveAttribute('href', '/help');
  expect(footer.getByRole('link', { name: '意見反饋' })).toHaveAttribute('href', '/feedback');
  expect(within(screen.getByTestId('nav-top')).getAllByRole('link')).toHaveLength(5);
});

it('opens the mobile site map entry, closes on navigation, and restores focus on Escape', () => {
  render(<MemoryRouter><Location /><AppLayout><Header /></AppLayout></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: '開啟導覽選單' });
  fireEvent.click(trigger);
  const link = screen.getByTestId('mobile-menu-sitemap');
  expect(link).toHaveAccessibleName('網站導覽');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByTestId('mobile-menu-sitemap'));
  expect(screen.getByTestId('location')).toHaveTextContent('/sitemap');
  expect(screen.getByRole('button', { name: '開啟導覽選單' })).toHaveAttribute('aria-expanded', 'false');
});

it('offers a direct site map entry from the usage guide', () => {
  render(<MemoryRouter initialEntries={['/help']}><HelpPage /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '開啟網站導覽' })).toHaveAttribute('href', '/sitemap');
});
