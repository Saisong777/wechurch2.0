// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CarePage from './CarePage';
const state = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, isError: false, isLoading: false, createContact: vi.fn(), refetch: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => <h1>關懷紀錄</h1> }));
vi.mock('@/hooks/useCareContacts', () => ({ useCareContacts: () => ({ ...state, contacts: [], isCreating: false, isUpdating: false }) }));
beforeEach(() => { state.user = { id: 'owner' }; state.isError = false; state.isLoading = false; state.createContact.mockReset(); });
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
