// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
const auth = vi.hoisted(() => ({ user: null, loading: false, signUp: vi.fn(async () => ({})), signIn: vi.fn(async () => ({})) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('explains Google account conflicts without exposing provider details', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ staging: true, google: true, emailRegistration: false }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?error=google_link_required']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('避免建立重複帳號');
  client.clear();
});
it('opens signup from an invitation and leaves email available without LINE', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: url === '/api/auth/options', json: async () => ({ staging: true, google: false, emailRegistration: true }) })));
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
it('offers one Google entry for B registration and login without a password form', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ staging: true, google: true, emailRegistration: false }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?mode=signup']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('button', { name: '使用 Google 帳號繼續' })).toBeEnabled();
  expect(screen.queryByTestId('input-password')).toBeNull();
  expect(screen.queryByRole('group', { name: '帳號操作' })).toBeNull();
  expect(screen.queryByTestId('button-submit')).toBeNull();
  client.clear();
});
it('does not expose a misleading registration form when configuration fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法載入登入方式');
  expect(screen.queryByTestId('input-password')).toBeNull();
  client.clear();
});
