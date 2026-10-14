// Authentication for HTML pages and client navigation share this policy.
// API authorization, church scope and staff capabilities remain server-enforced.
const unsafeCharacters = (value: string) => [...value].some(char => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127);
export function canonicalPagePath(pathname: string): string | null {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || unsafeCharacters(pathname)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  // Encoded separators or a second encoding layer must not change route identity.
  if (/%(?:2f|5c)/i.test(pathname) || decoded.includes('%') || unsafeCharacters(decoded) || decoded.startsWith('//')) return null;
  const segments: string[] = [];
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop(); else segments.push(segment);
  }
  return '/' + segments.join('/').toLowerCase();
}

const memberRoots = [
  '/admin', '/me', '/notifications', '/work', '/support', '/care',
  '/grace-record', '/share', '/notebook', '/user/notebook',
  '/learn/my-notes', '/learn/reading-plans',
];

export function pageRequiresAuthentication(pathname: string): boolean {
  const path = canonicalPagePath(pathname);
  if (path === null) return true;
  return memberRoots.some(root => path === root || path.startsWith(root + '/'));
}

export function safePageReturn(value: string | null): string {
  if (!value || unsafeCharacters(value)) return '/';
  const path = canonicalPagePath(value.split(/[?#]/)[0]);
  if (path === null || ['/login', '/reset-password', '/api'].some(root => path === root || path.startsWith(root + '/'))) return '/';
  return value;
}

export const loginForPage = (value: string) => `/login?returnTo=${encodeURIComponent(safePageReturn(value))}`;
