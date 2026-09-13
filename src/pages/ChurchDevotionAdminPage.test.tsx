// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChurchDevotionAdminPage from './ChurchDevotionAdminPage';
import { type ImportSheet } from '@shared/churchDevotion';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'manager' }, loading: false }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: true, loading: false }) }));
const headers = ['讀經日期', '讀經計畫', 'Day', '讀經範圍', '靈修主題', '靈修文章'];
const row = ['2026-09-12', '九月課表', '1', '約翰福音 1:1', '今日主題', '第一段\n\n第二段'];
let sheet: ImportSheet;
const fetchMock = vi.fn();
let client: QueryClient;
beforeEach(() => {
  sheet = { name: '九月', preamble: [['九月每日讀經'], []], headers, rows: [row] };
  fetchMock.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => url.includes('/google-sheet') || url.endsWith('/read') ? { sheets: [sheet] } : url.endsWith('/preview') ? { issues: [], rows: [] } : [],
  }));
  vi.stubGlobal('fetch', fetchMock);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
async function loadGoogleSheet() {
  render(<QueryClientProvider client={client}><MemoryRouter><ChurchDevotionAdminPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: '匯入課表' }));
  fireEvent.change(screen.getByLabelText('Google Sheets 連結'), { target: { value: 'https://docs.google.com/spreadsheets/d/test/edit#gid=42' } });
  fireEvent.click(screen.getByRole('button', { name: '讀取試算表' }));
  await screen.findByRole('combobox', { name: '欄位名稱所在列' });
  await waitFor(() => expect(screen.queryByText('處理中…')).toBeNull());
}
it('auto-maps a detected Google header row, displays source content, and submits its physical row offset', async () => {
  await loadGoogleSheet();
  expect(screen.getByRole('combobox', { name: '欄位名稱所在列' })).toHaveValue('2');
  expect(screen.getByLabelText('日期 *')).toHaveValue('0');
  expect(screen.getByText('第一段 第二段')).toBeTruthy();
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '檢查並預覽' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/preview'))).toBe(true));
  const payload = JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith('/preview'))![1].body);
  expect(payload).toMatchObject({ headerRow: 3, rows: [row], mode: 'skip', mapping: { date: 0, devotionalText: 5 } });
});
it('re-maps after changing the header row and clears stale preview confirmation', async () => {
  await loadGoogleSheet();
  fireEvent.click(screen.getByRole('button', { name: '檢查並預覽' }));
  await screen.findByRole('button', { name: '確認匯入草稿' });
  fireEvent.change(screen.getByRole('combobox', { name: '欄位名稱所在列' }), { target: { value: '0' } });
  expect(screen.getByRole('alert')).toHaveTextContent('尚待選擇欄位');
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '確認匯入草稿' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: '欄位名稱所在列' }), { target: { value: '2' } });
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeEnabled();
  expect(screen.getByLabelText('靈修短文 *')).toHaveValue('5');
});
it('requires manual choice for duplicate columns without inventing missing data', async () => {
  sheet.headers = [...headers, '日期']; sheet.rows = [[...row, '2026-09-13']];
  await loadGoogleSheet();
  expect(screen.getByLabelText('日期 *')).toHaveValue('');
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('日期 *'), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Google Sheets 連結'), { target: { value: 'https://docs.google.com/spreadsheets/d/other/edit' } });
  expect(screen.queryByRole('button', { name: '檢查並預覽' })).toBeNull();
});
it('prepares the five-column plan automatically and requires only its missing year', async () => {
  sheet = { name: 'sheet1', preamble: [['以賽亞書課表'], ['簡介：測試'], []], headers: ['日期 (Day)', '天數', '經文進度', '每日重點／ 真理導航／生活練習', '今日金句卡'], rows: [['8/1', '第 1 天', '以賽亞書 1:1-全', '每日重點：測試重點\n\n真理導航：測試短文', '測試金句']] };
  await loadGoogleSheet();
  expect(screen.getByLabelText('整份課表名稱')).toHaveValue('以賽亞書課表');
  expect(screen.getByLabelText('短文標題 *')).toHaveValue('dailyFocus');
  expect(screen.getByRole('combobox', { name: '附在短文末尾的金句卡' })).toHaveValue('4');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByLabelText('匯入年份')).toHaveValue(null);
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('匯入年份'), { target: { value: '2026' } });
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '檢查並預覽' }));
  await screen.findByRole('button', { name: '確認匯入草稿' });
  const payload = JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith('/preview'))![1].body);
  expect(payload).toMatchObject({ headerRow: 4, options: { year: 2026, planName: '以賽亞書課表', titleFromDailyFocus: true, verseCardColumn: 4 } });
  fireEvent.change(screen.getByLabelText('匯入年份'), { target: { value: '' } });
  expect(screen.queryByRole('button', { name: '確認匯入草稿' })).toBeNull();
  expect(screen.getByRole('button', { name: '檢查並預覽' })).toBeDisabled();
});
