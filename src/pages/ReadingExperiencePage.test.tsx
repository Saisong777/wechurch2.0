// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ReadingExperiencePage from './ReadingExperiencePage';

const plan = { id: 'plan-1', name: '測試讀經計畫', startDate: '2026-09-30', totalDays: 2 };
const progress = [1, 2].map(dayNumber => ({ dayNumber, scriptureReference: `創世記 ${dayNumber}`, isCompleted: false }));
const verses = [{ bookName: '創世記', chapter: 1, verse: 1, text: '測試經文' }];
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>每日讀經</header> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member-1' } }) }));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === '/api/bible/verses' ? verses
      : queryKey[2] === 'progress' ? progress
      : queryKey[2] === 'devotional' ? null : plan,
    isLoading: false,
  }),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('renders and switches reading days without speech support while retaining notes and completion', () => {
  vi.stubGlobal('speechSynthesis', undefined);
  vi.stubGlobal('SpeechSynthesisUtterance', undefined);
  Element.prototype.scrollIntoView = vi.fn();
  const router = createMemoryRouter([{ path: '/learn/reading-plans/:planId/read', element: <ReadingExperiencePage /> }], {
    initialEntries: ['/learn/reading-plans/plan-1/read?day=1'],
  });
  const { unmount } = render(<RouterProvider router={router} />);
  expect(screen.getByText('測試經文')).toBeInTheDocument();
  expect(screen.queryByTestId('button-play')).not.toBeInTheDocument();
  expect(screen.queryByTestId('button-toggle-auto-read')).not.toBeInTheDocument();
  expect(screen.queryByTestId('select-voice')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '標記今天已完成' })).toBeEnabled();
  fireEvent.click(screen.getByTestId('button-toggle-devotional'));
  expect(screen.getByLabelText('看見')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('button-day-2'));
  expect(screen.getByTestId('text-day-label')).toHaveTextContent('第 2 天');
  expect(() => unmount()).not.toThrow();
});
