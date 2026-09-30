import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { serveStatic } from './vite';

let server: Server;
let origin: string;
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wechurch-static-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>WeChurch test</title>');
  writeFileSync(join(dir, 'assets', 'page-123.js'), 'export default 1;');
  const app = express();
  serveStatic(app, dir);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

it('returns a non-cacheable 404 for removed JavaScript and CSS chunks', async () => {
  for (const path of ['/assets/old.js', '/assets/old.css']) {
    const response = await fetch(origin + path);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});
it('never caches HTML entry points, including direct index.html requests', async () => {
  for (const path of ['/', '/index.html', '/learn/bible', '/?_reload=123']) {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).toContain('WeChurch test');
  }
});
it('keeps long-lived immutable caching for existing hashed assets', async () => {
  const response = await fetch(origin + '/assets/page-123.js');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('immutable');
  expect(await response.text()).toBe('export default 1;');
});
