import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadLocalDevotionalNotes, mergeLocalDevotionalNotes, removeLocalDevotionalNote, upsertLocalDevotionalNote, type LocalDevotionalNote } from './localDevotionalNotes';
import { saveDevotionalNote } from './saveDevotionalNote';

const makeNote = (id = 'local-devotional-one', userId = 'alice'): LocalDevotionalNote => ({
  id, userId, verseReference: 'John 1:1', verseText: 'Fixture text', readingPlanId: null, dayNumber: null,
  titlePhrase: null, heartbeatVerse: null, observation: 'Private fixture', coreInsightCategory: null,
  coreInsightNote: null, scholarsNote: null, actionPlan: null, coolDownNote: null,
  createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z',
});

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('account-scoped devotional drafts', () => {
  it('never merges another account or ownerless legacy notes', () => {
    localStorage.setItem('wechurch_local_devotional_notes_v1', JSON.stringify([makeNote(), makeNote('b', 'bob'), { ...makeNote('unknown'), userId: undefined }]));
    expect(loadLocalDevotionalNotes('bob').map(n => n.id)).toEqual(['b']);
    expect(loadLocalDevotionalNotes('')).toEqual([]);
    expect(mergeLocalDevotionalNotes([makeNote()], 'bob').map(n => n.id)).toEqual(['b']);
  });
  it('preserves multiple records of the same passage and isolates deletes', () => {
    upsertLocalDevotionalNote(makeNote('a1'), 'alice');
    upsertLocalDevotionalNote(makeNote('a2'), 'alice');
    upsertLocalDevotionalNote(makeNote('b', 'bob'), 'bob');
    removeLocalDevotionalNote('a1', 'bob');
    expect(loadLocalDevotionalNotes('alice')).toHaveLength(2);
    expect(loadLocalDevotionalNotes('bob')).toHaveLength(1);
    expect(() => upsertLocalDevotionalNote(makeNote(), 'bob')).toThrow('owner');
  });
  it('does not resurrect removed legacy drafts', () => {
    localStorage.setItem('wechurch_local_devotional_notes_v1', JSON.stringify([makeNote()]));
    removeLocalDevotionalNote('local-devotional-one', 'alice');
    expect(loadLocalDevotionalNotes('alice')).toEqual([]);
    expect(localStorage.getItem('wechurch_local_devotional_notes_v1')).toContain('Private fixture');
  });
  it('prefers pending edits but not stale synced cache over the server', () => {
    const remote = { ...makeNote('server-id'), observation: 'Server' };
    upsertLocalDevotionalNote({ ...remote, observation: 'Draft', syncStatus: 'pending' }, 'alice');
    expect(mergeLocalDevotionalNotes([remote], 'alice')[0].observation).toBe('Draft');
    upsertLocalDevotionalNote({ ...remote, observation: 'Stale', syncStatus: 'synced' }, 'alice');
    expect(mergeLocalDevotionalNotes([remote], 'alice')[0].observation).toBe('Server');
    expect(mergeLocalDevotionalNotes([], 'alice')).toEqual([]);
    expect(mergeLocalDevotionalNotes([], 'alice', true)).toHaveLength(1);
  });
});

describe('honest save acknowledgement', () => {
  it('keeps a pending draft on network failure and reuses its save identifier', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const first = await saveDevotionalNote('alice', makeNote());
    const second = await saveDevotionalNote('alice', first.note);
    expect(first.status).toBe('pending');
    expect(first.note.clientMutationId).toBe(second.note.clientMutationId);
    expect(loadLocalDevotionalNotes('bob')).toEqual([]);
  });
  it.each([400, 401, 403, 404, 409])('does not treat HTTP %s as a successful or retryable save', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    expect((await saveDevotionalNote('alice', makeNote())).status).toBe('blocked');
  });
  it('removes the temporary draft only after a matching server acknowledgement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(makeNote('server-id'))));
    const saved = await saveDevotionalNote('alice', makeNote());
    expect(saved.status).toBe('synced');
    expect(loadLocalDevotionalNotes('alice').map(n => n.id)).toEqual(['server-id']);
  });
  it('rejects a response for another account without importing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(makeNote('server-id', 'bob'))));
    expect((await saveDevotionalNote('alice', makeNote())).status).toBe('pending');
    expect(loadLocalDevotionalNotes('alice').every(n => n.userId === 'alice')).toBe(true);
  });
  it('does not claim success when device storage fails', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Quota'); } });
    await expect(saveDevotionalNote('alice', makeNote())).rejects.toThrow('Quota');
  });
});
