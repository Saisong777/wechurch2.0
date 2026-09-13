// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnPage from './LearnPage';
import SharePage from './SharePage';
import PublicWallsPage from './PublicWallsPage';
import { PublicWallTabs } from '@/components/prayer/PublicWallTabs';

const state = vi.hoisted(() => ({ disabled: [] as string[], loading: false, error: null as string | null }));
vi.mock('@/hooks/useFeatureToggles', () => ({ useFeatureToggles: () => ({
  ...state, isFeatureEnabled: (key: string) => !state.disabled.includes(key), getDisabledMessage: () => '未開放',
}) }));
vi.mock('@/components/layout/Header', () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
afterEach(() => { cleanup(); state.disabled = []; state.loading = false; state.error = null; });

it('keeps only Bible, daily devotion and notes in learning', () => {
  render(<MemoryRouter><LearnPage /></MemoryRouter>);
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/learn/bible', '/learn/church-reading', '/learn/my-notes']);
  expect(screen.queryByText('接續讀經')).toBeNull();
  expect(screen.queryByText('看耶穌四季')).toBeNull();
});

it('separates private prayer from a single public walls entry', () => {
  render(<MemoryRouter><SharePage /></MemoryRouter>);
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/grace-record', '/walls']);
  expect(screen.queryByText('下載信息圖卡')).toBeNull();
  expect(screen.queryByText('禱告會與緊急代禱')).toBeNull();
});

it('does not advertise walls when both children are disabled', () => {
  state.disabled = ['we_learn', 'prayer_wall'];
  render(<MemoryRouter><SharePage /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: '分享牆' })).toBeNull();
});

it('keeps wall tabs linked and marks the current wall', () => {
  render(<MemoryRouter initialEntries={['/devotion-wall']}><PublicWallTabs /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '今日靈修' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '代禱' })).toHaveAttribute('href', '/prayer-wall');
});

it('opens the available wall and keeps disabled tabs hidden', () => {
  state.disabled = ['we_learn'];
  render(<MemoryRouter initialEntries={['/walls']}><Routes>
    <Route path="/walls" element={<PublicWallsPage />} />
    <Route path="/prayer-wall" element={<PublicWallTabs />} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole('link', { name: '代禱' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('link', { name: '今日靈修' })).toBeNull();
});

it('does not redirect before feature state is loaded', () => {
  state.loading = true;
  render(<MemoryRouter><PublicWallsPage /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('正在載入分享牆');
});

it('fails closed when the share parent is disabled', () => {
  state.disabled = ['we_share'];
  render(<MemoryRouter><PublicWallsPage /></MemoryRouter>);
  expect(screen.getByText('分享牆暫未開放')).toBeInTheDocument();
});
