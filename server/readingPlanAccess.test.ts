import { describe, expect, it, vi } from 'vitest';
import { readingPlanAccess, retiredOperations } from './readingPlanAccess';

const planId = '00000000-0000-4000-8000-000000000001';
const response = () => ({ locals: {}, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

describe('reading plan access boundary', () => {
  it.each(['get', 'patch', 'delete', 'progress', 'today', 'complete', 'devotional'])('blocks another owner for %s', async operation => {
    const res = response();
    const next = vi.fn();
    const find = vi.fn(async (_id: string, userId: string) => userId === 'owner' ? { id: planId } : undefined);
    await readingPlanAccess(async () => 'other', find)({ params: { id: planId }, method: operation } as any, res as any, next);
    expect(find).toHaveBeenCalledWith(planId, 'other');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
  it('requires a session before resolving any plan', async () => {
    const res = response(), find = vi.fn(), next = vi.fn();
    await readingPlanAccess(async () => null, find)({ params: { id: planId } } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(find).not.toHaveBeenCalled();
  });
  it('passes a valid owner and propagates lookup failures without allowing access', async () => {
    const res = response(), next = vi.fn();
    await readingPlanAccess(async () => 'owner', async () => ({}))({ params: { id: planId } } as any, res as any, next);
    expect(res.locals).toEqual({ readingOwnerId: 'owner' });
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    const error = new Error('db unavailable');
    await readingPlanAccess(async () => 'owner', async () => { throw error; })({ params: { id: planId } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });
  it('retires both administrative modules without reaching their handlers', () => {
    const res = response(), next = vi.fn();
    retiredOperations({} as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(next).not.toHaveBeenCalled();
  });
});
