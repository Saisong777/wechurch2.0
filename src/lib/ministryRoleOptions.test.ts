import { expect, it } from 'vitest';
import { ministryRoleOptions } from './ministryRoleOptions';

it('includes unassigned catalog titles and preserves distinct coworker titles', () => {
  expect(ministryRoleOptions([{ name: '同工' }, { name: '全職同工' }, { name: '自訂職分' }], []))
    .toEqual(['同工', '全職同工', '自訂職分']);
});

it('deduplicates catalog and assigned titles while retaining searchable legacy titles', () => {
  expect(ministryRoleOptions([{ name: '同工' }], [{ ministryRoles: ['同工', '全職同工'] }, {}, { ministryRoles: ['全職同工'] }]))
    .toEqual(['同工', '全職同工']);
});

it('reflects catalog renames without inventing unconfigured titles', () => {
  expect(ministryRoleOptions([{ name: '行政同工' }], [])).toEqual(['行政同工']);
  expect(ministryRoleOptions([], [])).toEqual([]);
});
