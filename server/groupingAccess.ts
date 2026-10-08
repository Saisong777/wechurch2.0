import type { Request } from 'express';
import type { GroupingActivity } from '@shared/schema';
import type { IStorage } from './storage';
import { SESSION_TTL_MS } from './authSessionPersistence';
import { GroupError } from './groupError';
import { randomUUID } from 'node:crypto';
import { MAX_GROUPING_GRANTS, validGroupingGrants } from './groupingSession';

// Participant IDs and names received from a browser are never proof of ownership.
export function groupingAccess(storage: Pick<IStorage, 'getUserRole' | 'getGroupingParticipants' | 'addGroupingParticipant'>,
  resolveUserId: (req: Request) => Promise<string | null>) {
  async function canManage(req: Request, activity: GroupingActivity) {
    const actor = await resolveUserId(req);
    return !!actor && (activity.ownerId === actor || await storage.getUserRole(actor) === 'admin');
  }
  function participantId(req: Request, activityId: string) {
    return validGroupingGrants(req.session)[activityId]?.participantId || null;
  }
  async function owned(req: Request, activityId: string) {
    const id = participantId(req, activityId);
    if (!id) return undefined;
    return (await storage.getGroupingParticipants(activityId)).find(p => p.id === id && p.activityId === activityId);
  }
  async function grant(req: Request, activityId: string, id: string) {
    if (!req.session) throw new GroupError(503, '暫時無法保存加入身份，請稍後重試。');
    const now = Date.now();
    const grants = validGroupingGrants(req.session);
    if (!grants[activityId] && Object.keys(grants).length >= MAX_GROUPING_GRANTS) throw new GroupError(429, '已加入的活動過多，請稍後再試。');
    req.session.groupingParticipants = { ...grants, [activityId]: { participantId: id, expiresAt: now + SESSION_TTL_MS } };
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  }
  async function join(req: Request, activityId: string, input: { name: string; gender: 'M' | 'F' }) {
    const id = randomUUID();
    // Persist the server-issued credential first. Failed persistence cannot add a
    // phantom member; failed INSERT leaves a harmless grant with no matching row.
    await grant(req, activityId, id);
    return storage.addGroupingParticipant({ ...input, activityId, id });
  }
  async function view(req: Request, activity: GroupingActivity) {
    const manager = await canManage(req, activity);
    const boundId = participantId(req, activity.id);
    const all = manager || boundId ? await storage.getGroupingParticipants(activity.id) : [];
    const member = boundId ? all.find(p => p.id === boundId && p.activityId === activity.id) : undefined;
    const visible = manager ? all : member ? all.filter(p => p.id === member.id ||
      (activity.status === 'finished' && member.groupNumber !== null && p.groupNumber === member.groupNumber)) : [];
    const participants = manager ? visible : visible.map(({ id, activityId, name, gender, groupNumber }) => ({ id, activityId, name, gender, groupNumber }));
    return { activity: { ...activity, ownerId: manager ? activity.ownerId : null, shortCode: manager ? activity.shortCode : '' },
      participants, myParticipantId: member?.id || null, canManage: manager };
  }
  return { canManage, owned, join, view };
}
