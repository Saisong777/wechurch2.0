// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { HomeModeSwitch } from './HomeModeSwitch';
import { useHomeMode } from '@/hooks/useHomeMode';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => localStorage.clear());
function Demo() {
  const { mode, changeMode } = useHomeMode();
  const location = useLocation();
  const navigate = useNavigate();
  return <><HomeModeSwitch mode={mode} onChange={changeMode} /><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>上一頁</button></>;
}
function show(url = '/') { return render(<MemoryRouter initialEntries={[url]}><Demo /></MemoryRouter>); }
const modeButton = (name: string) => screen.getByRole('button', { name });

describe('home display mode', () => {
  it('defaults to traditional, preserves query parameters, and restores the no-mode entry on Back', async () => {
    show('/?styleLab=1&dashboardVariant=d&invite=keep');
    expect(modeButton('傳統模式').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(modeButton('城堡模式遊戲化'));
    expect(modeButton('城堡模式遊戲化').getAttribute('aria-pressed')).toBe('true');
    const params = new URLSearchParams(screen.getByTestId('location').textContent || '');
    expect(params.get('styleLab')).toBe('1');
    expect(params.get('dashboardVariant')).toBe('d');
    expect(params.get('invite')).toBe('keep');
    expect(params.get('mode')).toBe('castle');
    fireEvent.click(modeButton('上一頁'));
    await vi.waitFor(() => expect(modeButton('傳統模式').getAttribute('aria-pressed')).toBe('true'));
  });
  it('prioritizes direct URLs over storage and restores an explicit castle entry on Back', async () => {
    localStorage.setItem('wechurch_home_mode_v1', 'traditional');
    show('/?mode=castle');
    expect(modeButton('城堡模式遊戲化').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(modeButton('傳統模式'));
    fireEvent.click(modeButton('上一頁'));
    await vi.waitFor(() => expect(modeButton('城堡模式遊戲化').getAttribute('aria-pressed')).toBe('true'));
  });
  it('remembers a chosen mode on a fresh visit', () => {
    localStorage.setItem('wechurch_home_mode_v1', 'castle');
    show();
    expect(modeButton('城堡模式遊戲化').getAttribute('aria-pressed')).toBe('true');
  });
  it('keeps switching available if storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    show();
    fireEvent.click(modeButton('城堡模式遊戲化'));
    expect(modeButton('城堡模式遊戲化').getAttribute('aria-pressed')).toBe('true');
  });
});
