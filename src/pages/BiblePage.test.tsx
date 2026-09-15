// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import BiblePage from './BiblePage';

vi.mock('@/components/layout/Header', () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/scripture/DevotionalNoteDialog', () => ({ DevotionalNoteDialog: () => null }));
vi.mock('@/components/scripture/ScriptureTTS', () => ({ ScriptureTTS: () => null }));
vi.mock('@/components/scripture/ScriptureCardCreator', () => ({ ScriptureCardCreator: () => null }));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === '/api/bible/books' ? [{ bookName: '創世記', bookNumber: 1, chapterCount: 50, testament: 'OT' }]
      : queryKey[0] === '/api/bible/chapters' ? [{ chapter: 1 }, { chapter: 2 }]
      : queryKey[0] === '/api/bible/verses' ? [{ id: 1, bookName: '創世記', chapter: 2, verse: 1, text: '測試經文' }] : [],
    isLoading: false, isError: false,
  }),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('returns to the selected Bible chapter without resetting the reading scroll', async () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const router = createMemoryRouter([{ path: '/bible', element: <BiblePage /> }, { path: '/care', element: <h1>關懷</h1> }], { initialEntries: ['/bible'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getAllByTestId(/^button-category-/)[0]);
  fireEvent.click(screen.getByTestId('button-book-1'));
  fireEvent.click(screen.getByTestId('button-chapter-2'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('創世記 2章');
  await act(() => router.navigate('/care'));
  scroll.mockClear();
  await act(() => router.navigate(-1));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('創世記 2章');
  expect(scroll).not.toHaveBeenCalled();
});
