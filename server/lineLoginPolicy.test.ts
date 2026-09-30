import { describe, expect, it } from 'vitest';
import { lineChannelContinuity, stagingLineReady } from './lineLoginPolicy';

const env = { STAGING_LINE_LOGIN_ENABLED: '1', LINE_CHANNEL_ID: 'b-channel', STAGING_LINE_CHANNEL_ID: 'b-channel', LINE_CHANNEL_SECRET: 'test-only', LINE_PROVIDER_ID: 'church', LINE_PROVIDER_CHANNELS: JSON.stringify({ 'a-channel': 'church', 'b-channel': 'church' }), PUBLIC_BASE_URL: 'https://b.example.test' };
describe('LINE environment boundaries', () => {
  it('requires an explicitly configured isolated callback', () => {
    expect(stagingLineReady(env)).toBe(true);
    for (const patch of [{ STAGING_LINE_LOGIN_ENABLED: '0' }, { LINE_CHANNEL_SECRET: '' }, { STAGING_LINE_CHANNEL_ID: 'a-channel' }, { LINE_PROVIDER_ID: '' }, { LINE_PROVIDER_CHANNELS: '{}' }, { LINE_PROVIDER_CHANNELS: 'null' }, { PUBLIC_BASE_URL: 'https://wechurch.online' }, { LINE_CALLBACK_URL: 'https://a.example.test/api/line-login/callback' }, { LINE_CALLBACK_URL: 'https://b.example.test/api/line-login/callback?wrong=1' }]) expect(stagingLineReady({ ...env, ...patch })).toBe(false);
  });
  it('does not trust a channel transition without an operator-verified provider mapping', () => {
    expect(lineChannelContinuity('a-channel', 'a-channel', {})).toBe(true);
    expect(lineChannelContinuity('a-channel', 'b-channel', {})).toBe(false);
    expect(lineChannelContinuity('a-channel', 'b-channel', env)).toBe(true);
    expect(lineChannelContinuity('unknown', 'b-channel', env)).toBe(false);
    expect(lineChannelContinuity('a-channel', undefined, env)).toBe(false);
    expect(lineChannelContinuity('a-channel', 'b-channel', { ...env, LINE_PROVIDER_CHANNELS: '{"a-channel":"other","b-channel":"church"}' })).toBe(false);
    expect(lineChannelContinuity('a-channel', 'b-channel', { ...env, LINE_PROVIDER_CHANNELS: 'null' })).toBe(false);
  });
});
