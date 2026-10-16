import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { composeReadingReflection, readingNoteResponse, readingReflectionInput, readingReflectionResult, type ReadingReflectionInput } from '../shared/lifeGroup';
import { GroupError } from './groupError';

const conflict = () => new GroupError(409, '筆記、日課或分享狀態已更新，請重新載入後再確認；你的輸入尚未重新送出。');
const missing = () => new GroupError(404, '找不到本人可用的日課筆記。');
const operation = 'group-reading-reflection-v1';
const receipt = z.object({ operation: z.literal(operation), groupId: z.string().uuid(), devotionId: z.string().uuid(), date: z.string(), result: readingReflectionResult }).strict();
type Note = { id: string; version: number; user_id: string; source_devotional_date: string; verse_reference: string; reading_plan_id: string | null; hidden: boolean; observation: string | null; core_insight_note: string | null; core_insight_category: string | null; heartbeat_verse: string | null; action_plan: string | null };

// Keep older category notes and unrelated journal fields intact when this three-field editor saves.
export function reflectionInsightMap(raw: string | null, categories: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    raw = value;
  } catch { /* Older notes stored plain text. */ }
  let category = 'legacy';
  try { const value = JSON.parse(categories || 'null'); if (Array.isArray(value) && typeof value[0] === 'string') category = value[0]; } catch { if (categories) category = categories; }
  return raw ? { [category]: raw } : {};
}
export function reflectionReceiving(note: Pick<Note, 'core_insight_note' | 'core_insight_category' | 'heartbeat_verse'>) {
  const map = reflectionInsightMap(note.core_insight_note, note.core_insight_category);
  return typeof map.GOD_ATTRIBUTE === 'string' ? map.GOD_ATTRIBUTE : Object.values(map).filter((v): v is string => typeof v === 'string' && !!v).join('\n') || note.heartbeat_verse || '';
}
export function mergeReflectionReceiving(note: Pick<Note, 'core_insight_note' | 'core_insight_category' | 'heartbeat_verse'>, receiving: string) {
  if (receiving === reflectionReceiving(note)) return { note: note.core_insight_note, categories: note.core_insight_category };
  const map = reflectionInsightMap(note.core_insight_note, note.core_insight_category);
  let categories: string[] = [];
  try { const value = JSON.parse(note.core_insight_category || '[]'); if (Array.isArray(value)) categories = value.filter(v => typeof v === 'string'); } catch { if (note.core_insight_category) categories = [note.core_insight_category]; }
  return { note: JSON.stringify({ ...map, GOD_ATTRIBUTE: receiving }), categories: JSON.stringify([...new Set([...categories, 'GOD_ATTRIBUTE'])]) };
}

async function publishedDevotion(c: PoolClient, church: string, date: string) {
  return (await c.query(`SELECT id,date::text,version,scripture_reference,scripture_text,devotional_title FROM church_devotions WHERE date=$1 AND church=$2 AND status='published' FOR SHARE`, [date, church])).rows[0];
}
export async function loadReadingNote(c: PoolClient, actor: string, church: string, date: string) {
  const devotion = await publishedDevotion(c, church, date);
  if (!devotion) return readingNoteResponse.parse({ note: null });
  const note = (await c.query(`SELECT n.*,n.source_devotional_date::text FROM devotional_notes n WHERE n.user_id=$1 AND n.source_devotional_date=$2 AND n.verse_reference=$3 AND n.reading_plan_id IS NULL AND n.hidden=false AND NOT EXISTS(SELECT 1 FROM devotional_note_deletions d WHERE d.note_id=n.id) ORDER BY n.updated_at DESC,n.id DESC LIMIT 1`, [actor, date, devotion.scripture_reference])).rows[0] as Note | undefined;
  return readingNoteResponse.parse({ note: note ? { id: note.id, version: note.version, observation: note.observation || '', receiving: reflectionReceiving(note), response: note.action_plan || '' } : null });
}

