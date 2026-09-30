import { expect, it } from 'vitest';
import { permissionsPolicy, publicError } from './httpSafety';

it('allows the same-origin QR scanner without enabling microphone or location', () => {
  expect(permissionsPolicy).toBe('camera=(self), microphone=(), geolocation=()');
});
it('does not send server exception details to clients', () => {
  expect(publicError({ message: 'database password or query detail' })).toEqual({ status: 500, message: 'Internal Server Error' });
  expect(publicError({ status: 503, message: 'private host' }).message).toBe('Internal Server Error');
});
it('preserves valid client errors and rejects invalid status codes', () => {
  expect(publicError({ status: 413, message: 'too large' })).toEqual({ status: 413, message: 'too large' });
  for (const status of [200, 999, '500', 400.5]) expect(publicError({ status }).status).toBe(500);
});
