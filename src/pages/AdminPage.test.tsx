// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from './AdminPage';

const fixture = vi.hoisted(() => ({ admin: false, appointed: false, user: { id: 'fixture', email: 'fixture@example.test' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: fixture.user, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ role: fixture.admin ? 'admin' : 'member', loading: false, isAdmin: fixture.admin, canCreateSession: fixture.admin }) }));
vi.mock('@/hooks/useAccessControl', () => ({ useAccessControl: () => ({ isPending: false, data: { grants: fixture.appointed ? [] : [{ roleName: '同工' }], permissions: fixture.appointed ? [] : ['members.read'], appointments: fixture.appointed ? [{groupId:'group',groupName:'測試小家',role:'group_leader'}] : [], canManageGroups: fixture.appointed, canEnterAdmin: true, canEnterCrm: true } }) }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
vi.mock('@/components/auth/AuthForm', () => ({ AuthForm: () => null }));
vi.mock('@/components/admin/CardQuestionManager', () => ({ CardQuestionManager: () => <h1>測試題庫</h1> }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: vi.fn(async () => ({ json: async () => ({ count: 0 }) })) }));

afterEach(() => { cleanup(); fixture.admin = false; fixture.appointed = false; });
it('shows the delegated ministry title without mislabeling a member as a future leader', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AdminPage /></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByTestId('button-crm')).toBeInTheDocument();
  expect(screen.getByTestId('admin-role-label')).toHaveTextContent('同工');
  expect(screen.queryByText('儲備')).not.toBeInTheDocument();
  expect(screen.queryByTestId('button-access-control')).not.toBeInTheDocument();
  expect(screen.queryByTestId('button-mail-system')).not.toBeInTheDocument();
  client.clear();
});

it('groups admin work without losing role-protected entries and clearly returns from tools', async () => {
  fixture.admin = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AdminPage /></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1, name: '管理後台' })).toBeVisible();
  expect(within(screen.getByRole('region', { name: '會友與牧養' })).getByTestId('button-crm')).toHaveTextContent('會員與牧養');
  expect(within(screen.getByRole('region', { name: '靈修與通知' })).getByTestId('button-mail-system')).toBeVisible();
  expect(within(screen.getByRole('region', { name: '工具與設定' })).getByTestId('button-access-control')).toBeVisible();
  expect(screen.getByRole('link', { name: '返回首頁' }).querySelector('button')).toBeNull();
  expect(screen.getByRole('button', { name: '登出' })).toBeVisible();
  fireEvent.click(screen.getByTestId('button-cards'));
  expect(await screen.findByRole('heading', { name: '測試題庫' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '返回管理後台' }));
  expect(await screen.findByTestId('button-crm')).toBeVisible();
  client.clear();
});

it('gives an appointed member the real small-group entry without global admin tools', async () => {
  fixture.appointed=true;
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={client}><AdminPage /></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByTestId('button-family-access')).toHaveTextContent('小家管理');
  expect(screen.getByTestId('admin-role-label')).toHaveTextContent('小家長');
  expect(screen.getByTestId('button-crm')).toBeVisible();
  expect(screen.queryByTestId('button-access-control')).toBeNull();
  expect(screen.queryByTestId('button-church-devotions')).toBeNull();
  expect(screen.queryByTestId('button-mail-system')).toBeNull();
  expect(screen.queryByTestId('button-cards')).toBeNull();
  client.clear();
});
