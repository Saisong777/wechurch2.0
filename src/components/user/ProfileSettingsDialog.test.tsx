// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';

const auth = vi.hoisted(() => ({ user: { id: 'profile-owner', role: 'member', email: 'test@example.test', displayName: 'Test' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./AvatarCropDialog', () => ({ AvatarCropDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let saved: Record<string, unknown> | undefined;
beforeEach(() => {
  saved = undefined;
  auth.user.role = 'member';
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      saved = JSON.parse(String(options.body));
      return { ok: true };
    }
    return { ok: true, json: async () => ({ displayName: 'Test', birthday: '2000-01-01', userGender: 'other', church: 'IM', address: 'Test address' }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('disables church membership editing and omits it from non-admin saves', async () => {
  render(<ProfileSettingsDialog open onOpenChange={vi.fn()} />);
  const church = await screen.findByTestId('input-church');
  await waitFor(() => expect(church).toHaveValue('IM 行動教會'));
  expect(church).toBeDisabled();
  fireEvent.click(screen.getByTestId('button-save-profile'));
  await waitFor(() => expect(saved).toBeDefined());
  expect(saved).not.toHaveProperty('church');
  expect(saved).toMatchObject({ displayName: 'Test', birthday: '2000-01-01', address: 'Test address' });
});

it('allows an administrator to submit a church change', async () => {
  auth.user.role = 'admin';
  render(<ProfileSettingsDialog open onOpenChange={vi.fn()} />);
  const church = await screen.findByTestId('input-church');
  await waitFor(() => expect(church).toHaveValue('IM 行動教會'));
  expect(church).toBeEnabled();
  expect(screen.getByRole('option', {name:'iM行動教會'})).toBeTruthy();
  expect(screen.getAllByRole('option').filter(option => (option as HTMLOptionElement).value === 'New church')).toHaveLength(0);
  fireEvent.change(church, { target: { value: 'IM 行動教會' } });
  fireEvent.click(screen.getByTestId('button-save-profile'));
  await waitFor(() => expect(saved?.church).toBe('IM 行動教會'));
});
