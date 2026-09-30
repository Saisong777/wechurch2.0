import { z } from 'zod';
const envelope = z.object({ owner: z.string(), scope: z.string(), revision: z.number().int().nullable(), value: z.unknown(), savedAt: z.string().datetime() }).strict();
const key = (owner: string, scope: string) => `wechurch:device-draft:v1:${encodeURIComponent(owner)}:${encodeURIComponent(scope)}`;
export function readDeviceDraft<T>(owner: string, scope: string, schema: z.ZodType<T>) {
  if (!owner) return null;
  try {
    const stored = envelope.parse(JSON.parse(localStorage.getItem(key(owner,scope)) || 'null'));
    if (stored.owner !== owner || stored.scope !== scope) return null;
    return { ...stored, value: schema.parse(stored.value) };
  } catch { return null; }
}
export function writeDeviceDraft<T>(owner: string, scope: string, revision: number | null, value: T, schema: z.ZodType<T>) {
  if (!owner || !scope) throw new Error('請先登入');
  const stored = envelope.parse({ owner, scope, revision, value: schema.parse(value), savedAt: new Date().toISOString() });
  localStorage.setItem(key(owner,scope),JSON.stringify(stored));
}
export function clearDeviceDraft(owner: string, scope: string) {
  if(owner) localStorage.removeItem(key(owner,scope));
}
