import { describe, expect, it } from 'vitest';
import { mayManageStudySession } from './studySessionPolicy';

describe('study session manager boundaries', () => {
  it.each(['senior_pastor', 'pastor', 'minister', 'group_leader', 'leader', 'future_leader'])('scopes %s to owned sessions or own church', role => {
    const user = { id: 'leader', church: 'IM' };
    expect(mayManageStudySession(role, user, { churchUnit: 'iM 行動教會' })).toBe(true);
    expect(mayManageStudySession(role, user, { churchUnit: 'other' })).toBe(false);
    expect(mayManageStudySession(role, user, { ownerId: user.id, churchUnit: 'other' })).toBe(true);
    expect(mayManageStudySession(role, { id: 'leader' }, {})).toBe(false);
  });
  it('requires a manager role, never merely matching church or owner ID', () => {
    expect(mayManageStudySession('member', { id: 'owner', church: 'IM' }, { ownerId: 'owner', churchUnit: 'IM' })).toBe(false);
    expect(mayManageStudySession(null, undefined, {})).toBe(false);
  });
  it('retains explicit site administrator access', () => {
    expect(mayManageStudySession('admin', { id: 'admin' }, {})).toBe(true);
  });
});
