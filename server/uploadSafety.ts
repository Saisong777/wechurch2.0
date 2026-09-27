import type { RequestHandler, Response } from 'express';
import path from 'node:path';

const types: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

export function rasterExtension(bytes: Buffer): string | null {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return '.jpg';
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      && bytes.toString('ascii', 12, 16) === 'IHDR') return '.png';
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return '.gif';
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

export function setMediaHeaders(res: Response, filename: string): boolean {
  const type = types[path.extname(filename).toLowerCase()];
  if (!type) return false;
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; sandbox; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Cache-Control', 'private, no-cache');
  return true;
}

export const rasterOnly: RequestHandler = (req, res, next) => {
  if (!setMediaHeaders(res, req.path)) { res.sendStatus(404); return; }
  next();
};
