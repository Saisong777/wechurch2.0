// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useMinistryRoleFilter } from './useMinistryRoleFilter';

afterEach(cleanup);
it('clears a renamed selection once both latest sources have loaded', () => {
  const { result, rerender } = renderHook(({ roles, members, ready }) => useMinistryRoleFilter(roles, members, ready), {
    initialProps: { roles: [{ name: '全職同工' }], members: [{ ministryRoles: ['全職同工'] }], ready: true },
  });
  act(() => result.current.setMinistryRole('全職同工'));
  rerender({ roles: [{ name: '行政同工' }], members: [{ ministryRoles: ['全職同工'] }], ready: true });
  expect(result.current.ministryRole).toBe('全職同工');
  rerender({ roles: [{ name: '行政同工' }], members: [{ ministryRoles: ['行政同工'] }], ready: true });
  expect(result.current.ministryRole).toBe('');
  expect(result.current.options).toEqual(['行政同工']);
});
it('keeps the current selection readable during loading or failed refresh, then clears a removed title', () => {
  const { result, rerender } = renderHook(({ roles, ready }) => useMinistryRoleFilter(roles, [], ready), {
    initialProps: { roles: [{ name: '同工' }], ready: true },
  });
  act(() => result.current.setMinistryRole('同工'));
  rerender({ roles: [], ready: false });
  expect(result.current.ministryRole).toBe('同工');
  expect(result.current.options).toContain('同工');
  rerender({ roles: [], ready: true });
  expect(result.current.ministryRole).toBe('');
});
it('keeps unassigned catalog titles selected even when the filter finds zero people', () => {
  const { result } = renderHook(() => useMinistryRoleFilter([{ name: '全職同工' }], [], true));
  act(() => result.current.setMinistryRole('全職同工'));
  expect(result.current.ministryRole).toBe('全職同工');
});
