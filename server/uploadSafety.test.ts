import { describe, expect, it, vi } from 'vitest';
import { rasterExtension, setMediaHeaders } from './uploadSafety';
import type { Response } from 'express';

describe('untrusted media boundary', () => {
  it('rejects HTML and SVG regardless of claimed MIME or extension', () => {
    expect(rasterExtension(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(rasterExtension(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
  });
  it('recognizes a raster independently of the client filename and disables scripts', () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
    expect(rasterExtension(png)).toBe('.png');
    const setHeader = vi.fn(); const res = { setHeader } as unknown as Response;
    expect(setMediaHeaders(res, 'old.html')).toBe(false);
    expect(setMediaHeaders(res, 'old.svg')).toBe(false);
    expect(setMediaHeaders(res, 'valid.png')).toBe(true);
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("script-src 'none'; sandbox"));
  });
});
