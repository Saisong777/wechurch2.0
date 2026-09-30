// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

it('opens the Bible directly and preserves old URL references', () => {
  function Destination() {
    const location = useLocation();
    return <output>{location.pathname}{location.search}{location.hash}</output>;
  }
  render(<MemoryRouter initialEntries={['/learn?book=43&chapter=3#v16']}><Routes>
    <Route path="/learn" element={<LearnPage />} />
    <Route path="/learn/bible" element={<Destination />} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('/learn/bible?book=43&chapter=3#v16');
  expect(screen.queryByText('打開聖經')).toBeNull();
});

it('opens daily devotion when the Bible feature is disabled', () => {
  state.disabled = ['bible_reading'];
  render(<MemoryRouter initialEntries={['/learn']}><Routes>
    <Route path="/learn" element={<LearnPage />} />
    <Route path="/learn/church-reading" element={<h1>每日靈修</h1>} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '每日靈修' })).toBeInTheDocument();
});

it('keeps the learning maintenance gate', () => {
  state.disabled = ['we_learn'];
  render(<MemoryRouter><LearnPage /></MemoryRouter>);
  expect(screen.getByText('學習功能維護中')).toBeInTheDocument();
});

it('opens personal prayer directly without another portal', () => {
  render(<MemoryRouter initialEntries={['/share']}><Routes>
    <Route path="/share" element={<SharePage />} />
    <Route path="/grace-record" element={<h1>我的個人禱告</h1>} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '我的個人禱告' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '分享牆' })).toBeNull();
  expect(screen.queryByText('下載信息圖卡')).toBeNull();
  expect(screen.queryByText('禱告會與緊急代禱')).toBeNull();
});

it('preserves the disabled prayer entry state', () => {
  state.disabled = ['we_share'];
  render(<MemoryRouter><SharePage /></MemoryRouter>);
  expect(screen.getByText('禱告功能維護中')).toBeInTheDocument();
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
