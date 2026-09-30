// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformMaturityPanel } from './PlatformMaturityPanel';
import { apiRequest } from '@/lib/queryClient';

vi.mock('@/lib/queryClient', () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function show() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><PlatformMaturityPanel /></QueryClientProvider>); }
const summary = { since: '2026-09-21T00:00:00Z', until: '2026-09-28T00:00:00Z', totalEvents: 1218, totalErrors: 2, events: [{ event_name: 'page_view', count: 1000 }], errors: [{ source: 'client', status_code: 0, path: '/learn', count: 2, last_seen: '2026-09-28T00:00:00Z' }] };

it('shows recorded totals, not a health or AI quality score', async () => {
  vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(summary)));
  show();
  expect(await screen.findByText('1,218')).toBeVisible();
  expect(screen.getByText('/learn')).toBeVisible();
  expect(screen.getByText('2 次')).toBeVisible();
  expect(screen.queryByText(/健康分數|AI 品質|運作正常/)).toBeNull();
  expect(screen.getByText('操作分佈').closest('details')).not.toHaveAttribute('open');
});
it('does not misrepresent a failed request as no errors or a healthy service', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('無法取得最新紀錄');
  expect(screen.queryByText('期間內未記錄錯誤。')).toBeNull();
  expect(screen.queryByText('0')).toBeNull();
});
it('labels empty telemetry as no recorded data, not a health guarantee', async () => {
  vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({ ...summary, totalEvents: 0, totalErrors: 0, events: [], errors: [] })));
  show();
  expect(await screen.findByText('期間內未記錄錯誤。')).toBeVisible();
  expect(screen.queryByText('運作正常')).toBeNull();
});
