// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MePage from './MePage';
import MyNotesPage from './MyNotesPage';
import { AdminPage } from './AdminPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-member', email: 'test@example.invalid' }, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ role: 'admin', isAdmin: true, canCreateSession: true, loading: false }) }));
vi.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock('@/hooks/useFeatureToggles', () => ({ useFeatureToggles: () => ({ isFeatureEnabled: () => true, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
vi.mock('@/components/user/ProfileSettingsDialog', () => ({ ProfileSettingsDialog: () => null }));
vi.mock('@/components/user/LineAccountLink', () => ({ LineAccountLink: () => null }));
vi.mock('@/components/scripture/ImportedReadingHistory', () => ({ ImportedReadingHistory: () => null }));
vi.mock('@/components/admin/PlatformMaturityPanel', () => ({ PlatformMaturityPanel: () => null }));
vi.mock('@/components/auth/AuthForm', () => ({ AuthForm: () => null }));

function mount(element: React.ReactNode) {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
  return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('removes deferred destinations even when every database feature toggle is enabled', () => {
  mount(<MePage />);
  const links = screen.getAllByRole('link').map(el => el.getAttribute('href'));
  expect(links).not.toContain('/user');
  expect(links).not.toContain('/user/notebook');
  expect(links).toContain('/learn/my-notes');
  expect(links).toContain('/support');
});

it('keeps the two active note types and does not fetch deferred study records', async () => {
  const fetcher = mount(<MyNotesPage />);
  await screen.findByText('尚無經文感動');
  expect(screen.getAllByRole('tab').map(el => el.textContent)).toEqual(['讀經計劃', '靈修筆記']);
  expect(screen.queryByText(/Soul ?Gym/)).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('/api/notebook'))).toBe(false);
});

it('keeps active admin tools without session creation or host steps', async () => {
  mount(<AdminPage />);
  await waitFor(() => expect(screen.getByTestId('button-crm')).toBeVisible());
  expect(screen.getByTestId('button-church-devotions')).toBeVisible();
  expect(screen.getByTestId('button-mail-system')).toBeVisible();
  expect(screen.queryByTestId('button-create-session')).toBeNull();
  expect(screen.queryByTestId('button-history')).toBeNull();
  expect(screen.queryByText(/SoulGym|查經主持流程|一頁式主持台/)).toBeNull();
});
