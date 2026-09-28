import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { contentSecurityPolicy, reportSlideScriptHash } from './contentSecurityPolicy';
import { reportSlideScript } from '../shared/reportSlideScript';

describe('content security policy', () => {
  it('blocks inline scripts, event handlers, plugins and injected base URLs in production', () => {
    const directives = contentSecurityPolicy().split('; ');
    expect(directives.find(value => value.startsWith('script-src '))).toBe(`script-src 'self' 'sha256-${reportSlideScriptHash}'`);
    expect(directives).toContain("script-src-attr 'none'");
    expect(directives).toContain("object-src 'none'");
    expect(directives).toContain("base-uri 'none'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy()).not.toContain('unsafe-eval');
  });
  it('allows only the exact static offline slideshow controller', () => {
    expect(createHash('sha256').update(reportSlideScript).digest('base64')).toBe(reportSlideScriptHash);
    expect(reportSlideScript).not.toContain('</script>');
    expect(createHash('sha256').update(`${reportSlideScript};attack()`).digest('base64')).not.toBe(reportSlideScriptHash);
  });
  it('keeps Vite development scripts separate from production permissions', () => {
    expect(contentSecurityPolicy(true)).toContain("script-src 'self' 'unsafe-inline'");
    expect(contentSecurityPolicy(true)).not.toContain('sha256-');
    expect(contentSecurityPolicy(false)).not.toContain(' ws:');
  });
  it.each(['index.html', 'public/bible-quiz.html'])('serves executable scripts externally in %s', file => {
    const doc = new JSDOM(readFileSync(file, 'utf8')).window.document;
    for (const script of doc.querySelectorAll('script')) {
      expect(script.getAttribute('src')).toMatch(/^\//);
      expect(script.textContent?.trim()).toBe('');
    }
    for (const element of doc.querySelectorAll('*')) {
      expect(element.getAttributeNames().filter(name => /^on/i.test(name))).toEqual([]);
    }
  });
  it('renders safe, usable fallback buttons without inline event handlers', () => {
    const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only', url: 'https://example.test/' });
    dom.window.eval(readFileSync('public/load-error.js', 'utf8'));
    dom.window.dispatchEvent(new dom.window.ErrorEvent('error', { message: 'Loading chunk failed <script>attack()</script>' }));
    expect(dom.window.document.querySelectorAll('button')).toHaveLength(2);
    expect(dom.window.document.querySelector('[onclick], script')).toBeNull();
    expect(dom.window.document.querySelector('#load-error-retry')?.textContent).toBe('重新載入');
    dom.window.close();
  });
});
