import { createHash } from 'node:crypto';
import { reportSlideScript } from '../shared/reportSlideScript';

// Offline report popups inherit the opener's CSP. Trust only this fixed controller,
// never report text or an entire class of inline scripts.
export const reportSlideScriptHash = createHash('sha256').update(reportSlideScript).digest('base64');

export function contentSecurityPolicy(development = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${development ? "'unsafe-inline'" : `'sha256-${reportSlideScriptHash}'`}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://www.wechurch.online${development ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}
