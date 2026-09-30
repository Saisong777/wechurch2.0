export const permissionsPolicy = 'camera=(self), microphone=(), geolocation=()';

export function publicError(error: { status?: unknown; statusCode?: unknown; message?: unknown }) {
  const candidate = error.status || error.statusCode;
  const status = typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const message = status >= 500 ? 'Internal Server Error'
    : typeof error.message === 'string' ? error.message : 'Request failed';
  return { status, message };
}
