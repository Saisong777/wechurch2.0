// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DailyHome, type DailyHomeProps } from './DailyHome';

afterEach(cleanup);

const defaults: DailyHomeProps = {
  date: '9/11（週五）',
  scripture: { reference: '約翰福音 15:4-5', preview: '你們要常在我裡面。', href: '/learn/church-reading' },
  notesLoading: false, onOpenNote: vi.fn(), signedIn: true,
  prayersLoading: false, prayersError: false, onRetryPrayers: vi.fn(), prayers: [],
  careLoading: false, showTools: true, showAdmin: false,
};

function show(props: Partial<DailyHomeProps> = {}) {
  return render(<MemoryRouter><DailyHome {...defaults} {...props} /></MemoryRouter>);
}

describe('daily homepage', () => {
  it('keeps both community destinations accessible and labels generated photos', () => {
    const { container } = show();
    expect(screen.getByRole('link', { name: '我的小家' }).getAttribute('href')).toBe('/groups');
    expect(screen.getByRole('link', { name: '分享牆' }).getAttribute('href')).toBe('/walls');
    expect(screen.getAllByText('AI 示意照片')).toHaveLength(2);
    for (const image of container.querySelectorAll('.home-community-photo img')) {
      expect(image.getAttribute('alt')).toBe('');
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('width')).toBe('1536');
      expect(image.getAttribute('height')).toBe('1024');
    }
  });

  it.each(['loading', 'error', 'unpublished'] as const)('does not invent a preview when the reading is %s', readingState => {
    show({ readingState });
    expect(screen.queryByTestId('daily-scripture-preview')).toBeNull();
    expect(screen.queryByTestId('start-daily-devotion')).toBeNull();
    expect(screen.getByRole('link', { name: '查看每日靈修' }).getAttribute('href')).toBe(defaults.scripture.href);
  });

  it('keeps pastoral access distinct from administrative access', () => {
    show({ showPastoral: true, showAdmin: false });
    expect(screen.getByRole('link', { name: /牧養概況/ }).getAttribute('href')).toBe('/work');
    expect(screen.queryByRole('link', { name: '主持與管理' })).toBeNull();
  });

  it('has three sections, one scripture preview, and a direct reading action', () => {
    const { container } = show();
    expect(container.querySelectorAll('section')).toHaveLength(3);
    expect(screen.getAllByText(defaults.scripture.preview)).toHaveLength(1);
    expect(screen.getByRole('link', { name: '開始今日靈修' }).getAttribute('href')).toBe('/learn/church-reading');
    expect(screen.queryByText('主要入口')).toBeNull();
    expect(screen.queryByText('小家新朋友')).toBeNull();
  });

  it('preserves destinations without the redundant module cards', () => {
    const { container } = show({ showAdmin: true });
    const hrefs = [...container.querySelectorAll('a')].map(link => link.getAttribute('href'));
    for (const href of ['/learn/church-reading', '/learn/my-notes', '/grace-record', '/walls', '/care', '/play', '/admin']) {
      expect(hrefs).toContain(href);
    }
    expect(hrefs).not.toContain('/prayer-meeting');
  });

  it.each(['pending', 'blocked'] as const)('keeps %s draft visible and editable', syncStatus => {
    const onOpenNote = vi.fn();
    show({ note: { syncStatus }, onOpenNote });
    expect(screen.getByRole('status').textContent).toContain('尚未同步');
    fireEvent.click(screen.getByRole('button', { name: '開啟草稿' }));
    expect(onOpenNote).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: '繼續今日靈修' })).toBeTruthy();
  });

  it('numbers every supplied prayer in order and keeps the complete content visible', () => {
    const prayers = Array.from({ length: 4 }, (_, i) => ({ id: `prayer-${i}`, title: `測試禱告 ${i + 1}`, prayer: `完整內容 ${i + 1}\n第二段禱告` }));
    show({ prayers, care: { name: '測試對象', need: '測試需要', nextAction: '測試行動' } });
    const list = screen.getByRole('list', { name: '正在等候的禱告' });
    expect(list.tagName).toBe('OL');
    expect(list.classList.contains('list-decimal')).toBe(true);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    items.forEach((item, i) => {
      expect(item.textContent).toContain(prayers[i].title);
      expect(item.textContent).toContain(prayers[i].prayer);
      expect(item.querySelector('[class*="line-clamp"]')).toBeNull();
    });
    expect(screen.queryByText('4 筆正在等候')).toBeNull();
    expect(screen.getByText('僅自己可見')).toBeTruthy();
    expect(screen.getByText('測試對象')).toBeTruthy();
    expect(screen.queryByText('分享給小家')).toBeNull();
  });

  it('does not repeat body-only prayers or identical titles and bodies', () => {
    show({ prayers: [{ id: 'body', prayer: '只有禱告內容' }, { id: 'same', title: '相同內容', prayer: ' 相同內容 ' }] });
    expect(screen.getAllByText('只有禱告內容')).toHaveLength(1);
    expect(screen.getAllByText('相同內容')).toHaveLength(1);
  });

  it.each([{ signedIn: false }, { prayersLoading: true }, { prayersError: true }])('hides cached personal prayers when unavailable: %s', state => {
    show({ ...state, prayers: [{ id: 'private', title: '私人禱告', prayer: '私人內容' }] });
    expect(screen.queryByText('私人禱告')).toBeNull();
    expect(screen.queryByText('私人內容')).toBeNull();
    expect(screen.queryByRole('list', { name: '正在等候的禱告' })).toBeNull();
  });

  it('does not show an empty state during loading', () => {
    show({ prayersLoading: true, notesLoading: true, careLoading: true });
    expect(screen.getByRole('status', { name: '正在載入禱告' })).toBeTruthy();
    expect(screen.queryByText('目前沒有正在等候的禱告。')).toBeNull();
    expect(screen.queryByText('還沒有待關心的對象。')).toBeNull();
  });

  it('allows retry and does not present stale data as current after a prayer error', () => {
    const onRetryPrayers = vi.fn();
    show({ prayersError: true, onRetryPrayers, prayers: [{ id: 'old', title: '舊紀錄', prayer: '' }] });
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
