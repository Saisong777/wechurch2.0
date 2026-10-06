import { expect, it } from 'vitest';
import { churchDisplayName, getChurchAliases, getKnownChurchOptions, normalizeChurch } from './churches';

it('offers the three approved churches while retaining the existing iM identifier', () => {
  expect(getKnownChurchOptions()).toEqual([{id:'IM 行動教會',name:'iM行動教會'},{id:'桃園WeChurch',name:'桃園WeChurch'},{id:'火樂',name:'火樂'}]);
  for (const alias of getChurchAliases('iM行動教會')) {
    expect(normalizeChurch(alias)).toBe('IM 行動教會');
    expect(churchDisplayName(alias)).toBe('iM行動教會');
  }
});
it('does not turn an unknown or unassigned church into iM permission scope', () => {
  expect(normalizeChurch('Other church')).toBe('Other church');
  expect(getChurchAliases('Other church')).toEqual(['Other church']);
  expect(getKnownChurchOptions().some(option=>option.id===normalizeChurch('Other church'))).toBe(false);
  expect(normalizeChurch(null)).toBeNull();
  expect(getChurchAliases('__unassigned')).toEqual([]);
});

it('resolves supported new aliases without changing stable identifiers or labels', () => {
  for(const [alias,id] of [['桃園 WeChurch','桃園WeChurch'],['火樂教會','火樂']]){
    expect(normalizeChurch(alias)).toBe(id);
    expect(churchDisplayName(alias)).toBe(id);
    expect(getChurchAliases(alias)).toContain(id);
  }
  expect(normalizeChurch('')).toBeNull();
  expect(getKnownChurchOptions().some(option=>option.id===normalizeChurch('__unassigned'))).toBe(false);
});
