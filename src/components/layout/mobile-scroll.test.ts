// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { parse } from 'postcss';
import { expect, it } from 'vitest';

const html = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
const css = parse(readFileSync('src/index.css', 'utf8'));
function declarations(selector: string, property: string) {
  const values: string[] = [];
  css.walkRules(selector, rule => {
    rule.walkDecls(property, declaration => { values.push(declaration.value); });
  });
  return values;
}

it('keeps document roots free of inline viewport-height and scroll-container overrides', () => {
  for (const element of [html.documentElement, html.body, html.getElementById('root')!]) {
    expect(element.getAttribute('style')).toBeNull();
  }
  expect(declarations('body', 'height')).toEqual([]);
  expect(declarations('html', 'height')).toEqual([]);
  expect(declarations('body', 'overflow')).toEqual([]);
  expect(declarations('body', 'overflow-x')).toEqual(['clip']);
  expect(declarations('html', 'overflow-x')).toEqual(['clip']);
});

it('assigns viewport minimum to the shell, not nested shared mobile pages', () => {
  expect(declarations('.app-shell', 'min-height')).toEqual(['100vh', '100svh']);
  const rules: string[] = [];
  css.walkRules('.mobile-page-content > .min-h-screen', rule => {
    expect(rule.parent?.type).toBe('atrule');
    expect(rule.parent && 'params' in rule.parent ? rule.parent.params : '').toBe('(max-width: 767px)');
    rule.walkDecls('min-height', declaration => { rules.push(declaration.value); });
  });
  expect(rules).toEqual(['0']);
});
