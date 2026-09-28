// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GraceRecordPage from './GraceRecordPage';

const state = vi.hoisted(() => ({ save: vi.fn(), owner: 'test-owner' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.owner } }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }));
vi.mock('@/hooks/usePersonalPrayers', () => ({ usePersonalPrayers: () => ({
  data: [{ id: 'prayer-1', title: '家庭', prayer: '私人內容', response: '原有帶領', status: 'waiting', createdAt: '2026-09-13T00:00:00Z', updatedAt: '2026-09-13T00:00:00Z' }],
  save: { mutateAsync: state.save, isPending: false }, isPending: false, isError: false,
}) }));
vi.mock('@/components/prayer/PersonalPrayerSharing', () => ({
  PrayerDeliveries: () => null, PersonalPrayerShareDialog: () => <div role="dialog">分享預覽</div>,
  usePrayerSharing: () => ({ data: [], isError: false, withdraw: { isPending: false } }),
}));
beforeEach(() => { state.save.mockReset(); state.owner = 'test-owner'; });
afterEach(cleanup);
const show = () => render(<MemoryRouter><GraceRecordPage /></MemoryRouter>);
it('opens the composer directly from the home add-prayer action', () => {
  render(<MemoryRouter initialEntries={['/grace-record?new=1']}><GraceRecordPage /></MemoryRouter>);
  expect(screen.getByRole('textbox', { name: '標題' })).toBeVisible();
});
it('edits the original inline without opening a dialog or sharing', async () => {
  show();
  fireEvent.click(screen.getByRole('button', {name:'編輯'}));
  fireEvent.change(screen.getByLabelText('私人禱告內容'), {target:{value:'更新的私人內容'}});
  expect(screen.getByRole('searchbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'儲存修改'}));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.objectContaining({input:expect.objectContaining({prayer:'更新的私人內容',expectedUpdatedAt:'2026-09-13T00:00:00Z',closePublicShare:false})})));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('appends waiting progress without losing history or ending the prayer', async () => {
  show();
  fireEvent.click(screen.getByRole('button', {name:'記錄'}));
  fireEvent.change(screen.getByLabelText('近況與恩典回應（僅自己可見）'), {target:{value:'繼續交託'}});
  fireEvent.click(screen.getByRole('button', {name:'儲存進展'}));
  await waitFor(() => expect(state.save).toHaveBeenCalled());
  const input = state.save.mock.calls[0][0].input;
  expect(input.status).toBe('waiting');
  expect(input.response).toContain('原有帶領');
  expect(input.response).toContain('繼續交託');
  expect(input.closePublicShare).toBe(false);
});
it('searches private progress and clears private drafts on account changes', () => {
  const view = show();
  fireEvent.change(screen.getByRole('searchbox'), {target:{value:'不存在'}});
  expect(screen.queryByRole('article')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), {target:{value:'原有帶領'}});
  expect(screen.getByRole('article')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'新增禱告'}));
  fireEvent.change(screen.getByLabelText('標題'), {target:{value:'私人草稿'}});
  state.owner = 'another-owner';
  view.rerender(<MemoryRouter><GraceRecordPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'新增禱告'}));
  expect(screen.getByLabelText('標題')).toHaveValue('');
});
it('shows private records first and keeps a collapsed composer draft', () => {
  show();
  expect(screen.getByText('私人原稿 · 僅自己可見')).toBeVisible();
  expect(screen.queryByRole('textbox', { name: '標題' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '新增禱告' }));
  fireEvent.change(screen.getByLabelText('標題'), { target: { value: '尚未儲存的交託' } });
  fireEvent.click(screen.getByRole('button', { name: '收起新增' }));
  fireEvent.click(screen.getByRole('button', { name: '新增禱告' }));
  expect(screen.getByLabelText('標題')).toHaveValue('尚未儲存的交託');
  expect(state.save).not.toHaveBeenCalled();
});
it('opens the share action only after a record is selected', () => {
  show();
  expect(screen.queryByRole('button', { name: '分享選取的禱告' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: '選取 家庭' }));
  fireEvent.click(screen.getByRole('button', { name: '分享選取的禱告' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('分享預覽');
  expect(state.save).not.toHaveBeenCalled();
});
it('keeps the draft on failure and closes only after a successful save', async () => {
  state.save.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  show();
  fireEvent.click(screen.getByRole('button', { name: '新增禱告' }));
  fireEvent.change(screen.getByLabelText('標題'), { target: { value: '測試交託' } });
  fireEvent.click(screen.getByRole('button', { name: '開始禱告' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('標題')).toHaveValue('測試交託');
  fireEvent.click(screen.getByRole('button', { name: '開始禱告' }));
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '標題' })).toBeNull());
  expect(state.save.mock.calls[1][0].id).toBe(state.save.mock.calls[0][0].id);
});
