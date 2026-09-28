// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MePage from './MePage';
import MyNotesPage from './MyNotesPage';
import { AdminPage } from './AdminPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-member', email: 'test@example.invalid' }, loading: false, signOut: vi.fn() }) }));
const roleState = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ role: roleState.isAdmin ? 'admin' : 'pastor', isAdmin: roleState.isAdmin, canCreateSession: true, loading: false }) }));
vi.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock('@/hooks/useFeatureToggles', () => ({ useFeatureToggles: () => ({ isFeatureEnabled: () => true, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
vi.mock('@/components/user/ProfileSettingsDialog', () => ({ ProfileSettingsDialog: () => null }));
vi.mock('@/components/user/LineAccountLink', () => ({ LineAccountLink: () => null }));
vi.mock('@/components/scripture/ImportedReadingHistory', () => ({ ImportedReadingHistory: () => null }));
vi.mock('@/components/admin/PlatformMaturityPanel', () => ({ PlatformMaturityPanel: () => <div>系統紀錄內容</div> }));
vi.mock('@/components/auth/AuthForm', () => ({ AuthForm: () => null }));

function mount(element: React.ReactNode) {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
  return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); roleState.isAdmin = true; });

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

it('loads system records only when an administrator opens the disclosure', async () => {
  mount(<AdminPage />);
  await screen.findByText('系統紀錄');
  expect(screen.queryByText('系統紀錄內容')).toBeNull();
  const disclosure = screen.getByText('系統紀錄').closest('details')!;
  disclosure.open = true; fireEvent(disclosure, new Event('toggle'));
  expect(await screen.findByText('系統紀錄內容')).toBeVisible();
  disclosure.open = false; fireEvent(disclosure, new Event('toggle'));
  await waitFor(() => expect(screen.queryByText('系統紀錄內容')).toBeNull());
});

it('does not offer administrator telemetry to pastoral roles', async () => {
  roleState.isAdmin = false;
  mount(<AdminPage />);
  await screen.findByTestId('button-crm');
  expect(screen.queryByText('系統紀錄')).toBeNull();
});
