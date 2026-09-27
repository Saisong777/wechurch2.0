import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('development host and CI security configuration', () => {
  it.each(['../vite.config.ts', './vite.ts'])('keeps Vite host checking enabled in %s', file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(source).toMatch(/allowedHosts:\s*\[\]/);
    expect(source).not.toMatch(/allowedHosts:\s*true/);
  });
  it('runs the project typecheck rather than the empty root project', () => {
    const source = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    expect(source).toMatch(/name: Typecheck\s+run: npm run typecheck/);
    expect(source).not.toMatch(/run: npx tsc --noEmit\s/);
  });
});
