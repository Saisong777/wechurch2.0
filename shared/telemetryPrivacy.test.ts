import { describe, expect, it } from 'vitest';
import { scrubTelemetryText, telemetryMetadata, telemetryPath } from './telemetryPrivacy';

describe('telemetry privacy boundaries', () => {
  it.each([
    '/reset-password?token=TOPSECRET', '/callback#access_token=TOPSECRET',
    'https://example.test/reset?arbitrary=TOPSECRET', '/reset%3Ftoken%3DTOPSECRET',
    '/reset%253Ftoken%253DTOPSECRET', '/reset?token=TOPSECRET with spaces',
    'token: TOPSECRET', '"access_token":"TOPSECRET"', 'Authorization: Bearer TOPSECRET',
    'Bearer TOPSECRET', 'code=TOPSECRET', 'state=TOPSECRET',
    'https://name:TOPSECRET@example.test/path',
    'https://TOPSECRET@example.test/path', 'token=\nTOPSECRET',
    '/reset?token=%0ATOPSECRET', '/callback#%0ATOPSECRET', '/reset?other=%0ATOPSECRET',
  ])('scrubs secret-bearing text %s', value => {
    expect(scrubTelemetryText(value)).not.toContain('TOPSECRET');
  });
  it('keeps stack context while redacting URLs and standalone reset credentials', () => {
    const token = 'abcdef01'.repeat(8);
    const stack = `Error: failed ${token}\n at read (https://example.test/a.js?secret=TOPSECRET:1:2)\n at next (/assets/b.js:3:4)`;
    const clean = scrubTelemetryText(stack);
    expect(clean).not.toContain(token);
    expect(clean).not.toContain('TOPSECRET');
    expect(clean).toContain('at next (/assets/b.js:3:4)');
    expect(scrubTelemetryText('Network unavailable')).toBe('Network unavailable');
  });
  it('retains only safe URL paths and referrer origins', () => {
    expect(telemetryPath('https://name:password@example.test/path?token=SECRET#SECRET')).toBe('/path');
    expect(telemetryPath('/path%3Ftoken=SECRET')).toBe('/path');
    expect(telemetryPath('javascript:alert(1)')).toBeNull();
    expect(telemetryMetadata({ referrer: 'https://name:password@example.test/private?token=SECRET#SECRET', filename: '/a.js?token=SECRET', viewport: '800x600', lineno: 2, colno: 3, type: 'unhandledrejection' }))
      .toEqual({ referrer: 'https://example.test', filename: '/a.js', viewport: '800x600', lineno: 2, colno: 3, type: 'unhandledrejection' });
  });
  it('rejects arbitrary, nested, cyclic and oversized metadata without a raw preview', () => {
    const value: Record<string, unknown> = { search: '?token=SECRET', fragment: 'SECRET', nested: { token: 'SECRET' }, viewport: 'SECRET', lineno: Infinity };
    value.cycle = value;
    expect(telemetryMetadata(value)).toBeNull();
    expect(telemetryMetadata({ filename: `/${'x'.repeat(20000)}?token=SECRET`, referrer: 'SECRET'.repeat(20000) })).not.toHaveProperty('preview');
    expect(JSON.stringify(telemetryMetadata(value)).length).toBeLessThanOrEqual(3000);
    expect(scrubTelemetryText('x'.repeat(20000))).toHaveLength(2000);
  });
});
