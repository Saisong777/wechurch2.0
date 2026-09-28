// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CarePage from './CarePage';
import type { CareContact } from '@/hooks/useCareContacts';
const state = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, contacts: [] as CareContact[], isError: false, isLoading: false, createContact: vi.fn(), updateContact: vi.fn(), recordAction: vi.fn(), refetch: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <h1>關懷紀錄</h1> }));
vi.mock('@/hooks/useCareContacts', () => ({ useCareContacts: () => ({ ...state, isCreating: false, isUpdating: false }), useCareHistory: () => ({ data: { pages: [{ actions: [] }] } }) }));
vi.mock('@/components/care/CareVisits', () => ({ CareVisits: () => <div>探訪收件匣</div>, VisitComposer: () => <div>探訪表單</div> }));
beforeEach(() => { state.user = { id: 'owner' }; state.contacts = []; state.isError = false; state.isLoading = false; vi.clearAllMocks(); });
afterEach(cleanup);
const show = () => render(<MemoryRouter><CarePage /></MemoryRouter>);
it('opens personal care without a beta screen, retains privacy', () => {
  show(); expect(screen.getByText('僅自己可見')).toBeTruthy();
  expect(screen.getByRole('button', { name: '新增對象' })).toBeTruthy();
  expect(screen.queryByText(/beta/i)).toBeNull();
});
it('requires login instead of generating fake contacts', () => {
  state.user = null; show();
  expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('button', { name: '新增對象' })).toBeNull();
});
it('keeps loading and errors distinct from an empty list', () => {
  state.isError = true; show(); expect(screen.getByRole('alert')).toHaveTextContent('暫時無法載入');
  expect(screen.queryByText('目前沒有待關心的對象。')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新載入' })); expect(state.refetch).toHaveBeenCalled();
});
it('retains the draft when saving fails', () => {
  state.createContact.mockImplementation((_input, callbacks) => callbacks.onError());
  show(); fireEvent.click(screen.getByRole('button', { name: '新增對象' }));
  fireEvent.change(screen.getByLabelText('名字'), { target: { value: '測試對象' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存' }));
  expect(screen.getByRole('alert')).toHaveTextContent('儲存失敗');
  expect(screen.getByLabelText('名字')).toHaveValue('測試對象');
});
it('asks before discarding a care draft and preserves it when continuing', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '新增對象' }));
  fireEvent.change(screen.getByLabelText('名字'), { target: { value: '尚未儲存' } });
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(screen.getByLabelText('名字')).toHaveValue('尚未儲存');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getByRole('button', { name: '放棄修改並離開' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('button', { name: '新增對象' })).toBeVisible();
  expect(state.createContact).not.toHaveBeenCalled();
});
const contact = { id: 'c1', userId: 'owner', name: '測試朋友', relationship: '同事', need: '需要關心', nextAction: '', prayer: '', lastCaredAt: '2026-01-01', prayerCount: 0, createdAt: '2026-01-01', nextCareDate: '2026-01-02' };
it('shows due contacts again even after a previous visit', () => {
  state.contacts = [contact]; show();
  expect(screen.getByTestId('care-contact-c1')).toBeVisible();
  expect(screen.getByText(/已到期/)).toBeVisible();
});
it('records care inline, preserves errors and locks filtering while editing', () => {
  state.contacts = [contact]; state.recordAction.mockImplementation((_input, callbacks) => callbacks.onError()); show();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: '全部 (1)' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('這次聊到什麼？'), { target: { value: '今天有聊到近況' } });
  fireEvent.click(screen.getByRole('button', { name: /提醒我關心/ }));
  fireEvent.click(screen.getByRole('button', { name: '選日期' }));
  fireEvent.change(screen.getByLabelText('提醒日期'), { target: { value: '2026-10-02' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
  expect(state.recordAction).toHaveBeenCalledWith(expect.objectContaining({ note: '今天有聊到近況', nextCareDate: '2026-10-02' }), expect.anything());
  expect(screen.getByLabelText('這次聊到什麼？')).toHaveValue('今天有聊到近況');
  expect(screen.getByRole('alert')).toHaveTextContent('儲存失敗');
});
it('finds a contact by relationship and restores an archived contact', () => {
  state.contacts = [{ ...contact, isArchived: true }]; show();
  fireEvent.click(screen.getByRole('button', { name: '已封存 (1)' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '同事' } });
  fireEvent.click(screen.getByRole('button', { name: /測試朋友/ }));
  fireEvent.click(screen.getByRole('button', { name: '恢復關懷' }));
  expect(state.updateContact).toHaveBeenCalledWith({ id: 'c1', input: { name: '測試朋友', isArchived: false } }, expect.anything());
});

it('saves only a note without clearing an existing reminder or previous agreement', () => {
  state.contacts = [{ ...contact, nextAction: '下週一起吃飯' }]; show();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  expect(screen.getByRole('button', { name: /2026-01-02 提醒我關心/ })).toBeVisible();
  expect(screen.queryByLabelText('接下來想做什麼')).toBeNull();
  fireEvent.change(screen.getByLabelText('這次聊到什麼？'), { target: { value: '  今天聊得很好  ' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
  const input = state.recordAction.mock.calls[0][0];
  expect(input).toMatchObject({ actionType: 'care', note: '今天聊得很好' });
  expect(input).not.toHaveProperty('nextCareDate');
  expect(input).not.toHaveProperty('nextAction');
});
it('only clears a reminder after explicit cancellation and keeps retry identity', () => {
  state.contacts = [contact]; state.recordAction.mockImplementation((_input, callbacks) => callbacks.onError()); show();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  fireEvent.click(screen.getByRole('button', { name: /提醒我關心/ }));
  fireEvent.click(screen.getByRole('button', { name: '取消提醒' }));
  expect(screen.getByRole('status')).toHaveTextContent('儲存後會取消原有提醒');
  fireEvent.change(screen.getByLabelText('這次聊到什麼？'), { target: { value: '近況穩定' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
  fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
  expect(state.recordAction.mock.calls[0][0]).toMatchObject({ nextCareDate: null });
  expect(state.recordAction.mock.calls[1][0].id).toBe(state.recordAction.mock.calls[0][0].id);
});
it('can save without adding a reminder and does not treat opening options as a draft change', () => {
  state.contacts = [{ ...contact, nextCareDate: null, lastCaredAt: null }]; show();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  fireEvent.click(screen.getByRole('button', { name: '提醒我再關心' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  fireEvent.change(screen.getByLabelText('這次聊到什麼？'), { target: { value: '週末見面聊了聊' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
  expect(state.recordAction.mock.calls[0][0]).not.toHaveProperty('nextCareDate');
});
it('preserves a reminder-only change when the user cancels leaving', () => {
  state.contacts = [contact]; show();
  fireEvent.click(screen.getByRole('button', { name: '記錄關心' }));
  fireEvent.click(screen.getByRole('button', { name: /提醒我關心/ }));
  fireEvent.click(screen.getByRole('button', { name: '一週後' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.getByRole('alertdialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
  expect(screen.getByRole('button', { name: '一週後' })).toHaveAttribute('aria-pressed', 'true');
});
it('keeps legacy fields when editing contact information', () => {
  state.contacts = [{ ...contact, nextAction: '先前約定', prayer: '原有代禱' }]; show();
  fireEvent.click(screen.getByRole('button', { name: /測試朋友/ }));
  fireEvent.click(screen.getByRole('button', { name: '編輯測試朋友' }));
  fireEvent.change(screen.getByLabelText('名字'), { target: { value: '朋友新名字' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存' }));
  expect(state.updateContact).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ nextAction: '先前約定', prayer: '原有代禱', nextCareDate: '2026-01-02' }) }), expect.anything());
});
