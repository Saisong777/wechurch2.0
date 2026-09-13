import { describe, expect, it, vi } from 'vitest';
import { filterCrmMembers, getCrmStats, getMemberPage, mergeCrmMembers, runCrmBatch, type CrmSnapshot } from './crm-members';
import type { PotentialMember } from '@/hooks/useUnifiedMembers';

const now = Date.parse('2026-09-11T12:00:00Z');
const contact = (id: string, changes: Partial<PotentialMember> = {}): PotentialMember => ({
  id, userId: null, email: `${id}@example.invalid`, name: `測試 ${id}`, gender: null,
  church: 'iM', status: 'pending', subscribed: true, sessionsCount: 2,
  firstJoinedAt: '2026-09-10T12:00:00Z', lastSessionAt: '2026-09-10T12:00:00Z',
  createdAt: '2026-09-10T12:00:00Z', updatedAt: '2026-09-10T12:00:00Z', ...changes,
});
const snapshot: CrmSnapshot = {
  users: [{ id: 'u1', email: 'LEADER@example.invalid', displayName: '測試小組長', church: 'iM', createdAt: '2026-09-10T12:00:00Z' }],
  roles: [{ userId: 'u1', role: 'leader' }],
  potentialMembers: [contact('linked', { userId: 'u1' }), contact('pending'), contact('declined', { status: 'declined' })],
};

describe('CRM member snapshot', () => {
  it('merges linked profiles exactly once and preserves source input', () => {
    const members = mergeCrmMembers(snapshot);
    expect(members).toHaveLength(3);
    expect(members[0]).toMatchObject({ id: 'u1', role: 'leader', potentialMemberId: 'linked', sessionsCount: 2 });
    expect(snapshot.potentialMembers).toHaveLength(3);
  });
  it('counts real people without counting linked contacts again', () => {
    expect(getCrmStats(snapshot, mergeCrmMembers(snapshot), now)).toMatchObject({
      totalCount: 3, registeredCount: 1, unlinkedCount: 2, linkedCount: 1, pendingCount: 1, newThisWeek: 3,
    });
  });
  it('filters statuses across the whole list and excludes nonmatching registered accounts', () => {
    expect(filterCrmMembers(mergeCrmMembers(snapshot), { tab: 'all', status: 'pending' }).map(m => m.id)).toEqual(['pending']);
  });
  it('recognizes the old and new small-group leader role names', () => {
    expect(filterCrmMembers(mergeCrmMembers(snapshot), { tab: 'all', role: 'group_leader' }).map(m => m.id)).toEqual(['u1']);
  });
  it('searches Chinese labels, trimmed words and case-insensitive email', () => {
    const members = mergeCrmMembers(snapshot);
    expect(filterCrmMembers(members, { tab: 'all', search: '  小組長 leader@  ' }).map(m => m.id)).toEqual(['u1']);
    expect(filterCrmMembers(members, { tab: 'all', search: '待跟進' }).map(m => m.id)).toEqual(['pending']);
    expect(filterCrmMembers(members, { tab: 'all', search: '不存在' })).toEqual([]);
  });
  it('does not change scope-wide stats when filtering members', () => {
    const members = mergeCrmMembers(snapshot);
    filterCrmMembers(members, { tab: 'potential', status: 'declined' });
    expect(getCrmStats(snapshot, members, now).totalCount).toBe(3);
  });
  it('bounds pages, handles deletions on the last page, and handles empty lists', () => {
    const rows = Array.from({ length: 51 }, (_, i) => i);
    expect(getMemberPage(rows, 1, 25).rows).toHaveLength(25);
    expect(getMemberPage(rows, 2, 25).rows[0]).toBe(25);
    expect(getMemberPage(rows.slice(0, 25), 3, 25)).toMatchObject({ page: 1, pageCount: 1 });
    expect(getMemberPage([], 3, 25)).toEqual({ page: 1, pageCount: 1, rows: [] });
  });
});

describe('CRM batch outcomes', () => {
  it('retains denied and network failures rather than reporting a false success', async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error('offline'));
    expect(await runCrmBatch(['one', 'two', 'three', 'one'], { type: 'update', updates: { status: 'member' } }, request)).toEqual({ succeeded: ['one'], failed: ['two', 'three'] });
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ status: 'member' });
  });
  it('deletes only explicitly selected IDs', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    await runCrmBatch(['selected'], { type: 'delete' }, request);
    expect(request).toHaveBeenCalledWith('/api/potential-members/selected', { method: 'DELETE' });
  });
});
