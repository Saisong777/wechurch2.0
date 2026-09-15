type Env = NodeJS.ProcessEnv;

// Provider membership is deployment configuration, never a browser claim.
export function lineChannelContinuity(previous: string | null, current: string | null | undefined, env: Env = process.env) {
  if (!previous || previous === current) return true;
  if (!current || !env.LINE_PROVIDER_ID) return false;
  try {
    const channels = JSON.parse(env.LINE_PROVIDER_CHANNELS || '{}');
    return Object.hasOwn(channels, previous) && Object.hasOwn(channels, current)
      && channels[previous] === env.LINE_PROVIDER_ID && channels[current] === env.LINE_PROVIDER_ID;
  } catch { return false; }
}

export function stagingLineReady(env: Env = process.env) {
  if (env.STAGING_LINE_LOGIN_ENABLED !== '1') return false;
  const channel = env.LINE_CHANNEL_ID || env.LINE_LOGIN_CHANNEL_ID;
  const secret = env.LINE_CHANNEL_SECRET || env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channel || !secret || !env.LINE_PROVIDER_ID || channel !== env.STAGING_LINE_CHANNEL_ID) return false;
  if (env.LINE_CALLBACK_PATH && env.LINE_CALLBACK_PATH !== '/api/line-login/callback') return false;
  try {
    const channels = JSON.parse(env.LINE_PROVIDER_CHANNELS || '{}');
    const origin = new URL(env.PUBLIC_BASE_URL || '');
    const callback = new URL(env.LINE_CALLBACK_URL || '/api/line-login/callback', origin);
    return origin.protocol === 'https:' && !['wechurch.online', 'www.wechurch.online'].includes(origin.hostname)
      && callback.origin === origin.origin && callback.pathname === '/api/line-login/callback'
      && !callback.search && !callback.hash && !callback.username && !callback.password
      && channels[channel] === env.LINE_PROVIDER_ID;
  } catch { return false; }
}
