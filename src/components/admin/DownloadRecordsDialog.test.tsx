// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { bulkEmailInput } from '@shared/email';
import { DownloadRecordsDialog } from './DownloadRecordsDialog';

const state = vi.hoisted(() => ({ canSend: false }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { canSend: state.canSend, message: 'B 測試站只提供預覽，不會寄出郵件。' } }) }));
vi.mock('@/components/ui/rich-text-editor', () => ({ RichTextEditor: ({ content, onChange }: { content: string; onChange: (v: string) => void }) => <textarea aria-label="郵件內容" value={content} onChange={e => onChange(e.target.value)} /> }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

beforeEach(() => { state.canSend = false; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function openComposer() {
  render(<DownloadRecordsDialog open onOpenChange={() => {}} cardTitle="Fixture" downloads={[{ id: 'download', cardId: 'card', userName: 'Member', userEmail: 'member@example.test', downloadedAt: '2026-09-29T00:00:00Z' }]} loading={false} />);
  fireEvent.click(screen.getByTitle('發送郵件'));
  fireEvent.change(screen.getByLabelText('郵件內容'), { target: { value: '<p>Fixture content</p>' } });
}

it('blocks the legacy download-record composer when B cannot send', () => {
  openComposer();
  expect(screen.getByRole('button', { name: '發送' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('不會寄出郵件');
});

it('confirms recipient count and sends a schema-valid stable ID when an unchanged request is retried', async () => {
  state.canSend = true;
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Unconfirmed')).mockResolvedValue(new Response(JSON.stringify({ sent: 1, failed: 0 })));
  vi.stubGlobal('fetch', fetchMock);
  openComposer();
  fireEvent.click(screen.getByRole('button', { name: '發送' }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 位會員'));
  expect(fetchMock).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '發送' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: '發送' })).toBeEnabled());
  const first = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(bulkEmailInput.safeParse(first).success).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '發送' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).toBe(first.requestId);
});

it('downloads formula-safe CSV with escaped quotes, line breaks and its existing BOM', async () => {
  let exported: Blob | undefined;
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL(blob: Blob) { exported = blob; return 'blob:test'; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<DownloadRecordsDialog open onOpenChange={() => {}} cardTitle="Test" loading={false} downloads={[
    { id: '1', cardId: 'card', userName: '=1+1', userEmail: 'reader@example.test', downloadedAt: '2026-01-01T00:00:00Z' },
    { id: '2', cardId: 'card', userName: 'A,"B"\nnext', userEmail: 'other@example.test', downloadedAt: '2026-01-01T00:00:00Z' },
  ]} />);
  fireEvent.click(screen.getByRole('button', { name: '匯出 CSV' }));
  expect(exported).toBeDefined();
  const bytes = await new Promise<ArrayBuffer>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(exported!);
  });
  expect(Array.from(new Uint8Array(bytes).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes);
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"A,""B""\nnext"');
  expect(csv).toContain('\r\n');
});
