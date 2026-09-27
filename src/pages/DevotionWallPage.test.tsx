// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DevotionWallPage from './DevotionWallPage';
import MySharingPage from './MySharingPage';

const wall = vi.hoisted(() => ({ posts: [], data: { day: '2026-09-27' }, expired: false, isPending: false, isError: false,
  hasNextPage: true, isFetching: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, loading: false }) }));
vi.mock('@/hooks/useDevotionWall', () => ({ useDevotionWall: () => wall, useWithdrawDevotionShare: () => ({ isPending: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/ui/feature-gate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/prayer/PublicWallTabs', () => ({ PublicWallTabs: () => null }));
vi.mock('@/components/prayer/PersonalPrayerSharing', () => ({ PrayerDeliveries: () => null, usePrayerSharing: () => ({ data: [] }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); wall.hasNextPage = true; wall.isFetching = false; });
it.each([
  [DevotionWallPage, '載入更多分享'],
  [MySharingPage, '載入更多靈修分享'],
] as const)('offers an explicit next-page action without hiding older shares (%s)', (Page, label) => {
  const { rerender } = render(<MemoryRouter><Page /></MemoryRouter>);
  expect(wall.fetchNextPage).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: label }));
  expect(wall.fetchNextPage).toHaveBeenCalledOnce();
  wall.isFetching = true; rerender(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.getByRole('button', { name: label })).toBeDisabled();
  wall.hasNextPage = false; rerender(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: label })).toBeNull();
});
