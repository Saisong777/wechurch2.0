import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const source = fs.readFileSync('public/theme-init.js', 'utf8');
function run(saved: string | null, systemDark: boolean, blocked = false) {
  const classes: string[] = [];
  const style: { colorScheme?: string } = {};
  let color = '';
  let cleared = false;
  vm.runInNewContext(source, {
    localStorage: { getItem: () => { if (blocked) throw Error(); return saved; }, removeItem: () => { cleared = true; } },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { classList: { add: (value: string) => classes.push(value) }, style },
      querySelector: () => ({ setAttribute: (_key: string, value: string) => { color = value; } }) },
  });
  return { classes, style, color, cleared };
}
it.each([
  [null, true, 'light'], ['light', true, 'light'], ['dark', false, 'dark'],
  ['system', true, 'dark'], ['system', false, 'light'], ['invalid', true, 'light'],
])('sets the pre-paint theme for %s with device dark=%s', (saved, dark, expected) => {
  const result = run(saved as string | null, dark as boolean);
  expect(result.classes).toEqual([expected]);
  expect(result.style.colorScheme).toBe(expected);
  expect(result.color).toBe(expected === 'dark' ? '#151819' : '#F8FAF9');
  if (saved === 'invalid') expect(result.cleared).toBe(true);
});
it('does not block initial rendering when local storage throws', () => {
  expect(run('dark', true, true).classes).toEqual(['light']);
});
