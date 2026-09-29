import { beforeEach, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { devotionWallRoutes } from './devotionWallRoutes';
import { devotionWallCursor, devotionWallPageInput } from '../shared/devotionWall';

const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock('./db', () => ({ pool: db }));
vi.mock('./accessControl', () => ({ hasPermission: async () => false }));
type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Layer = { route?: { path: string | string[]; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> } };
const actor = '00000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const instant = '2026-09-27T02:00:00.123456Z';
const day = '2026-09-27';
function handler(method = 'get', path = '/') {
  const router = devotionWallRoutes(async () => actor);
  const layer = (router as unknown as { stack: Layer[] }).stack.find(({ route }) => route?.methods[method] && [route.path].flat().includes(path));
  return layer!.route!.stack[0].handle;
}
function response() {
  const res = { locals: { actor }, json: vi.fn() };
  return res as unknown as Response & { json: ReturnType<typeof vi.fn> };
}
beforeEach(() => {
  vi.resetAllMocks();
  db.query.mockResolvedValueOnce({ rows: [{ now: new Date('2026-09-27T03:00:00Z') }] });
});
it('validates page size and malformed cursors before touching the database', async () => {
  expect(devotionWallPageInput.parse({})).toEqual({ limit: 30 });
  expect(devotionWallPageInput.parse({ limit: '50' })).toEqual({ limit: 50 });
  for (const query of [{ limit: '51' }, { limit: '0' }, { limit: '1.5' }, { limit: ['1', '2'] }, { cursor: '{}' }, { cursor: 'invalid' }, { cursor: 'x'.repeat(257) }]) {
    await expect(handler()({ query, path: '/' } as unknown as Request, response(), vi.fn())).rejects.toThrow();
  }
  expect(db.query).not.toHaveBeenCalled();
});
it('fetches at most limit+1 rows and returns a microsecond-safe stable cursor', async () => {
  const rows = Array.from({ length: 31 }, (_, n) => ({ id: id(n + 1), title: 'Public', createdAt: instant, cursorCreatedAt: instant }));
  db.query.mockResolvedValueOnce({ rows }); const res = response();
  await handler()({ query: {}, path: '/' } as Request, res, vi.fn());
  const [sql, values] = db.query.mock.calls[1];
  expect(values).toEqual([actor, day, 31]);
  expect(sql).toContain('ORDER BY p.created_at DESC,p.id ASC LIMIT $3');
  expect(sql).toContain('p.withdrawn_at IS NULL'); expect(sql).toContain('p.expires_at>clock_timestamp()');
  expect(sql).toContain("WHEN p.is_anonymous THEN '匿名'");
  const result = res.json.mock.calls[0][0]; expect(result.posts).toHaveLength(30);
  expect(result.posts[0]).not.toHaveProperty('cursorCreatedAt');
  expect(JSON.parse(result.nextCursor)).toEqual({ day, createdAt: instant, id: id(30) });
});
it('scopes mine to the actor on every page without trusting cursor ownership', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: id(31), cursorCreatedAt: instant }] }); const res = response();
  await handler('get', '/mine')({ query: { cursor: devotionWallCursor(day, instant, id(30)), limit: '30' }, path: '/mine' } as unknown as Request, res, vi.fn());
  const [sql, values] = db.query.mock.calls[1];
  expect(values).toEqual([actor, day, instant, id(30), 31]);
  expect(sql).toContain('AND p.user_id=$1');
  expect(sql).toContain('p.created_at<$3::timestamptz OR (p.created_at=$3::timestamptz AND p.id>$4::uuid)');
  expect(res.json.mock.calls[0][0].nextCursor).toBeNull();
});
it('does not carry an old cursor into a new Taipei day', async () => {
  const res = response();
  await handler()({ query: { cursor: devotionWallCursor('2026-09-26', instant, id(30)) }, path: '/' } as unknown as Request, res, vi.fn());
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ day, posts: [], nextCursor: null }));
});
it('keeps withdrawal owner-scoped', async () => {
  db.query.mockReset().mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 1 });
  await handler('delete', '/:id')({ params: { id: id(2) } } as unknown as Request, response(), vi.fn());
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id=$1 AND (user_id=$2 OR $3)'), [id(2), actor, false]);
});
