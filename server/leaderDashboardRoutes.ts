import { devotionDate, taipeiToday } from '../shared/churchDevotion';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { createGatheringInput, saveAttendanceInput } from '../shared/leaderDashboard';
import * as repo from './leaderDashboardRepository';

export function leaderDashboardRoutes() {
  const router = Router();
  const uuid = z.string().uuid();
  const scope = (req: Request) => z.union([z.literal('all'),uuid]).default('all').parse(req.query.scope);
  const offset = (req: Request) => z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
  router.get('/', async (req,res) => { res.json(await repo.dashboard(res.locals.actor, scope(req))); });
  router.get('/care', async (req,res) => { res.json(await repo.carePage(res.locals.actor,scope(req),z.enum(['active','due','unassigned']).default('active').parse(req.query.filter),offset(req))); });
  router.get('/prayers', async (req,res) => { res.json(await repo.prayerPage(res.locals.actor,scope(req),offset(req))); });
  router.get('/gatherings', async (req,res) => { res.json(await repo.gatheringsPage(res.locals.actor,scope(req),offset(req))); });
  router.get('/:id/roster', async (req,res) => { res.json(await repo.gatheringRoster(res.locals.actor,uuid.parse(req.params.id),devotionDate.default(taipeiToday()).parse(req.query.date))); });
  router.put('/:id/gatherings/:meetingId', async (req,res) => { res.json(await repo.createGathering(res.locals.actor,uuid.parse(req.params.id),uuid.parse(req.params.meetingId),createGatheringInput.parse(req.body))); });
  router.get('/:id/gatherings/:meetingId', async (req,res) => { res.json(await repo.gatheringDetail(res.locals.actor,uuid.parse(req.params.id),uuid.parse(req.params.meetingId))); });
  router.patch('/:id/gatherings/:meetingId', async (req,res) => { res.json(await repo.saveAttendance(res.locals.actor,uuid.parse(req.params.id),uuid.parse(req.params.meetingId),saveAttendanceInput.parse(req.body))); });
  return router;
}
