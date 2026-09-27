import { expect, it, vi } from 'vitest';
import { createPasswordWorkLimiter, PasswordWorkBusyError } from './authPasswordWork';

it('bounds simultaneous bcrypt work without building an unbounded queue', async () => {
  const run = createPasswordWorkLimiter();
  const releases: Array<() => void> = [];
  const active = Array.from({ length: 4 }, () => run(() => new Promise<void>(resolve => releases.push(resolve))));
  const excess = vi.fn(async () => true);
  await expect(run(excess)).rejects.toBeInstanceOf(PasswordWorkBusyError);
  expect(excess).not.toHaveBeenCalled();
  releases[0](); await active[0];
  await expect(run(async () => 'available')).resolves.toBe('available');
  releases.slice(1).forEach(release => release()); await Promise.all(active);
});

it('releases capacity on rejected or synchronously throwing work', async () => {
  const run = createPasswordWorkLimiter(1);
  await expect(run(async () => { throw new Error('bcrypt rejected'); })).rejects.toThrow('bcrypt rejected');
  await expect(run(() => { throw new Error('bcrypt threw'); })).rejects.toThrow('bcrypt threw');
  await expect(run(async () => true)).resolves.toBe(true);
});
