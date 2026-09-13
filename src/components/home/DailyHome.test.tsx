// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DailyHome, type DailyHomeProps } from './DailyHome';

afterEach(cleanup);

const defaults: DailyHomeProps = {
  date: '9/11（週五）',
  scripture: { reference: '約翰福音 15:4-5', preview: '你們要常在我裡面。', href: '/learn/church-reading' },
  notesLoading: false, onOpenNote: vi.fn(), signedIn: true,
  prayersLoading: false, prayersError: false, onRetryPrayers: vi.fn(), prayerCount: 0,
  careLoading: false, showTools: true, showAdmin: false,
};

function show(props: Partial<DailyHomeProps> = {}) {
  return render(<MemoryRouter><DailyHome {...defaults} {...props} /></MemoryRouter>);
}

describe('daily homepage', () => {
  it('has three sections, one scripture preview, and a direct reading action', () => {
    const { container } = show();
    expect(container.querySelectorAll('section')).toHaveLength(3);
    expect(screen.getAllByText(defaults.scripture.preview)).toHaveLength(1);
    expect(screen.getByRole('link', { name: '開始今日靈修' }).getAttribute('href')).toBe('/learn/church-reading');
    expect(screen.queryByText('主要入口')).toBeNull();
    expect(screen.queryByText('小組新朋友')).toBeNull();
  });

  it('preserves destinations without the redundant module cards', () => {
    const { container } = show({ showAdmin: true });
    const hrefs = [...container.querySelectorAll('a')].map(link => link.getAttribute('href'));
    for (const href of ['/learn/church-reading', '/learn/my-notes', '/grace-record', '/prayer-wall', '/prayer-meeting', '/care', '/play', '/admin']) {
      expect(hrefs).toContain(href);
    }
  });

  it.each(['pending', 'blocked'] as const)('keeps %s draft visible and editable', syncStatus => {
    const onOpenNote = vi.fn();
    show({ note: { syncStatus }, onOpenNote });
    expect(screen.getByRole('status').textContent).toContain('尚未同步');
    fireEvent.click(screen.getByRole('button', { name: '開啟草稿' }));
    expect(onOpenNote).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: '繼續今日靈修' })).toBeTruthy();
  });

  it('shows only the supplied personal summary and keeps privacy visible', () => {
    show({ prayerCount: 4, prayer: { title: '測試禱告', prayer: '測試內容' }, care: { name: '測試對象', need: '測試需要', nextAction: '測試行動' } });
    expect(screen.getByText('測試禱告')).toBeTruthy();
    expect(screen.getByText('4 筆正在等候')).toBeTruthy();
    expect(screen.getByText('僅自己可見')).toBeTruthy();
    expect(screen.getByText('測試對象')).toBeTruthy();
    expect(screen.queryByText('分享給小組')).toBeNull();
  });

  it('does not show an empty state during loading', () => {
    show({ prayersLoading: true, notesLoading: true, careLoading: true });
    expect(screen.getByRole('status', { name: '正在載入禱告' })).toBeTruthy();
    expect(screen.queryByText('目前沒有正在等候的禱告。')).toBeNull();
    expect(screen.queryByText('還沒有待關心的對象。')).toBeNull();
  });

  it('allows retry and does not present stale data as current after a prayer error', () => {
    const onRetryPrayers = vi.fn();
    show({ prayersError: true, onRetryPrayers, prayer: { title: '舊紀錄', prayer: '' } });
    expect(screen.getByRole('alert').textContent).toContain('暫時無法載入');
    expect(screen.queryByText('舊紀錄')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(onRetryPrayers).toHaveBeenCalledOnce();
  });

  it('preserves signed-out and disabled-tool states', () => {
    show({ signedIn: false, showTools: false });
    expect(screen.getByRole('link', { name: '登入查看我的禱告' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('link', { name: '工具' })).toBeNull();
    expect(screen.queryByRole('link', { name: '主持與管理' })).toBeNull();
  });

  it('does not label unavailable care data as an empty list', () => {
    show({ careUnavailable: true });
    expect(screen.getByRole('status').textContent).toContain('暫時無法確認關懷資料');
    expect(screen.queryByText('還沒有待關心的對象。')).toBeNull();
  });
});
