// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { consumeLoginReturn, rememberLoginReturn, safeLoginReturn } from './loginReturn';
afterEach(() => sessionStorage.clear());
it.each(['https://other.test', '//other.test', '/\\other.test', '/api/logout', '/login', '/reset-password', '/care\n'])('rejects unsafe or looping return destinations: %s', value => {
  expect(safeLoginReturn(value)).toBe('/');
});
it('returns once to the requested internal page, retaining query and fragment', () => {
  rememberLoginReturn('/learn/reading-plans/123/read?day=2#notes');
  expect(consumeLoginReturn(null)).toBe('/learn/reading-plans/123/read?day=2#notes');
  expect(consumeLoginReturn(null)).toBe('/');
});
it('allows a validated explicit destination to override remembered navigation', () => {
  rememberLoginReturn('/care');
  expect(consumeLoginReturn('/groups')).toBe('/groups');
});
