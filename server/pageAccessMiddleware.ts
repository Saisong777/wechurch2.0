import type { RequestHandler } from 'express';
import { canonicalPagePath, loginForPage, pageRequiresAuthentication } from '@shared/pageAccessPolicy';
import { hasValidPersistentSession } from './authSessionPersistence';

// Install after Passport/session setup and before the SPA HTML fallback.
export const pageAccessMiddleware: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const path = canonicalPagePath(req.path);
  // These endpoints retain their own JSON/status and static media behavior.
  if (path && ['/api', '/assets', '/uploads'].some(root => path === root || path.startsWith(root + '/'))) return next();
  if (path === null) return void res.status(400).set('Cache-Control', 'no-store').send('Invalid page path');
  if (!pageRequiresAuthentication(path)) return next();
  res.set('Cache-Control', 'private, no-store');
  res.vary('Cookie');
  if (!hasValidPersistentSession(req)) return void res.redirect(302, loginForPage(req.originalUrl));
  next();
};
