// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GraceRecordPage from './GraceRecordPage';

const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-owner' } }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }));
vi.mock('@/hooks/usePersonalPrayers', () => ({ usePersonalPrayers: () => ({
  data: [{ id: 'prayer-1', title: '家庭', prayer: '私人內容', status: 'waiting', createdAt: '2026-09-13T00:00:00Z' }],
  save: { mutateAsync: state.save, isPending: false }, isPending: false, isError: false,
}) }));
vi.mock('@/components/prayer/PersonalPrayerSharing', () => ({
  PrayerDeliveries: () => null, PersonalPrayerShareDialog: () => <div role="dialog">分享預覽</div>,
  usePrayerSharing: () => ({ data: [], isError: false, withdraw: { isPending: false } }),
}));
beforeEach(() => state.save.mockReset());
afterEach(cleanup);
const show = () => render(<MemoryRouter><GraceRecordPage /></MemoryRouter>);
it('opens the composer directly from the home add-prayer action', () => {
  render(<MemoryRouter initialEntries={['/grace-record?new=1']}><GraceRecordPage /></MemoryRouter>);
  expect(screen.getByRole('textbox', { name: '標題' })).toBeVisible();
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
