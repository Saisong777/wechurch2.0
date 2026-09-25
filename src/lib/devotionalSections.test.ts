import { expect, it } from 'vitest';
import { devotionalSections } from './devotionalSections';

it('retains unstructured and unknown headings verbatim', () => {
  const text = '未知標題：不可丟棄\n\n內文提到今日禱告：不在行首，不是段落\n原文。';
  expect(devotionalSections(text)).toEqual([{ title: '靈修短文', body: text, panel: 'devotion' }]);
});
it('keeps intro, repeated headings and empty sections without rewriting text', () => {
  const text = '前言\n\n真理導航：第一段\n\n真理導航: 第二段\n生活練習：\n今日禱告：原禱告\n今日金句卡：\n經文原樣 #主題';
  const sections = devotionalSections(text);
  expect(sections.map(section => section.title)).toEqual(['靈修短文', '真理導航', '真理導航', '生活練習', '今日禱告', '今日金句卡']);
  expect(sections.map(section => section.body)).toEqual(['前言\n\n', '第一段\n\n', '第二段\n', '\n', '原禱告\n', '\n經文原樣 #主題']);
  expect(sections.map(section => section.panel)).toEqual(['devotion', 'devotion', 'devotion', 'devotion', 'prayer', 'prayer']);
});
it('accepts CRLF and indentation while retaining remaining body whitespace', () => {
  const sections = devotionalSections('  今日重點：焦點\r\n\r\n 今日禱告: 禱告\r\n');
  expect(sections[0].body).toBe('焦點\r\n\r\n');
  expect(sections[1].body).toBe('禱告\r\n');
});
it('never interprets HTML or invents sections for an empty article', () => {
  expect(devotionalSections('  ')).toEqual([]);
  expect(devotionalSections('<script>alert(1)</script>')[0].body).toBe('<script>alert(1)</script>');
});
