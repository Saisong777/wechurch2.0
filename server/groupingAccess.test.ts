import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { GroupingParticipant } from '@shared/schema';
import { groupingAccess } from './groupingAccess';
import { MAX_GROUPING_GRANTS, validGroupingGrants } from './groupingSession';

it('rejected grant capacity and failed persistence cannot insert phantom members; retry succeeds once', async () => {
  const rows: GroupingParticipant[] = [];
  let failSave = false;
  const req = { session: { groupingParticipants: {}, save: (done: (error?: Error) => void) => done(failSave ? new Error('synthetic store failure') : undefined) } } as unknown as Request;
  const access = groupingAccess({ getUserRole: async () => undefined,
    getGroupingParticipants: async id => rows.filter(row => row.activityId === id),
    addGroupingParticipant: async input => {
      const row = { ...input, id: input.id!, groupNumber: null, joinedAt: new Date() } as GroupingParticipant;
      rows.push(row); return row;
    } }, async () => null);
  for (let i = 0; i < MAX_GROUPING_GRANTS; i++) req.session.groupingParticipants![randomUUID()] = { participantId: randomUUID(), expiresAt: Date.now() + 60000 };
  const activityId = randomUUID();
  for (let i = 0; i < 2; i++) await expect(access.join(req, activityId, { name: 'Synthetic participant', gender: 'M' })).rejects.toMatchObject({ status: 429 });
  expect(rows).toHaveLength(0);
  req.session.groupingParticipants = {}; failSave = true;
  await expect(access.join(req, activityId, { name: 'Synthetic participant', gender: 'M' })).rejects.toThrow('synthetic store failure');
  expect(rows).toHaveLength(0);
  expect(await access.owned(req, activityId)).toBeUndefined();
  failSave = false;
  const joined = await access.join(req, activityId, { name: 'Synthetic participant', gender: 'M' });
  expect(rows).toHaveLength(1);
  expect(await access.owned(req, activityId)).toEqual(joined);
});

it('login grant migration accepts only bounded unexpired server-session grants', () => {
  const valid = randomUUID(), expired = randomUUID();
  const grant = { participantId: randomUUID(), expiresAt: Date.now() + 60000 };
  expect(validGroupingGrants({ groupingParticipants: {
    [valid]: grant, [expired]: { ...grant, expiresAt: 0 }, badKey: grant,
  } })).toEqual({ [valid]: grant });
  expect(validGroupingGrants({ groupingParticipants: Object.fromEntries(Array.from({ length: MAX_GROUPING_GRANTS + 1 }, () => [randomUUID(), grant])) })).toEqual({});
});
