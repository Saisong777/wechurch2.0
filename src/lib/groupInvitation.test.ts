// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { clearGroupInvitation, groupInvitationFromHash, pendingGroupInvitation } from './groupInvitation';
afterEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/'); });
it('accepts only a group token and restores it across login navigation', () => {
  const token = 'b'.repeat(48);
  expect(groupInvitationFromHash('#invite=' + token)).toBe(token);
  for (const hash of ['#invite=<script>', '#invite=abc', '#ticket=' + token]) expect(groupInvitationFromHash(hash)).toBe('');
  window.history.replaceState(null, '', '/groups#invite=' + token);
  expect(pendingGroupInvitation()).toBe(token);
  window.history.replaceState(null, '', '/groups');
  expect(pendingGroupInvitation()).toBe(token);
  clearGroupInvitation();
  expect(pendingGroupInvitation()).toBe('');
});
