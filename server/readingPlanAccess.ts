import type { Request, RequestHandler } from 'express';

export function readingPlanAccess(
  resolveUserId: (req: Request) => Promise<string | null>,
  findPlan: (id: string, userId: string) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !await findPlan(id, userId)) {
        res.status(404).json({ error: 'Reading plan not found' });
        return;
      }
      res.locals.readingOwnerId = userId;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const retiredOperations: RequestHandler = (_req, res) => {
  res.status(410).json({ error: 'This module is not available in the current release' });
};
