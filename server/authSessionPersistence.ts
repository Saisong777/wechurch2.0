import type { RequestHandler } from 'express';
import type { SessionIdentity } from './authSessionVersion';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
export const sessionDeadline = () => Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
export function sessionCookieOptions() {
  const insecureLocal = process.env.NODE_ENV === 'development' || process.env.LOCAL_INSECURE_COOKIES === '1';
  return { httpOnly: true, secure: !insecureLocal, sameSite: 'lax' as const, path: '/' };
}

type PersistentIdentity = SessionIdentity & { expires_at?: number };
export const persistAuthenticatedSession: RequestHandler = async (req, res, next) => {
  const user = req.user as PersistentIdentity | undefined;
  const saved = (req.session as typeof req.session & { passport?: { user?: PersistentIdentity } })?.passport?.user;
  const now = Math.floor(Date.now() / 1000);
  if (!req.isAuthenticated() || !user || !saved || !Number.isSafeInteger(user.expires_at) ||
      !user.expires_at || user.expires_at <= now || saved.claims?.sub !== user.claims?.sub) {
    return void res.status(401).json({ message: 'Unauthorized' });
  }
  // deserialize creates a verified copy. Update the persisted Passport identity too.
  // Keep binding/version intact so a password reset still revokes late saves.
  const deadline = sessionDeadline();
  saved.expires_at = deadline;
  user.expires_at = deadline;
  req.session.cookie.maxAge = SESSION_TTL_MS;
  req.session.touch();
  try { if(user.loginReceiptId){const {recordSuccessfulLogin}=await import('./churchLoginRepository');await recordSuccessfulLogin(user);} }
  catch { return void res.status(503).json({message:'登入紀錄尚未完整保存，請重新確認登入。'}); }
  next();
};

export const destroyAuthenticatedSession: RequestHandler = (req, res, next) => {
  req.logout(error => {
    if (error) return next(error);
    req.session.destroy(destroyError => {
      if (destroyError) return next(destroyError);
      res.clearCookie('connect.sid', sessionCookieOptions());
      res.set('Cache-Control', 'no-store').redirect('/');
    });
  });
};
