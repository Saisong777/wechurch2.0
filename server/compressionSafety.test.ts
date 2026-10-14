import { createServer, get, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import express from 'express';
import compression from 'compression';
const require = createRequire(import.meta.url);

it('preserves gzip responses and releases every compressor after a client aborts', async () => {
  // Local loopback only. Observe the resource itself rather than process memory,
  // so the regression checks cleanup deterministically without load testing.
  const zlib = require('node:zlib');
  const descriptor = Object.getOwnPropertyDescriptor(zlib, 'createGzip')!;
  const streams: Array<{ destroyed: boolean; closed: Promise<unknown[]> }> = [];
  Object.defineProperty(zlib, 'createGzip', { ...descriptor, value: (...args: unknown[]) => {
    const stream = descriptor.value(...args);
    streams.push({ get destroyed() { return stream.destroyed; }, closed: once(stream, 'close') });
    return stream;
  } });
  const app = express(); app.use(compression({ threshold: 0 }));
  app.get('/complete', (_req, res) => res.type('text').send('reading content '.repeat(1000)));
  app.get('/stream', (_req, res) => {
    res.type('text');
    const send = () => { res.write('reading content '.repeat(1000)); (res as typeof res & { flush(): void }).flush(); };
    const interval = setInterval(send, 10); res.on('close', () => clearInterval(interval)); send();
  });
  const server: Server = createServer(app);
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local test port');
    const origin = `http://127.0.0.1:${address.port}`;
    const body = await new Promise<Buffer>((resolve, reject) => {
      get(origin + '/complete', { headers: { 'Accept-Encoding': 'gzip' } }, res => {
        expect(res.headers['content-encoding']).toBe('gzip'); const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject);
      }).on('error', reject);
    });
    expect(zlib.gunzipSync(body).toString()).toBe('reading content '.repeat(1000));
    for (let index = 0; index < 3; index++) {
      await new Promise<void>((resolve, reject) => {
        const request = get(origin + '/stream', { headers: { 'Accept-Encoding': 'gzip' } }, res => {
          res.once('data', () => { res.destroy(); request.destroy(); resolve(); });
        }); request.once('error', reject);
      });
    }
    await Promise.race([Promise.all(streams.map(s => s.closed)), new Promise((_, reject) => setTimeout(() => reject(new Error('Aborted gzip stream was not closed')), 1500).unref())]);
    expect(streams).toHaveLength(4); expect(streams.every(s => s.destroyed)).toBe(true);
  } finally {
    Object.defineProperty(zlib, 'createGzip', descriptor); server.closeAllConnections();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