export async function saveReadingReflection(c: PoolClient, group: { id: string; church: string }, actor: string, devotionId: string, mutationId: string, rawInput: ReadingReflectionInput) {
  const input = readingReflectionInput.parse(rawInput);
  // Share the lock namespace with the existing multi-destination publisher. Its raw-input hash
  // cannot claim this operation's namespaced receipt, or vice versa.
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`devotion-share/${actor}/${mutationId}`]);
  const hash = createHash('sha256').update(JSON.stringify({ operation, groupId: group.id, devotionId, input: { ...input, shareFields: [...input.shareFields].sort() } })).digest('hex');
  const previous = (await c.query('SELECT request_hash,result,church FROM devotion_share_requests WHERE user_id=$1 AND request_id=$2', [actor, mutationId])).rows[0];
  if (previous && (previous.request_hash !== hash || previous.church !== group.church)) throw conflict();
  const devotion = (await c.query(`SELECT id,date::text,version,scripture_reference,scripture_text,devotional_title,date<=(clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date AS writable FROM church_devotions WHERE id=$1 AND church=$2 AND status='published' FOR SHARE`, [devotionId, group.church])).rows[0];
  if (!devotion || devotion.version !== input.devotionVersion) throw conflict();
  if (!devotion.writable) throw new GroupError(403, '明天的日課可預讀；筆記、分享與已讀請於當天再送出。');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`group-reading-note/${actor}/${devotion.date}/${devotion.scripture_reference}`]);
  const prior = previous ? receipt.safeParse(previous.result) : null;
  if (prior && (!prior.success || prior.data.groupId !== group.id || prior.data.devotionId !== devotionId || prior.data.date !== devotion.date)) throw conflict();
  const noteId = prior?.success ? prior.data.result.noteId : input.noteId || randomUUID();
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`devotional:${noteId}`]);
  if ((await c.query('SELECT 1 FROM devotional_note_deletions WHERE note_id=$1', [noteId])).rowCount) throw conflict();
  const note = (await c.query('SELECT n.*,n.source_devotional_date::text FROM devotional_notes n WHERE n.id=$1 FOR UPDATE', [noteId])).rows[0] as Note | undefined;
  if (note && (note.user_id !== actor || note.hidden || note.reading_plan_id || note.source_devotional_date !== devotion.date || note.verse_reference !== devotion.scripture_reference)) throw missing();
  const body = composeReadingReflection(input);
  const title = `${devotion.date} · ${devotion.devotional_title}`.slice(0, 160);
  if (prior?.success) {
    const result = prior.data.result;
    if (!note || note.version !== result.noteVersion) throw conflict();
    const share = (await c.query(`SELECT id FROM life_group_shares WHERE id=$1 AND group_id=$2 AND author_id=$3 AND source_id=$4 AND kind='note' AND title=$5 AND body=$6 AND reference=$7 AND NOT is_anonymous AND version=1 AND withdrawn_at IS NULL FOR SHARE`, [result.shareId, group.id, actor, noteId, title, body, devotion.scripture_reference])).rows[0];
    if (!share) throw conflict();
    // Return the original outcome; a later uncheck must not be checked again by a retry.
    return readingReflectionResult.parse(result);
  }
  if (input.noteId && (!note || note.version !== input.noteVersion)) throw conflict();
  if (!input.noteId) {
    if (note || (await c.query(`SELECT 1 FROM devotional_notes n WHERE n.user_id=$1 AND n.source_devotional_date=$2 AND n.verse_reference=$3 AND n.reading_plan_id IS NULL LIMIT 1`, [actor, devotion.date, devotion.scripture_reference])).rowCount) throw conflict();
  }
  if ((await c.query('SELECT 1 FROM life_group_shares WHERE id=$1', [mutationId])).rowCount) throw conflict();
  const merged = mergeReflectionReceiving(note || { core_insight_note: null, core_insight_category: null, heartbeat_verse: null }, input.receiving);
  let noteVersion: number;
  if (note) {
    noteVersion = (await c.query(`UPDATE devotional_notes SET observation=$3,core_insight_note=$4,core_insight_category=$5,action_plan=$6,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND version=$7 AND hidden=false RETURNING version`, [noteId, actor, input.observation, merged.note, merged.categories, input.response, input.noteVersion])).rows[0]?.version;
    if (!noteVersion) throw conflict();
  } else {
    noteVersion = (await c.query(`INSERT INTO devotional_notes(id,user_id,source_devotional_date,source_label,verse_reference,verse_text,title_phrase,observation,core_insight_note,core_insight_category,action_plan) VALUES($1,$2,$3,'教會每日靈修',$4,$5,$6,$7,$8,$9,$10) RETURNING version`, [noteId, actor, devotion.date, devotion.scripture_reference, devotion.scripture_text || '', devotion.devotional_title, input.observation, merged.note, merged.categories, input.response])).rows[0].version;
  }
  await c.query(`INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,reference,source_id,is_anonymous) VALUES($1,$2,$3,'note',$4,$5,$6,$7,false)`, [mutationId, group.id, actor, title, body, devotion.scripture_reference, noteId]);
  if (input.markRead) await c.query('INSERT INTO life_group_reading(group_id,user_id,devotion_id,devotion_version) VALUES($1,$2,$3,$4) ON CONFLICT(group_id,user_id,devotion_id) DO UPDATE SET devotion_version=$4,created_at=now()', [group.id, actor, devotionId, input.devotionVersion]);
  const result = readingReflectionResult.parse({ noteId, noteVersion, shareId: mutationId, markedRead: input.markRead });
  await c.query('INSERT INTO devotion_share_requests(user_id,request_id,request_hash,result,church) VALUES($1,$2,$3,$4,$5)', [actor, mutationId, hash, JSON.stringify({ operation, groupId: group.id, devotionId, date: devotion.date, result }), group.church]);
  return result;
}
