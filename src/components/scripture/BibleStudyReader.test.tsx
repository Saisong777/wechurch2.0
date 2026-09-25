// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import BibleStudyReader from './BibleStudyReader';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member-a' } }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>聖經</header> }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }));
vi.mock('./DevotionalNoteDialog', () => ({ DevotionalNoteDialog: ({ verseReference, inline }: { verseReference: string; inline: boolean }) => <section aria-label="筆記">{verseReference}{inline && '同頁編輯'}</section> }));
vi.mock('./ScriptureCardCreator', () => ({ ScriptureCardCreator: () => null }));
vi.mock('./ScriptureTTS', () => ({ ScriptureTTS: () => null }));
const credit = { source_id: 'cmncbt', source_name: '當代譯本', license: 'CC-BY-SA-4.0', metadata: { attribution: 'Biblica', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/' } };
const verse = { ...credit, id: 'v1', verse: 1, end_verse: 2, body: '測試合併經文' };
const info = { books: Array.from({ length: 66 }, (_, i) => ({ id: i + 1, name: `書卷${i + 1}`, chapters: 3 })), translations: { cmncbt: '當代譯本', engwebp: 'WEB' }, note_sources: ['notes'], sources: [{ id: 'notes', name: '註釋', license: credit.license, metadata: credit.metadata }] };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => [] } } });
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), 'http://localhost');
    const action = url.pathname.split('/').at(-1);
    const data = action === 'info' ? info : action === 'chapter' ? [verse] : action === 'xrefs' ? [{ start: 45005008, end: 45005008, label: '羅5:8' }] : action === 'preview' ? { verses: [{ ...verse, reference: '羅5:8' }] } : [];
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const router = createMemoryRouter([{ path: '/learn/bible', element: <BibleStudyReader /> }], { initialEntries: ['/learn/bible?book=1&chapter=1'] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return { client, router, fetcher };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps notes inline and freezes their scripture when the reader moves', async () => {
  mount();
  await screen.findByText('測試合併經文');
  fireEvent.click(screen.getByRole('button', { name: '寫筆記' }));
  expect(screen.getByRole('region', { name: '筆記' })).toHaveTextContent('書卷1 1:1–2');
  expect(screen.getByRole('region', { name: '筆記' })).toHaveTextContent('同頁編輯');
  fireEvent.change(screen.getByLabelText('章', { exact: true }), { target: { value: '2' } });
  await screen.findByRole('heading', { name: '書卷1 2' });
  expect(screen.getByRole('region', { name: '筆記' })).toHaveTextContent('書卷1 1:1–2');
});
it('opens and closes cross-reference preview without rendering cached info as an entry', async () => {
  mount();
  await screen.findByText('測試合併經文');
  fireEvent.click(screen.getByRole('button', { name: '查考' }));
  fireEvent.click(screen.getByRole('tab', { name: '串珠' }));
  fireEvent.click(await screen.findByRole('button', { name: '羅5:8' }));
  await screen.findByRole('dialog', { name: '羅5:8' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: '書卷1 1:1–2' })).toBeInTheDocument();
});
it('rejects fractional route numbers and retains the existing Bible URL', async () => {
  const { router } = mount();
  await act(() => router.navigate('/learn/bible?book=1.5&chapter=2.7'));
  expect(await screen.findByRole('heading', { name: '書卷1 1' })).toBeInTheDocument();
  expect(screen.queryByText('進階研讀')).not.toBeInTheDocument();
});
