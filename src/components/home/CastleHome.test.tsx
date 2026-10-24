// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CastleHome, type CastleHomeProps } from './CastleHome';

vi.mock('./castle/CastleScene', () => ({ default: ({ places, onSelect }: { places: { id: string; name: string; label: string }[]; onSelect: (id: string) => void }) => <div>{places.map(place => <button key={place.id} onClick={() => onSelect(place.id)} aria-label={`${place.name}・${place.label}`}>{place.name}</button>)}</div> }));

afterEach(cleanup);
const defaults: CastleHomeProps = { churchName: 'iM 行動教會', featureEnabled: () => true, featuresLoading: false, scripture: { reference: '測試經文', state: 'ready' }, hasDraft: false, onOpenNote: vi.fn(), showAdmin: false, showPastoral: false };
const show = (props: Partial<CastleHomeProps> = {}) => render(<MemoryRouter><CastleHome {...defaults} {...props} /></MemoryRouter>);

describe('castle navigation', () => {
  it('keeps all seven existing destinations accessible without using the image', () => {
    show();
    const list = screen.getByRole('navigation', { name: '城堡所有地點' });
    const hrefs = within(list).getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(['/learn/church-reading', '/learn/bible', '/share', '/groups', '/grace-record?view=grace', '/walls', '/play']);
    expect(screen.queryByRole('link', { name: /牧養概況/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /主持與管理/ })).toBeNull();
  });

  it('hides disabled features from markers, details, and the alternative list', () => {
    const { container } = show({ featureEnabled: key => key !== 'we_play' && key !== 'we_learn' });
    expect(container.querySelector('a[href="/play"]')).toBeNull();
    expect(container.querySelector('a[href="/learn/church-reading"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /相聚小亭/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /同行主堡/ })).toBeNull();
    expect(screen.queryByText('今日讀經：測試經文')).toBeNull();
  });

  it('opens a selected location and counts unique browsing without devotional completion claims', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: '禱告花園・禱告' }));
    const panel = screen.getByRole('region', { name: '目前選擇的地點' });
    expect(within(panel).getByRole('link', { name: '前往禱告' }).getAttribute('href')).toBe('/share');
    expect(screen.getByText('1 / 7')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '禱告花園・禱告' }));
    expect(screen.getByText('1 / 7')).toBeTruthy();
    expect(screen.queryByText(/禱告完成|靈修完成|積分|排行榜/)).toBeNull();
  });

  it.each(['loading', 'error', 'unpublished'] as const)('does not show fallback reading as published during %s', state => {
    show({ scripture: { reference: '不可顯示的備援經文', state } });
    expect(screen.queryByText(/不可顯示的備援經文/)).toBeNull();
    expect(screen.getByRole('link', { name: '前往每日靈修' })).toBeTruthy();
  });

  it('supports night mode, motion pause, and unsynced drafts', () => {
    const openNote = vi.fn();
    const { container } = show({ hasDraft: true, onOpenNote: openNote, showAdmin: true, showPastoral: true });
    fireEvent.click(screen.getByRole('button', { name: '切換夜間景色' }));
    expect(container.querySelector('.castle-home--night')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '暫停地圖動態' }));
    expect(container.querySelector('.castle-home--paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '開啟草稿' }));
    expect(openNote).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: '牧養概況' }).getAttribute('href')).toBe('/work');
    expect(screen.getByRole('link', { name: '主持與管理' }).getAttribute('href')).toBe('/admin');
  });
});
