// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from './AdminPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture', email: 'fixture@example.test' }, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ role: 'member', loading: false, isAdmin: false, canCreateSession: false }) }));
vi.mock('@/hooks/useAccessControl', () => ({ useAccessControl: () => ({ isPending: false, data: { grants: [{ roleName: '同工' }], permissions: ['members.read'], canEnterAdmin: true, canEnterCrm: true } }) }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
vi.mock('@/components/auth/AuthForm', () => ({ AuthForm: () => null }));

afterEach(cleanup);
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
