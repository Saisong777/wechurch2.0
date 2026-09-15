// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
const auth = vi.hoisted(() => ({ user: null, loading: false, signUp: vi.fn(async () => ({})), signIn: vi.fn(async () => ({})) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('opens signup from an invitation and leaves email available without LINE', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: url === '/api/deployment', json: async () => ({ staging: true }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?mode=signup&returnTo=%2Fgroups']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('建立新帳戶')).toBeTruthy();
  expect(screen.getByTestId('input-password')).toHaveAttribute('minlength', '8');
  expect(screen.getByTestId('button-submit')).toHaveTextContent('註冊');
  fireEvent.click(screen.getByRole('button', { name: /^已有帳號$/ }));
  expect(screen.getByTestId('button-submit')).toHaveTextContent('登入');
  expect(screen.queryByRole('button', { name: '使用 LINE 登入' })).toBeNull();
  client.clear();
});
