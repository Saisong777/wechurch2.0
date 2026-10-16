// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GroupReadingReflectionComposer } from './GroupReadingReflectionComposer';
import { queryClient as personalQueryClient } from '@/lib/queryClient';

const context = vi.hoisted(() => ({ scope: 'church-one' }));
vi.mock('@/lib/churchFetch', () => ({ churchFetch: (...args: Parameters<typeof fetch>) => fetch(...args), churchScopeKey: () => context.scope }));
const noteId = '10000000-0000-4000-8000-000000000001';
const shareId = '10000000-0000-4000-8000-000000000002';
const props = { actor: 'member', scope: 'church-one', groupId: 'group-one', groupName: '讀經小家', date: '2026-10-15', entry: { id: 'devotion-one', version: 3, reference: '詩篇 23' } };
const close = vi.fn();
let note: unknown;
let responseStatus: number;
let getStatus: number;
let transportFailure: boolean;
let holdMutation: boolean;
let finishMutation: (() => void) | undefined;
const clients: QueryClient[] = [];

beforeEach(() => {
  context.scope = 'church-one'; sessionStorage.clear(); close.mockClear();
  note = { note: { id: noteId, version: 4, observation: '原來的看見', receiving: '私人領受', response: '私人回應' } };
  responseStatus = 200; getStatus = 200; transportFailure = false; holdMutation = false; finishMutation = undefined;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'PUT') return { ok: getStatus === 200, status: getStatus, json: async () => getStatus === 200 ? note : { error: '目前無法確認筆記權限' } };
    if (holdMutation) await new Promise<void>(resolve => { finishMutation = resolve; });
    if (transportFailure) throw new Error('網路中斷');
    return { ok: responseStatus === 200, status: responseStatus, json: async () => responseStatus === 200 ? { noteId, noteVersion: 5, shareId, markedRead: true } : { error: '筆記版本已變更' } };
  }));
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; personalQueryClient.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function show(extra: Partial<typeof props> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const invalidation = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><MemoryRouter><GroupReadingReflectionComposer {...props} {...extra} close={close} /></MemoryRouter></QueryClientProvider>);
  return { client, invalidation };
}
async function preview() {
  await screen.findByRole('textbox', { name: '看見' });
  fireEvent.click(screen.getByRole('checkbox', { name: '分享「看見」給小家' }));
  fireEvent.click(screen.getByRole('button', { name: '預覽要分享的內容' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /我確認預覽內容可分享給/ }));
}
function puts() { return vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT'); }

it('preloads all three private fields and focuses the heading without opening the keyboard', async () => {
  show();
  expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('原來的看見');
  expect(screen.getByRole('textbox', { name: '領受' })).toHaveValue('私人領受');
  expect(screen.getByRole('textbox', { name: '回應' })).toHaveValue('私人回應');
  expect(screen.getByRole('heading', { name: '寫下這一天的領受' })).toHaveFocus();
  expect(screen.getByRole('checkbox', { name: '同時標記已讀完這天進度' })).toBeChecked();
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).toBeDisabled();
});

it('requires nonempty selected content, explicit preview and audience consent', async () => {
  note = { note: null }; show();
  await screen.findByRole('textbox', { name: '看見' });
  fireEvent.click(screen.getByRole('checkbox', { name: '分享「看見」給小家' }));
  expect(screen.getByRole('button', { name: '預覽要分享的內容' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '看到牧者' } });
  fireEvent.click(screen.getByRole('button', { name: '預覽要分享的內容' }));
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).toBeDisabled();
  expect(screen.getByRole('heading', { name: '分享預覽 · 讀經小家' })).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: /我確認預覽內容可分享給/ }));
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).not.toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '改過的看見' } });
  expect(screen.queryByRole('heading', { name: '分享預覽 · 讀經小家' })).toBeNull();
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).toBeDisabled();
  expect(puts()).toHaveLength(0);
});

