import { expect, it } from 'vitest';
import { googleLoginConfig, googleOnlyRegistration } from './googleLoginPolicy';

const staging = { APP_ENV: 'staging', NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://b.example.test',
  GOOGLE_CLIENT_ID: 'b-client', GOOGLE_CLIENT_SECRET: 'b-secret', STAGING_GOOGLE_CLIENT_ID: 'b-client',
  STAGING_GOOGLE_LOGIN_ENABLED: '1', GOOGLE_CALLBACK_URL: 'https://b.example.test/api/callback' };

it('enables only the explicitly configured B client and same-origin callback', () => {
  expect(googleLoginConfig(staging)).toEqual({ enabled: true, callbackURL: staging.GOOGLE_CALLBACK_URL });
  for (const patch of [{ GOOGLE_CLIENT_SECRET: '' }, { GOOGLE_CLIENT_ID: '' }, { STAGING_GOOGLE_CLIENT_ID: 'a-client' },
    { STAGING_GOOGLE_LOGIN_ENABLED: '0' }, { PUBLIC_BASE_URL: 'https://wechurch.online' },
    { PUBLIC_BASE_URL: 'https://www.wechurch.online' }, { GOOGLE_CALLBACK_URL: 'https://evil.test/api/callback' },
    { GOOGLE_CALLBACK_URL: '/api/callback?next=evil' }, { GOOGLE_CALLBACK_URL: '/api/callback#token' },
    { GOOGLE_CALLBACK_URL: 'https://user:pass@b.example.test/api/callback' },
    { PUBLIC_BASE_URL: 'http://b.example.test' }, { GOOGLE_CALLBACK_URL: '/different' }]) {
    expect(googleLoginConfig({ ...staging, ...patch }).enabled).toBe(false);
  }
});
it('keeps existing production and local defaults while missing configuration fails closed', () => {
  expect(googleLoginConfig({}).enabled).toBe(false);
  const credentials = { GOOGLE_CLIENT_ID: 'a-client', GOOGLE_CLIENT_SECRET: 'a-secret' };
  expect(googleLoginConfig({ ...credentials, NODE_ENV: 'production' }).callbackURL).toBe('https://www.wechurch.online/api/callback');
  expect(googleLoginConfig({ ...credentials, NODE_ENV: 'development' }).callbackURL).toBe('/api/callback');
  expect(googleLoginConfig({ ...credentials, RAILWAY_ENVIRONMENT_NAME: 'preview' }).enabled).toBe(false);
  expect(googleOnlyRegistration({})).toBe(false);
  expect(googleOnlyRegistration({ AUTH_REGISTRATION_MODE: 'google-only' })).toBe(true);
});
