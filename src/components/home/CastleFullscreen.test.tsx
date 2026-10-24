// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { CastleHome, type CastleHomeProps } from './CastleHome';
import { HomeModeSwitch } from './HomeModeSwitch';
import { useHomeMode } from '@/hooks/useHomeMode';
vi.mock('./castle/CastleScene', () => ({ default: () => <div data-testid="scene-slot" /> }));
const defaults: CastleHomeProps = { churchName: 'iM 行動教會', featureEnabled: () => true, featuresLoading: false, scripture: { reference: '測試經文', state: 'ready' }, hasDraft: false, onOpenNote: vi.fn(), showAdmin: false, showPastoral: false };
beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('castle-immersive-active'); document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'clip'; });
afterEach(() => { cleanup(); document.body.style.overflow = ''; document.documentElement.style.overflow = ''; vi.restoreAllMocks(); });
function Homepage() { const { mode, changeMode } = useHomeMode(); return mode === 'castle' ? <CastleHome {...defaults} modeControls={<HomeModeSwitch mode={mode} onChange={changeMode} />} /> : <><HomeModeSwitch mode={mode} onChange={changeMode} /><p>傳統首頁內容</p></>; }
function show(props: Partial<CastleHomeProps> = {}) { return render(<MemoryRouter><CastleHome {...defaults} {...props} /></MemoryRouter>); }

describe('immersive homepage presentation', () => {
  it('leaves host and dialog inline scroll styles untouched and cleans its class on exit, including StrictMode', () => {
    const view = render(<StrictMode><MemoryRouter><CastleHome {...defaults} /></MemoryRouter></StrictMode>);
    expect(document.documentElement.classList.contains('castle-immersive-active')).toBe(true);
    expect(document.body.style.overflow).toBe('auto'); expect(document.documentElement.style.overflow).toBe('clip');
    // A dialog can own a newer inline value without the castle overwriting it later.
    document.body.style.overflow = 'hidden'; view.unmount();
    expect(document.documentElement.classList.contains('castle-immersive-active')).toBe(false); expect(document.body.style.overflow).toBe('hidden'); expect(document.documentElement.style.overflow).toBe('clip');
  });
  it('restores ordinary chrome when switching mode or navigating away through a real destination', () => {
    render(<MemoryRouter initialEntries={['/?mode=castle']}><Routes><Route path="/" element={<Homepage />} /><Route path="/learn/bible" element={<p>聖經頁面</p>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '傳統模式' })); expect(screen.getByText('傳統首頁內容')).toBeTruthy(); expect(document.documentElement.classList.contains('castle-immersive-active')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '城堡模式遊戲化' })); expect(document.documentElement.classList.contains('castle-immersive-active')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '開啟城堡地點' })); fireEvent.click(screen.getByRole('link', { name: /話語之塔/ }));
    expect(screen.getByText('聖經頁面')).toBeTruthy(); expect(document.documentElement.classList.contains('castle-immersive-active')).toBe(false);
  });
  it('opens the two self-contained panel sections and returns keyboard focus to stable triggers', () => {
    show(); const compactTrigger = screen.getByRole('button', { name: '展開城堡地點' });
    fireEvent.click(compactTrigger); expect(screen.getByRole('button', { name: '收合城堡面板' })).toBe(document.activeElement);
    expect(screen.getByRole('navigation', { name: '城堡所有地點' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(document.activeElement).toBe(compactTrigger); expect(screen.queryByRole('navigation', { name: '城堡所有地點' })).toBeNull();
    const menu = screen.getByRole('button', { name: '開啟城堡選單' }); fireEvent.click(menu); fireEvent.click(screen.getByRole('button', { name: '收合城堡面板' })); expect(document.activeElement).toBe(menu);
  });
  it('keeps supplied account, navigation and church controls actionable, with notices and draft retry always accessible', () => {
    const account = vi.fn(), scope = vi.fn(), retry = vi.fn(), draft = vi.fn();
    show({ hasDraft: true, onOpenNote: draft, accountControls: <button onClick={account}>原帳號與外觀控制</button>, churchControls: <button onClick={scope}>原教會範圍控制</button>, navigationControls: <nav aria-label="原導覽"><Link to="/groups">原小家入口</Link></nav>, notices: <div role="alert">筆記載入失敗<button onClick={retry}>原筆記重試</button></div> });
    fireEvent.click(screen.getByRole('button', { name: '原筆記重試' })); fireEvent.click(screen.getByRole('button', { name: '開啟草稿' })); expect(retry).toHaveBeenCalledOnce(); expect(draft).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '開啟城堡選單' })); fireEvent.click(screen.getByRole('button', { name: '原帳號與外觀控制' })); fireEvent.click(screen.getByRole('button', { name: '原教會範圍控制' }));
    expect(account).toHaveBeenCalledOnce(); expect(scope).toHaveBeenCalledOnce(); expect(screen.getByRole('link', { name: '原小家入口' }).getAttribute('href')).toBe('/groups');
    expect(screen.getByRole('link', { name: '城堡信箱' }).getAttribute('href')).toBe('/feedback');
  });
});