it('submits complete private fields with only selected names, never a public body, and can leave read progress unchanged', async () => {
  personalQueryClient.setQueryData(['/api/devotional-notes', 'member'], []);
  const { invalidation } = show(); await preview();
  const publicPreview = screen.getByRole('heading', { name: '分享預覽 · 讀經小家' }).parentElement!;
  expect(publicPreview).toHaveTextContent('原來的看見');
  expect(publicPreview).not.toHaveTextContent('私人領受');
  expect(publicPreview).not.toHaveTextContent('私人回應');
  fireEvent.click(screen.getByRole('checkbox', { name: '同時標記已讀完這天進度' }));
  fireEvent.click(screen.getByRole('button', { name: '預覽要分享的內容' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /我確認預覽內容可分享給/ }));
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(puts()).toHaveLength(1);
  const [url, init] = puts()[0];
  expect(url).toMatch(/^\/api\/life-groups\/group-one\/reading\/devotion-one\/reflections\/[a-f0-9-]{36}$/);
  expect(JSON.parse(String(init?.body))).toEqual({ devotionVersion: 3, noteId, noteVersion: 4, observation: '原來的看見', receiving: '私人領受', response: '私人回應', shareFields: ['observation'], markRead: false, consent: true });
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['/api/devotional-notes'] });
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['/api/life-groups'] });
  expect(personalQueryClient.getQueryState(['/api/devotional-notes', 'member'])?.isInvalidated).toBe(true);
  expect(Object.keys(sessionStorage).filter(key => key.startsWith('wechurch:group-reading-draft:'))).toHaveLength(0);
});

it('preserves canceled drafts for the same context and never mixes owner, church, group or day', async () => {
  show(); await screen.findByRole('textbox', { name: '看見' });
  fireEvent.change(screen.getByRole('textbox', { name: '看見' }), { target: { value: '這天未送出的草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '收起，保留草稿' }));
  expect(close).toHaveBeenCalledOnce(); expect(puts()).toHaveLength(0); cleanup();
  for (const next of [{ actor: 'other' }, { scope: 'church-two' }, { groupId: 'group-two' }, { date: '2026-10-14' }]) {
    show(next); expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('原來的看見'); cleanup();
  }
  show(); expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('這天未送出的草稿');
});

it.each(['transport', 500, 503])('keeps unknown failure %s immutable and retries the same mutation only after an explicit click', async failure => {
  transportFailure = failure === 'transport'; responseStatus = typeof failure === 'number' ? failure : 200; show(); await preview();
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '重新載入筆記版本，保留草稿' })).toBeNull();
  expect(puts()).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveAttribute('readonly');
  cleanup(); transportFailure = false; responseStatus = 200;
  // The original write may have committed even though its response was lost.
  note = { note: { id: noteId, version: 5, observation: '原來的看見', receiving: '私人領受', response: '私人回應' } };
  show();
  await screen.findByRole('button', { name: '重新確認原送出結果' });
  expect(puts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '重新確認原送出結果' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(puts()).toHaveLength(2);
  expect(puts()[0]).toEqual(puts()[1]);
});

it('blocks duplicate confirmation clicks while a request is pending', async () => {
  holdMutation = true; show(); await preview();
  const form = screen.getByRole('textbox', { name: '看見' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(puts()).toHaveLength(1); expect(screen.getByRole('button', { name: '正在確認送出…' })).toBeDisabled();
  finishMutation?.(); await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

it('retains conflict drafts and requires an explicit version reload, new preview and consent', async () => {
  responseStatus = 409; show(); await preview();
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await screen.findByRole('alert');
  expect(puts()).toHaveLength(1);
  note = { note: { id: noteId, version: 8, observation: '另一處更新', receiving: '', response: '' } };
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '重新載入筆記版本，保留草稿' }));
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveAttribute('readonly');
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '重新載入筆記版本，保留草稿' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '看見' })).not.toHaveAttribute('readonly'));
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('原來的看見');
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).toBeDisabled();
  // Closing after reloading must not bypass the still-required comparison.
  cleanup(); show();
  await screen.findByRole('textbox', { name: '看見' });
  expect(screen.getByRole('region', { name: '最新私人原稿比對' })).toHaveTextContent('另一處更新');
  expect(screen.getByRole('button', { name: '預覽要分享的內容' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /我已比對最新原稿/ }));
  fireEvent.click(screen.getByRole('button', { name: '預覽要分享的內容' }));
  expect(screen.getByRole('button', { name: '儲存筆記並分享至小家' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /我確認預覽內容可分享給/ }));
  responseStatus = 200;
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(JSON.parse(String(puts()[1][1]?.body)).noteVersion).toBe(8);
  expect(puts()[1][0]).not.toBe(puts()[0][0]);
});

