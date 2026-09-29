// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessControlPage from './AccessControlPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' }, loading: false }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: true, loading: false }) }));
vi.mock('@/components/theme/AppearanceControl', () => ({ AppearanceControl: () => null }));
const data = {
  church: 'IM 行動教會', isSystemAdmin: true,
  users: [{ id: 'member', name: '測試成員', email: 'fixture@example.test', role: 'member' }],
  roles: [{ id: 'coworker', name: '同工', permissions: ['email.send'], version: 1 }],
  groups: [{ id: 'family', name: '測試小家' }], grants: [], history: [], legacyScopes: [], appointments: [],
};
let fail = false;
let sent: Record<string, unknown>[] = [];
let client: QueryClient;
beforeEach(() => {
  sent = []; fail = false;
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
    if (options?.method === 'POST') {
      sent.push(JSON.parse(String(options.body)));
      return { ok: !fail, json: async () => fail ? { error: '連線失敗，請重試' } : { id: 'grant' } };
    }
    return { ok: true, json: async () => data };
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={['/admin/access?member=member']}><QueryClientProvider client={client}><AccessControlPage /></QueryClientProvider></MemoryRouter>);
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('starts with a title only and applies preset permissions only on explicit action', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '管理全站靈修課表' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '套用職分預設權限' }));
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).toBeChecked();
  fireEvent.change(screen.getByLabelText('管理範圍'), { target: { value: 'site' } });
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '寄送教會通知' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: '管理全站靈修課表' })).not.toBeDisabled();
  expect(sent).toHaveLength(0);
});

it('preserves a failed grant and sends the chosen scope, permission and reason', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  fireEvent.change(screen.getByLabelText('管理範圍'), { target: { value: 'group' } });
  fireEvent.change(screen.getByLabelText('指定對象'), { target: { value: 'family' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '管理小家與成員異動' }));
  fireEvent.change(screen.getByLabelText('異動原因'), { target: { value: '協助小家服事' } });
  fail = true;
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('異動原因')).toHaveValue('協助小家服事');
  expect(screen.getByRole('checkbox', { name: '管理小家與成員異動' })).toBeChecked();
  expect(sent[0]).toMatchObject({ userId: 'member', roleId: 'coworker', scope: 'group', groupId: 'family', memberId: null, permissions: ['groups.manage'], reason: '協助小家服事' });
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: '編輯成員授權' })).toBeNull());
});

it('does not grant when confirmation is cancelled', async () => {
  fireEvent.click(await screen.findByRole('button', { name: '新增職分' }));
  fireEvent.change(screen.getByLabelText('異動原因'), { target: { value: '只設定職分' } });
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '儲存授權' }));
  expect(sent).toHaveLength(0);
});
