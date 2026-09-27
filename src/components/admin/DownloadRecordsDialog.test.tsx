// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DownloadRecordsDialog } from './DownloadRecordsDialog';

vi.mock('@/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
