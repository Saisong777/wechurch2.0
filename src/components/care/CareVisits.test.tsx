// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VisitComposer, VisitReminder } from './CareVisits';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
let client: QueryClient;
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: true, canManage: true, pending: 2, urgent: 1 })))); });
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
const show = (element: React.ReactNode) => render(<MemoryRouter><QueryClientProvider client={client}>{element}</QueryClientProvider></MemoryRouter>);
it('does not copy private notes into the request; consent resets after edits', async () => {
  show(<VisitComposer contact={{ id: 'contact', userId: 'owner', name: '測試朋友', need: 'PRIVATE_NEED', prayer: 'PRIVATE_PRAYER', nextAction: '', lastCaredAt: null, createdAt: '2026-09-28', prayerCount: 0 }} close={vi.fn()} />);
  expect(screen.getByLabelText('需要探訪的人')).toHaveValue('測試朋友');
  expect(screen.getByLabelText('希望牧者知道的狀況')).toHaveValue('');
  expect(screen.queryByText('PRIVATE_NEED')).toBeNull();
  fireEvent.change(screen.getByLabelText('希望牧者知道的狀況'), { target: { value: '可分享近況' } });
  fireEvent.change(screen.getByLabelText('聯絡方式與方便探訪的時間'), { target: { value: '請先聯絡我' } });
  expect(screen.getByRole('button', { name: '確認送給牧者' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByRole('button', { name: '確認送給牧者' })).toBeEnabled());
  fireEvent.click(screen.getByLabelText('請盡快聯絡'));
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('note')).toHaveTextContent('不保證立即有人看到');
});
it('retains failed submissions and reuses the request id on retry', async () => {
  const close = vi.fn(); show(<VisitComposer close={close} />);
  fireEvent.change(screen.getByLabelText('需要探訪的人'), { target: { value: '測試' } });
  fireEvent.change(screen.getByLabelText('希望牧者知道的狀況'), { target: { value: '請協助' } });
  fireEvent.change(screen.getByLabelText('聯絡方式與方便探訪的時間'), { target: { value: '聯絡我' } });
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByRole('button', { name: '確認送給牧者' })).toBeEnabled());
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: '暫時無法處理' }), { status: 503 }));
  fireEvent.click(screen.getByRole('button', { name: '確認送給牧者' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('希望牧者知道的狀況')).toHaveValue('請協助');
  fireEvent.click(screen.getByRole('button', { name: '確認送給牧者' }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(2));
  const calls = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(calls[0][0]).toBe(calls[1][0]); expect(close).not.toHaveBeenCalled();
});
it('shows an actionable pastor-only reminder', async () => {
  show(<VisitReminder />);
  const link = await screen.findByRole('link');
  expect(link).toHaveAttribute('href', '/care?view=visits&inbox=1');
  expect(link).toHaveTextContent('緊急 1');
});
