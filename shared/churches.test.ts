import { expect, it } from 'vitest';
import { churchDisplayName, getChurchAliases, getKnownChurchOptions, normalizeChurch } from './churches';

it('offers only iM while retaining the existing data identifier', () => {
  expect(getKnownChurchOptions()).toEqual([{id:'IM 行動教會',name:'iM行動教會'}]);
  for (const alias of getChurchAliases('iM行動教會')) {
    expect(normalizeChurch(alias)).toBe('IM 行動教會');
    expect(churchDisplayName(alias)).toBe('iM行動教會');
  }
});
it('does not turn an unknown or unassigned church into iM permission scope', () => {
  expect(normalizeChurch('Other church')).toBe('Other church');
  expect(getChurchAliases('Other church')).toEqual(['Other church']);
  expect(normalizeChurch(null)).toBeNull();
  expect(getChurchAliases('__unassigned')).toEqual([]);
});
