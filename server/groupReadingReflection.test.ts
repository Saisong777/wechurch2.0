import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { readingReflectionInput, composeReadingReflection } from '../shared/lifeGroup';
import { loadReadingNote, mergeReflectionReceiving, reflectionReceiving, saveReadingReflection } from './groupReadingReflection';

const actor = '00000000-0000-4000-8000-000000000001';
const group = { id: '00000000-0000-4000-8000-000000000002', church: 'IM 行動教會' };
const devotionId = '00000000-0000-4000-8000-000000000003';
const mutationId = '00000000-0000-4000-8000-000000000004';
const noteId = '00000000-0000-4000-8000-000000000005';
const input = { devotionVersion: 2, noteId: null, noteVersion: null, observation: 'PRIVATE observation', receiving: 'Shared receiving', response: 'PRIVATE response', shareFields: ['receiving'], markRead: true, consent: true } as const;
const parsed = (patch = {}) => readingReflectionInput.parse({ ...input, ...patch });
function fixture() {
  const state = {
    devotion: { id: devotionId, date: '2026-10-16', version: 2, scripture_reference: '詩篇 23', scripture_text: '經文', devotional_title: '牧者', writable: true },
    note: null as any, previous: null as any, share: null as any, tombstone: false, duplicate: false,
  };
  const query = vi.fn(async (sql: string, values: any[] = []) => {
    const rows = (data: any[]) => ({ rows: data, rowCount: data.length });
    if (sql.includes('pg_advisory_xact_lock')) return rows([]);
    if (sql.startsWith('SELECT request_hash')) return rows(state.previous ? [state.previous] : []);
    if (sql.includes('FROM church_devotions')) return rows([state.devotion]);
    if (sql.includes('FROM devotional_note_deletions WHERE note_id')) return rows(state.tombstone ? [{}] : []);
    if (sql.startsWith('SELECT n.*')) return rows(state.note ? [state.note] : []);
    if (sql.startsWith('SELECT 1 FROM devotional_notes')) return rows(state.duplicate ? [{}] : []);
    if (sql.startsWith('SELECT 1 FROM life_group_shares')) return rows(state.share ? [{ id: mutationId }] : []);
    if (sql.startsWith('SELECT id FROM life_group_shares')) return rows(state.share && !state.share.withdrawn && state.share.version === 1 ? [state.share] : []);
    if (sql.startsWith('INSERT INTO devotional_notes')) { state.note = { id: values[0], version: 1, user_id: actor, source_devotional_date: state.devotion.date, verse_reference: state.devotion.scripture_reference, hidden: false, reading_plan_id: null, observation: values[6], core_insight_note: values[7], core_insight_category: values[8], action_plan: values[9] }; return rows([{ version: 1 }]); }
    if (sql.startsWith('UPDATE devotional_notes')) { state.note = { ...state.note, version: state.note.version + 1, observation: values[2], core_insight_note: values[3], core_insight_category: values[4], action_plan: values[5] }; return rows([{ version: state.note.version }]); }
    if (sql.startsWith('INSERT INTO life_group_shares')) { state.share = { id: values[0], body: values[4], version: 1 }; return rows([]); }
    if (sql.startsWith('INSERT INTO life_group_reading')) return rows([]);
    if (sql.startsWith('INSERT INTO devotion_share_requests')) { state.previous = { request_hash: values[2], result: JSON.parse(values[3]), church: values[4] }; return rows([]); }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { state, query, client: { query } as unknown as PoolClient };
}
const writes = (query: ReturnType<typeof fixture>['query']) => query.mock.calls.filter(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql));
const existingNote = () => ({ id: noteId, version: 7, user_id: actor, source_devotional_date: '2026-10-16', verse_reference: '詩篇 23', hidden: false, reading_plan_id: null, observation: 'old observation', core_insight_note: '{"PROMISE":"Legacy promise","GOD_ATTRIBUTE":"old receiving"}', core_insight_category: '["PROMISE","GOD_ATTRIBUTE"]', heartbeat_verse: 'Old highlighted verse', action_plan: 'old response', scholars_note: 'Preserved research', cool_down_note: 'Preserved review', title_phrase: 'Preserved title' });

describe('group reading reflection contracts', () => {
  it('requires a matching note version, explicit consent and selected nonempty unique fields', () => {
    for (const patch of [{ consent: false }, { noteId }, { shareFields: [] }, { shareFields: ['receiving', 'receiving'] }, { shareFields: ['response'], response: '  ' }, { actorId: actor }]) expect(readingReflectionInput.safeParse({ ...input, ...patch }).success).toBe(false);
    expect(readingReflectionInput.safeParse({ ...input, noteId, noteVersion: 7 }).success).toBe(true);
  });
  it('only composes selected fields in a stable order and enforces the combined bound', () => {
    expect(composeReadingReflection(parsed())).toBe('領受\nShared receiving');
    expect(composeReadingReflection(parsed({ shareFields: ['response', 'observation'] }))).toBe('看見\nPRIVATE observation\n\n回應\nPRIVATE response');
    expect(readingReflectionInput.safeParse({ ...input, observation: 'a'.repeat(5000), receiving: 'b'.repeat(5000), response: 'c'.repeat(5000), shareFields: ['observation', 'receiving', 'response'] }).success).toBe(false);
  });
  it('retains category and plain legacy insights, highlights and other fields', () => {
    const note = existingNote();
    expect(mergeReflectionReceiving(note, 'new receiving')).toEqual({ note: '{"PROMISE":"Legacy promise","GOD_ATTRIBUTE":"new receiving"}', categories: '["PROMISE","GOD_ATTRIBUTE"]' });
    expect(mergeReflectionReceiving(note, 'old receiving')).toEqual({ note: note.core_insight_note, categories: note.core_insight_category });
    expect(mergeReflectionReceiving({ ...note, core_insight_note: 'Plain legacy', core_insight_category: 'PROMISE' }, 'new receiving').note).toBe('{"PROMISE":"Plain legacy","GOD_ATTRIBUTE":"new receiving"}');
    expect(reflectionReceiving({ ...note, core_insight_note: null })).toBe('Old highlighted verse');
  });
});

describe('group reading reflection repository work (transaction supplied by group repository)', () => {
  it('saves all private fields, snapshots only selected content and checks in with one receipt', async () => {
    const f = fixture();
    const result = await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed());
    expect(result).toMatchObject({ noteVersion: 1, shareId: mutationId, markedRead: true });
    expect(f.state.note).toMatchObject({ observation: input.observation, action_plan: input.response, source_devotional_date: '2026-10-16' });
    expect(f.state.share.body).toBe('領受\nShared receiving');
    expect(f.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO life_group_reading'))).toHaveLength(1);
    expect(f.state.previous.result).toMatchObject({ operation: 'group-reading-reflection-v1', groupId: group.id, devotionId });
    expect(JSON.stringify(f.state.previous.result)).not.toContain('PRIVATE');
  });
  it('replays the original result without touching notes, shares or a later removed checkin', async () => {
    const f = fixture();
    const result = await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed());
    f.query.mockClear();
    expect(await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed())).toEqual(result);
    expect(writes(f.query)).toEqual([]);
    await expect(saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed({ markRead: false }))).rejects.toMatchObject({ status: 409 });
    expect(writes(f.query)).toEqual([]);
  });
  it('rejects an altered retry, withdrawn share, changed note, hidden note or tombstone without writing', async () => {
    for (const scenario of ['payload', 'withdrawn', 'version', 'hidden', 'deleted']) {
      const f = fixture();
      await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed());
      if (scenario === 'withdrawn') f.state.share.withdrawn = true;
      if (scenario === 'version') f.state.note.version++;
      if (scenario === 'hidden') f.state.note.hidden = true;
      if (scenario === 'deleted') f.state.tombstone = true;
      f.query.mockClear();
      await expect(saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed(scenario === 'payload' ? { response: 'changed private' } : {}))).rejects.toMatchObject({ status: scenario === 'hidden' ? 404 : 409 });
      expect(writes(f.query)).toEqual([]);
    }
  });
  it('uses exact owner/date/reference and optimistic version before updating an existing note', async () => {
    const f = fixture(); f.state.note = existingNote();
    await expect(saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed({ noteId, noteVersion: 6 }))).rejects.toMatchObject({ status: 409 });
    expect(writes(f.query)).toEqual([]);
    for (const patch of [{ user_id: mutationId }, { source_devotional_date: '2026-10-15' }, { verse_reference: '詩篇 24' }, { reading_plan_id: mutationId }]) {
      f.state.note = { ...existingNote(), ...patch };
      await expect(saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed({ noteId, noteVersion: 7 }))).rejects.toMatchObject({ status: 404 });
    }
    f.state.note = existingNote();
    const result = await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed({ noteId, noteVersion: 7, markRead: false }));
    expect(result).toMatchObject({ noteId, noteVersion: 8, markedRead: false });
    expect(f.state.note).toMatchObject({ scholars_note: 'Preserved research', cool_down_note: 'Preserved review', title_phrase: 'Preserved title', heartbeat_verse: 'Old highlighted verse' });
    expect(JSON.parse(f.state.note.core_insight_note)).toMatchObject({ PROMISE: 'Legacy promise', GOD_ATTRIBUTE: 'Shared receiving' });
  });
  it('blocks future writes, stale devotion versions, duplicate new-day notes and old publisher receipts', async () => {
    for (const scenario of ['future', 'version', 'duplicate', 'oldReceipt', 'churchReceipt']) {
      const f = fixture();
      if (scenario === 'future') f.state.devotion.writable = false;
      if (scenario === 'version') f.state.devotion.version++;
      if (scenario === 'duplicate') f.state.duplicate = true;
      if (scenario === 'oldReceipt') f.state.previous = { request_hash: 'old publisher hash', church: group.church, result: {} };
      if (scenario === 'churchReceipt') f.state.previous = { request_hash: 'other church hash', church: '火樂', result: {} };
      await expect(saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed())).rejects.toMatchObject({ status: scenario === 'future' ? 403 : 409 });
      expect(writes(f.query)).toEqual([]);
    }
  });
  it('retains a legitimate legacy map over 5000 chars and saves a bounded new receiving field', async () => {
    const f = fixture();
    const legacy = 'Preserved promise '.repeat(400);
    f.state.note = { ...existingNote(), core_insight_note: JSON.stringify({ PROMISE: legacy, GOD_ATTRIBUTE: 'old receiving' }) };
    const result = await saveReadingReflection(f.client, group, actor, devotionId, mutationId, parsed({ noteId, noteVersion: 7, receiving: 'x'.repeat(5000) }));
    expect(result.noteVersion).toBe(8);
    expect(JSON.parse(f.state.note.core_insight_note)).toEqual({ PROMISE: legacy, GOD_ATTRIBUTE: 'x'.repeat(5000) });
    expect(f.state.share.body).toBe(`領受\n${'x'.repeat(5000)}`);
  });
  it('loads structured owner-only fields with date/reference/visibility constraints', async () => {
    const f = fixture(); f.state.note = existingNote();
    expect(await loadReadingNote(f.client, actor, group.church, '2026-10-16')).toEqual({ note: { id: noteId, version: 7, observation: 'old observation', receiving: 'old receiving', response: 'old response' } });
    const [sql, params] = f.query.mock.calls.find(([sql]) => sql.startsWith('SELECT n.*'))!;
    expect(sql).toContain('n.hidden=false'); expect(sql).toContain('n.reading_plan_id IS NULL'); expect(sql).toContain('devotional_note_deletions');
    expect(params).toEqual([actor, '2026-10-16', '詩篇 23']);
  });
});
