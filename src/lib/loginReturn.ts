import { safePageReturn } from '@shared/pageAccessPolicy';
const key = 'wechurch:login-return';

export function safeLoginReturn(value: string | null): string {
  return safePageReturn(value);
}

// A server redirect cannot see a fragment. Browsers inherit it on the login URL;
// merge it back only into an explicit, validated internal return destination.
export function requestedLoginReturn(value: string | null, fragment: string): string | null {
  if (value === null) return null;
  const safe = safeLoginReturn(value);
  if (safe !== value || safe.includes('#') || !fragment.startsWith('#')) return safe;
  return safeLoginReturn(safe + fragment);
}

export function rememberLoginReturn(value: string) {
  try { sessionStorage.setItem(key, safeLoginReturn(value)); } catch { /* Navigation works without storage. */ }
}

export function consumeLoginReturn(explicit: string | null) {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(key); sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  return safeLoginReturn(explicit ?? stored);
}
