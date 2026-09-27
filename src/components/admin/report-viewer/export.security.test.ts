import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { generatePrintHTML, generatePPTHTML } from './export';
import type { GroupReport } from './parse';

vi.mock('pptxgenjs', () => ({ default: class {} }));
const payload = '</title><img src=x onerror="attack()"><script>attack()</script>&\'"';
const report = (extra: Partial<GroupReport> = {}): GroupReport => ({ groupNumber: 1, raw: '', ...extra });
const documentFor = (html: string) => new JSDOM(html).window.document;
const fields: (keyof GroupReport)[] = ['groupInfo', 'members', 'verse', 'raw', 'contributions', 'themes', 'observations', 'insights', 'applications', 'topic', 'theology', 'highlights', 'divergence', 'soulGym', 'summary'];

describe('report HTML output encoding', () => {
  it.each(fields)('keeps print field %s as text', field => {
    const doc = documentFor(generatePrintHTML([report({ [field]: payload })], payload));
    expect(doc.querySelector('img, script, [onerror]')).toBeNull();
    expect(doc.body.textContent).toContain(payload);
    expect(doc.title).toContain(payload);
  });
  it('escapes single-group titles even if the runtime value is not a number', () => {
    const group = payload as unknown as number;
    const doc = documentFor(generatePrintHTML([report({ groupNumber: group })], 'John 1', group));
    expect(doc.querySelector('img, script')).toBeNull();
    expect(doc.querySelector('h1')?.textContent).toContain(payload);
  });
  it.each(fields)('keeps PPT HTML field %s inert and preserves its fixed navigation script', field => {
    const doc = documentFor(generatePPTHTML([report({ [field]: payload })], payload));
    expect(doc.querySelector('img, [onerror]')).toBeNull();
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('script')?.textContent).not.toContain('attack');
    expect(doc.title).toContain(payload);
  });
  it('encodes runtime group labels after numeric selection', () => {
    const group = { valueOf: () => 1, toString: () => payload } as unknown as number;
    const doc = documentFor(generatePPTHTML([report({ groupNumber: group })]));
    expect(doc.querySelector('img, [onerror]')).toBeNull();
    expect(doc.querySelector('.slide-title')?.textContent).toContain(payload);
  });
  it('preserves printable text, Unicode, line breaks and generated layout', () => {
    const text = 'A & B < C\n第二行 "quoted"';
    const print = documentFor(generatePrintHTML([report({ observations: text })]));
    expect(print.querySelector('.section-content')?.textContent).toBe(text);
    const ppt = documentFor(generatePPTHTML([report({ observations: `**A & B**\n- 第二行` })]));
    expect(ppt.querySelector('.box-content')?.textContent).toBe('A & B\n• 第二行');
  });
});