it('does not submit a stale church context', async () => {
  show(); await preview(); context.scope = 'church-two';
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  expect(puts()).toHaveLength(0);
});

it('keeps the original attempt if a successful response arrives after leaving its church', async () => {
  holdMutation = true; show(); await preview();
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  context.scope = 'church-two'; cleanup(); finishMutation?.();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(close).not.toHaveBeenCalled();
  holdMutation = false; context.scope = 'church-one'; show();
  fireEvent.click(await screen.findByRole('button', { name: '重新確認原送出結果' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(puts()[0]).toEqual(puts()[1]);
});

it('shows a private preload error without opening an empty overwrite editor', async () => {
  note = { malformed: true }; show();
  expect(await screen.findByRole('alert')).toHaveTextContent('私人筆記載入失敗');
  expect(screen.queryByRole('textbox', { name: '看見' })).toBeNull();
  note = { note: null };
  fireEvent.click(screen.getByRole('button', { name: '重新載入私人筆記' }));
  expect(await screen.findByRole('textbox', { name: '看見' })).toHaveValue('');
});


it.each([400, 401, 403, 404, 413, 422, 428])('allows explicit draft recovery after known rejection %s without automatically resending', async status => {
  responseStatus = status; show(); await preview();
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await screen.findByRole('button', { name: '重新載入筆記版本，保留草稿' });
  expect(puts()).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('原來的看見');
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveAttribute('readonly');
  expect(screen.getByRole('textbox', { name: '看見' })).not.toBeDisabled();
  cleanup(); show();
  await screen.findByRole('button', { name: '重新載入筆記版本，保留草稿' });
  expect(puts()).toHaveLength(1);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  note = { note: { id: noteId, version: 8, observation: '最新私人原稿', receiving: '', response: '' } };
  fireEvent.click(screen.getByRole('button', { name: '重新載入筆記版本，保留草稿' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '看見' })).not.toHaveAttribute('readonly'));
  expect(screen.getByRole('textbox', { name: '看見' })).toHaveValue('原來的看見');
  expect(screen.getByRole('region', { name: '最新私人原稿比對' })).toHaveTextContent('最新私人原稿');
  expect(screen.getByRole('button', { name: '預覽要分享的內容' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /我已比對最新原稿/ }));
  fireEvent.click(screen.getByRole('button', { name: '預覽要分享的內容' }));
  const submit = screen.getByRole('button', { name: '儲存筆記並分享至小家' });
  expect(submit).toBeDisabled();
  fireEvent.submit(submit.closest('form')!);
  expect(puts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox', { name: /我確認預覽內容可分享給/ }));
  responseStatus = 200; fireEvent.click(submit);
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(puts()).toHaveLength(2);
  expect(puts()[1][0]).not.toBe(puts()[0][0]);
});

it.each([403, 404])('keeps the saved draft readable and selectable if fresh note loading is rejected with %s', async status => {
  responseStatus = 404; show(); await preview();
  fireEvent.click(screen.getByRole('button', { name: '儲存筆記並分享至小家' }));
  await screen.findByRole('button', { name: '重新載入筆記版本，保留草稿' });
  vi.spyOn(window, 'confirm').mockReturnValue(true); getStatus = status;
  fireEvent.click(screen.getByRole('button', { name: '重新載入筆記版本，保留草稿' }));
  const preserved = await screen.findByRole('textbox', { name: '可複製的私人草稿' });
  expect(preserved).toHaveValue('看見\n原來的看見\n\n領受\n私人領受\n\n回應\n私人回應');
  expect(preserved).toHaveAttribute('readonly');
  expect(preserved).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '選取草稿以複製' }));
  expect(preserved).toHaveFocus();
  expect((preserved as HTMLTextAreaElement).selectionEnd).toBe((preserved as HTMLTextAreaElement).value.length);
  expect(screen.getByRole('link', { name: '回看私人筆記' })).toHaveAttribute('href', '/learn/my-notes');
  expect(screen.queryByRole('button', { name: '儲存筆記並分享至小家' })).toBeNull();
  expect(puts()).toHaveLength(1);
  cleanup(); show();
  expect(await screen.findByRole('textbox', { name: '可複製的私人草稿' })).toHaveValue('看見\n原來的看見\n\n領受\n私人領受\n\n回應\n私人回應');
  expect(puts()).toHaveLength(1);
});
