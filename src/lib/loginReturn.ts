const key = 'wechurch:login-return';

export function safeLoginReturn(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32)) return '/';
  const pathname = value.split(/[?#]/)[0];
  if (/^\/(login|reset-password|api)(\/|$)/.test(pathname)) return '/';
  return value;
}

export function rememberLoginReturn(value: string) {
  try { sessionStorage.setItem(key, safeLoginReturn(value)); } catch { /* Navigation works without storage. */ }
}

export function consumeLoginReturn(explicit: string | null) {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(key); sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  return safeLoginReturn(explicit ?? stored);
}
