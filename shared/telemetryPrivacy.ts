const REDACTED = '[redacted]';

function decodeTelemetryText(value: string): string {
  let text = value.slice(0, 16000);
  for (let i = 0; i < 4; i++) {
    let decoded: string;
    try { decoded = decodeURIComponent(text); }
    catch { decoded = text.replace(/%([0-7][0-9a-f])/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))); }
    if (decoded === text) return text;
    text = decoded;
  }
  // Do not retain multiply encoded delimiters or credentials beyond the work limit.
  return /%(?:25|3f|23|3d|26)/i.test(text) ? REDACTED : text;
}

export function scrubTelemetryText(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return decodeTelemetryText(value)
    .replace(/https?:\/\/[^\s/]+@/gi, 'https://[redacted]@')
    // Query values may contain encoded newlines. Resume only at the next stack frame.
    .replace(/[?#][\s\S]*?(?=\r?\n\s+at\s|$)/g, REDACTED)
    .replace(/\b(?:[\w-]*(?:token|password|secret|api[_-]?key)|authorization|cookie|code|state)\b["']?\s*[:=]\s*[^\r\n]*/gi, REDACTED)
    .replace(/\b(?:Bearer|Basic)\s+[^\r\n]*/gi, REDACTED)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g, REDACTED)
    .replace(/\b(?:sk-[A-Za-z0-9_-]+|[a-f0-9]{32,})\b/gi, REDACTED)
    .slice(0, maxLength);
}

export function telemetryPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(decodeTelemetryText(value), 'https://telemetry.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return scrubTelemetryText(url.pathname, 500);
  } catch { return null; }
}

function referrerOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(decodeTelemetryText(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.origin.slice(0, 300) : null;
  } catch { return null; }
}

// Telemetry has a deliberately small schema. Never keep arbitrary metadata or raw previews.
export function telemetryMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(input, 'referrer')) output.referrer = referrerOrigin(input.referrer);
  if (Object.prototype.hasOwnProperty.call(input, 'filename')) output.filename = telemetryPath(input.filename);
  if (typeof input.viewport === 'string' && /^\d{1,6}x\d{1,6}$/.test(input.viewport)) output.viewport = input.viewport;
  if (input.type === 'unhandledrejection') output.type = input.type;
  for (const key of ['lineno', 'colno']) {
    if (typeof input[key] === 'number' && Number.isSafeInteger(input[key]) && input[key] >= 0) output[key] = input[key];
  }
  if (JSON.stringify(output).length > 3000) return { truncated: true };
  return Object.keys(output).length ? output : null;
}
