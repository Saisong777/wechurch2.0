import { expect, it } from 'vitest';
import { authErrorMetadata } from './authLogging';

it('retains useful allowlisted error codes without database detail, stack or credential values', () => {
  const error = Object.assign(new Error('fixture@example.test password=synthetic-secret'), {
    code: '23505', detail: 'email=fixture@example.test', token: 'synthetic-token',
  });
  expect(authErrorMetadata(error)).toEqual({ name: 'Error', code: '23505' });
  expect(authErrorMetadata(new TypeError('synthetic-secret'))).toEqual({ name: 'TypeError' });
});

it('does not echo arbitrary thrown values, error names or unknown codes', () => {
  expect(authErrorMetadata('synthetic-secret')).toEqual({ name: 'Error' });
  expect(authErrorMetadata(Object.assign(new Error('private'), { name: 'fixture@example.test', code: 'synthetic-token' }))).toEqual({ name: 'Error' });
});
