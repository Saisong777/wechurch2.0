// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { initPlatformTelemetry } from './platform-telemetry';

afterEach(() => vi.unstubAllGlobals());

it('scrubs beacon and fetch payloads for page views, errors and rejections', async () => {
  const listeners = new Map<string, EventListener>();
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => { listeners.set(type, listener as EventListener); });
  const beacon = vi.fn().mockReturnValue(true);
  const fetcher = vi.fn().mockResolvedValue({});
  vi.stubGlobal('navigator', { sendBeacon: beacon });
  vi.stubGlobal('fetch', fetcher);
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://example.test/path?token=SECRET#SECRET' });
  history.replaceState({}, '', '/reset-password?token=SECRET#SECRET');
  try {
    initPlatformTelemetry();
    listeners.get('load')!(new Event('load'));
    const beaconBody = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(beacon.mock.calls[0][1]);
    });
    expect(beaconBody).not.toContain('SECRET');
    expect(JSON.parse(beaconBody)).toMatchObject({ path: '/reset-password', metadata: { referrer: 'https://example.test' } });
    expect(JSON.parse(beaconBody).metadata).not.toHaveProperty('search');

    beacon.mockReturnValue(false);
    listeners.get('error')!(new ErrorEvent('error', { message: 'Failed /reset?token=SECRET', filename: 'https://example.test/a.js#SECRET', error: { stack: 'Error: token=SECRET\n at run (/a.js?token=SECRET)' } }));
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: { message: 'Bearer SECRET', stack: 'at /a.js#SECRET' } });
    listeners.get('unhandledrejection')!(rejection);
    history.pushState({}, '', '/path?token=SECRET');
    history.replaceState({}, '', '/path#SECRET');
    await Promise.resolve();
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(4);
    for (const [, request] of fetcher.mock.calls) expect(request.body).not.toContain('SECRET');
  } finally {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    delete (window as Window & { __wechurchTelemetryReady?: boolean }).__wechurchTelemetryReady;
    vi.restoreAllMocks();
  }
});
