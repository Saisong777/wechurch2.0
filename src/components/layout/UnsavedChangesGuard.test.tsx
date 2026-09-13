// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

afterEach(cleanup);
function show(dirty: boolean) {
  const router = createMemoryRouter([
    { path: '/', element: <p>首頁</p> },
    { path: '/note', element: <><UnsavedChangesGuard dirty={dirty} /><Link to="/">回首頁</Link></> },
  ], { initialEntries: ['/', '/note'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  return router;
}

it('blocks link navigation, keeps editing, then allows explicit discard', async () => {
  const router = show(true);
  fireEvent.click(screen.getByRole('link'));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('尚未儲存');
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.pathname).toBe('/note');
  fireEvent.click(screen.getByRole('link'));
  fireEvent.click(await screen.findByRole('button', { name: '放棄修改並離開' }));
  expect(router.state.location.pathname).toBe('/');
});

it('also guards browser-style back navigation', async () => {
  const router = show(true);
  await act(async () => { await router.navigate(-1); });
  expect(await screen.findByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(router.state.location.pathname).toBe('/note');
});

it('registers unload protection only while dirty', () => {
  const view = render(<UnsavedChangesGuard dirty />);
  const dirtyEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirtyEvent);
  expect(dirtyEvent.defaultPrevented).toBe(true);
  view.rerender(<UnsavedChangesGuard dirty={false} />);
  const cleanEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
});

it('does not block clean notes', () => {
  const router = show(false);
  fireEvent.click(screen.getByRole('link'));
  expect(router.state.location.pathname).toBe('/');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
