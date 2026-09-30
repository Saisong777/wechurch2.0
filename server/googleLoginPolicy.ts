type Env = NodeJS.ProcessEnv;

export const googleOnlyRegistration = (env: Env = process.env) => env.AUTH_REGISTRATION_MODE === 'google-only';

export function googleLoginConfig(env: Env = process.env): { enabled: boolean; callbackURL: string | null } {
  const disabled = { enabled: false, callbackURL: null };
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return disabled;
  const staging = env.APP_ENV === 'staging' || Boolean(env.RAILWAY_ENVIRONMENT_NAME && env.RAILWAY_ENVIRONMENT_NAME !== 'production');
  if (staging && (env.STAGING_GOOGLE_LOGIN_ENABLED !== '1' || env.GOOGLE_CLIENT_ID !== env.STAGING_GOOGLE_CLIENT_ID)) return disabled;
  try {
    if (!staging && env.NODE_ENV !== 'production' && !env.PUBLIC_BASE_URL) {
      return { enabled: true, callbackURL: '/api/callback' };
    }
    // Never derive a security-sensitive callback from a request Host header.
    const origin = new URL(env.PUBLIC_BASE_URL || 'https://www.wechurch.online');
    const callback = new URL(env.GOOGLE_CALLBACK_URL || '/api/callback', origin);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
        callback.origin !== origin.origin || callback.pathname !== '/api/callback' || callback.search || callback.hash || callback.username || callback.password ||
        (staging && ['wechurch.online', 'www.wechurch.online'].includes(origin.hostname))) return disabled;
    return { enabled: true, callbackURL: callback.href };
  } catch { return disabled; }
}
