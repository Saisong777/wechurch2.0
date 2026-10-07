// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { GroupSummary } from '@shared/lifeGroup';
import LifeGroupsPage from './LifeGroupsPage';

const auth = vi.hoisted(() => ({ user: { id: 'member' } as { id: string } | null, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>我的小家</header> }));
vi.mock('@/components/groups/FamilyJoinPanel', () => ({ FamilyJoinPanel: () => <section>尋找小家</section> }));
vi.mock('@/components/groups/FamilyManagement', () => ({ FamilyManagement: () => <section>管理小家</section> }));

const entry = '/groups?entry=reading&view=reading';
const group: GroupSummary = { id: 'group', name: '我的小家', church: 'church', memberCount: 1, manager: false };
let groups: GroupSummary[];
let requests: { id: string; name: string; status: string }[];
let failure: number | undefined;
const clients: QueryClient[] = [];

beforeEach(() => {
  auth.user = { id: 'member' };
  auth.loading = false;
  groups = [group]; requests = []; failure = undefined;
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const path = input.replace('/api/life-groups', '');
    if (!path && failure) return { ok: false, json: async () => ({ error: '暫時無法讀取小家資料。' }) };
    const id = path.split('/')[1];
    const selected = groups.find(g => g.id === id);
    const data = !path ? { groups, requests, canCreate: false }
      : path.includes('/reading?') ? { entry: null, readers: [] }
      : { id, name: selected?.name, manager: selected?.manager, members: [{ id: 'member', name: '成員' }], requests: [] };
    return { ok: true, json: async () => data };
  }));
});
afterEach(() => {
  cleanup(); clients.forEach(c => c.clear()); clients.length = 0;
  vi.unstubAllGlobals();
});

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
function show(path = entry, prepare?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client); prepare?.(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <Location />
    <Routes><Route path="/groups" element={<LifeGroupsPage />} /><Route path="/groups/:groupId" element={<LifeGroupsPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}

it.each([false, true])('directly opens the sole authorized group reading tab (manager=%s)', async manager => {
  groups = [{ ...group, manager }];
  show();
  expect(await screen.findByRole('tab', { name: '一起讀經' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByTestId('location')).toHaveTextContent('/groups/group?view=reading');
  expect(screen.queryByText('尋找小家')).toBeNull();
});

it('preserves reading when choosing among multiple groups', async () => {
  groups = [group, { ...group, id: 'second', name: '另一個小家' }];
  show();
  const selector = await screen.findByRole('combobox', { name: '選擇小家' });
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
  expect(screen.getByRole('link', { name: /另一個小家/ })).toHaveAttribute('href', '/groups/second?view=reading');
  fireEvent.change(selector, { target: { value: 'second' } });
  expect(await screen.findByRole('tab', { name: '一起讀經' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByTestId('location')).toHaveTextContent('/groups/second?view=reading');
  fireEvent.change(screen.getByRole('combobox', { name: '選擇小家' }), { target: { value: 'group' } });
  expect(await screen.findByRole('tab', { name: '一起讀經' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByTestId('location')).toHaveTextContent('/groups/group?view=reading');
});

it('keeps the joining and pending-request flow when there is no authorized group', async () => {
  groups = []; requests = [{ id: 'pending', name: '申請的小家', status: 'pending' }];
  show();
  expect(await screen.findByText('目前尚未加入小家。')).toBeTruthy();
  expect(screen.getByText('申請的小家 · 等待小家長確認')).toBeTruthy();
  expect(screen.getByText('尋找小家')).toBeTruthy();
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
});

it('preserves the reading destination through login without querying member groups', () => {
  auth.user = null;
  show();
  const target = new URL(screen.getByRole('link', { name: '登入小家' }).getAttribute('href')!, 'https://example.test');
  expect(target.searchParams.get('returnTo')).toBe(entry);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([401, 403, 500])('does not redirect from stale membership after a failed request (%s)', async status => {
  failure = status;
  show(entry, client => client.setQueryData(['/api/life-groups', 'member', ''], { groups: [group], requests: [], canCreate: false }, { updatedAt: 1 }));
  expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法讀取小家資料。');
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
  failure = undefined;
  fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
  expect(await screen.findByRole('tab', { name: '一起讀經' })).toHaveAttribute('aria-selected', 'true');
});

it('does not use another account’s cached group', async () => {
  auth.user = { id: 'other' }; groups = [];
  show(entry, client => client.setQueryData(['/api/life-groups', 'member', ''], { groups: [group], requests: [], canCreate: false }));
  expect(await screen.findByText('目前尚未加入小家。')).toBeTruthy();
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
});

it('does not enter a former group when refreshed membership is empty', async () => {
  groups = [];
  show(entry, client => client.setQueryData(['/api/life-groups', 'member', ''], { groups: [group], requests: [], canCreate: false }, { updatedAt: 1 }));
  expect(await screen.findByText('目前尚未加入小家。')).toBeTruthy();
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
});

it('keeps the ordinary groups page as a list even with only one group', async () => {
  show('/groups');
  expect(await screen.findByText('尋找小家')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: '一起讀經' })).toBeNull();
  expect(screen.getByTestId('location')).toHaveTextContent('/groups');
});

it('does not intercept an invitation or management entry', async () => {
  sessionStorage.setItem('wechurch:pending-group-invite', 'invitation');
  show();
  expect(await screen.findByText('尋找小家')).toBeTruthy();
  expect(screen.getByTestId('location')).toHaveTextContent(entry);
  cleanup(); sessionStorage.clear();
  show(entry + '&manage=1');
  await waitFor(() => expect(screen.getByText('管理小家')).toBeTruthy());
  expect(screen.getByTestId('location')).toHaveTextContent(entry + '&manage=1');
});


it('carries a selected historical date through sole-group redirection and group selection', async () => {
  show(`${entry}&date=2026-09-09`);
  await screen.findByRole('tab', { name: '一起讀經' });
  expect(screen.getByTestId('location')).toHaveTextContent('/groups/group?view=reading&date=2026-09-09');
  expect(screen.getByLabelText('讀經日期')).toHaveValue('2026-09-09');
  expect(fetch).toHaveBeenCalledWith('/api/life-groups/group/reading?date=2026-09-09', expect.anything());
});

it('preserves a historical date when picking from multiple authorized groups', async () => {
  groups = [group, { ...group, id: 'second', name: '另一個小家' }];
  show(`${entry}&date=2026-09-09`);
  const selector = await screen.findByRole('combobox', { name: '選擇小家' });
  expect(screen.getByRole('link', { name: /另一個小家/ })).toHaveAttribute('href', '/groups/second?view=reading&date=2026-09-09');
  fireEvent.change(selector, { target: { value: 'second' } });
  await screen.findByRole('tab', { name: '一起讀經' });
  expect(screen.getByLabelText('讀經日期')).toHaveValue('2026-09-09');
});
