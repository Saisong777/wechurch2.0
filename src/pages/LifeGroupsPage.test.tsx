// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LifeGroupsPage from './LifeGroupsPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' }, loading: false }) }));
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(function (this: Crypto) {
    if (this !== crypto) throw new TypeError('Illegal invocation');
    return '00000000-0000-4000-8000-000000000001';
  });
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const path = input.replace('/api/life-groups', '');
    let data: unknown = [];
    if (!path) data = { groups: [{ id: 'group', name: '測試小組', memberCount: 1 }], requests: [], canCreate: false };
    else if (path === '/group') data = { id: 'group', name: '測試小組', manager: false, members: [{ id: 'member', name: '測試成員' }], requests: [] };
    else if (path.startsWith('/group/shares?')) data = [{ id: 'share', authorId: 'member', authorName: '測試成員', kind: 'note', title: '測試分享', body: '願意分享的內容', reference: '', answered: false, version: 1, createdAt: '2026-09-11', commentCount: 0 }];
    else if (path.startsWith('/group/care?')) data = [{ id: 'care', creatorId: 'member', name: '匿名測試對象', need: '測試需要', status: 'new', nextAction: '', dueDate: null, responsibleId: null, version: 1, watching: true, watcherCount: 1, updatedAt: '2026-09-11' }];
    return { ok: true, json: async () => data };
  }));
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function show(view: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/groups/group?view=${view}`]}><Routes><Route path="/groups/:groupId" element={<LifeGroupsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it('opens the response form with a correctly bound browser UUID function', async () => {
  show('note');
  fireEvent.click(await screen.findByRole('button', { name: '回應 0' }));
  expect(await screen.findByRole('textbox', { name: '寫下回應' })).toBeTruthy();
});

it('opens care progress and preserves the creator edit action', async () => {
  show('care');
  fireEvent.click(await screen.findByRole('button', { name: '進度與跟進' }));
  expect(await screen.findByRole('textbox', { name: '本次跟進紀錄' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '編輯關懷資料' })).toBeTruthy();
});

it('requires explicit consent even when new sharing content is filled', async () => {
  show('note');
  fireEvent.click(await screen.findByRole('button', { name: '分享靈修筆記' }));
  fireEvent.change(screen.getByRole('textbox', { name: '分享標題' }), { target: { value: '測試' } });
  fireEvent.change(screen.getByRole('textbox', { name: '分享內容' }), { target: { value: '測試內容' } });
  expect((screen.getByRole('button', { name: '確認分享至小組' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect((screen.getByRole('button', { name: '確認分享至小組' }) as HTMLButtonElement).disabled).toBe(false);
});
