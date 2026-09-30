import type { PoolClient } from 'pg';
import { pool } from './db';
import { devotionInput, shiftDevotionDate, type DevotionEntry, type DevotionInput, type ImportPreview } from '../shared/churchDevotion';

export class DevotionConflict extends Error {}
const columns = `id, date::text, plan_name AS "planName", day_number AS "dayNumber",
  scripture_reference AS "scriptureReference", scripture_text AS "scriptureText",
  devotional_title AS "devotionalTitle", devotional_text AS "devotionalText",
  prayer, love_action AS "loveAction", status, version, updated_at AS "updatedAt"`;

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize schedule edits so imports and date swaps cannot race each other.
    await client.query('SELECT pg_advisory_xact_lock(73624810)');
    await client.query('SET CONSTRAINTS church_devotions_date_unique DEFERRED');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new DevotionConflict('日期已被其他課程使用，沒有儲存任何變更。');
    throw error;
  } finally { client.release(); }
}

export async function listChurchDevotions(from: string, to: string) {
  return (await pool.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE date BETWEEN $1 AND $2 ORDER BY date`, [from, to])).rows;
}

async function writeEntry(client: PoolClient, actor: string, input: DevotionInput, before?: DevotionEntry, action = 'edit') {
  const data = devotionInput.parse(input);
  const values = [data.date, data.planName, data.dayNumber, data.scriptureReference, data.scriptureText, data.devotionalTitle, data.devotionalText, data.prayer, data.loveAction, data.status, actor];
  const query = before
    ? `UPDATE church_devotions SET date=$1, plan_name=$2, day_number=$3, scripture_reference=$4, scripture_text=$5, devotional_title=$6, devotional_text=$7, prayer=$8, love_action=$9, status=$10, updated_by=$11, version=version+1, updated_at=now() WHERE id=$12 RETURNING ${columns}`
    : `INSERT INTO church_devotions (date,plan_name,day_number,scripture_reference,scripture_text,devotional_title,devotional_text,prayer,love_action,status,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${columns}`;
  const after = (await client.query<DevotionEntry>(query, before ? [...values, before.id] : values)).rows[0];
  await client.query('INSERT INTO church_devotion_history(devotion_id,actor_id,action,before_data,after_data) VALUES ($1,$2,$3,$4,$5)', [after.id, actor, action, before ? JSON.stringify(before) : null, JSON.stringify(after)]);
  return after;
}

export function saveChurchDevotion(actor: string, input: DevotionInput, id?: string, version?: number) {
  return transaction(async client => {
    const before = id ? (await client.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE id=$1 FOR UPDATE`, [id])).rows[0] : undefined;
    if (id && (!before || before.version !== version)) throw new DevotionConflict('這筆課程已被修改，請重新載入後再編輯。');
    return writeEntry(client, actor, input, before, before ? 'edit' : 'create');
  });
}

export async function previewDevotionImport(actor: string, entries: Array<{ row: number; entry: DevotionInput }>, mode: 'skip' | 'replace'): Promise<ImportPreview> {
  return transaction(async client => {
    const existing = (await client.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE date=ANY($1::date[])`, [entries.map(item => item.entry.date)])).rows;
    const byDate = new Map(existing.map(entry => [entry.date, entry]));
    const preview: ImportPreview = { issues: [], rows: entries.map(item => {
      const current = byDate.get(item.entry.date);
      return { ...item, action: current ? mode : 'create', existingId: current?.id ?? null, existingVersion: current?.version ?? null, before: current };
    }) };
    const stored = (await client.query<{ id: string; expiresAt: string }>('INSERT INTO church_devotion_imports(user_id,preview) VALUES ($1,$2) RETURNING id, expires_at AS "expiresAt"', [actor, JSON.stringify(preview)])).rows[0];
    return { ...preview, ...stored };
  });
}

export function commitDevotionImport(actor: string, id: string) {
  return transaction(async client => {
    const batch = (await client.query('SELECT *, expires_at < now() AS expired FROM church_devotion_imports WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, actor])).rows[0];
    if (!batch) throw new DevotionConflict('找不到這次匯入，請重新預覽。');
    if (batch.result) return batch.result as { created: number; replaced: number; skipped: number };
    if (batch.expired) throw new DevotionConflict('預覽已超過 30 分鐘，請重新預覽。');
    const preview = batch.preview as ImportPreview;
    const result = { created: 0, replaced: 0, skipped: 0 };
    for (const item of preview.rows) {
      if (item.action === 'skip') { result.skipped++; continue; }
      const current = (await client.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE date=$1 FOR UPDATE`, [item.entry.date])).rows[0];
      if ((current?.id ?? null) !== item.existingId || (current?.version ?? null) !== item.existingVersion) throw new DevotionConflict(`${item.entry.date} 在預覽後有變更，整批未匯入，請重新預覽。`);
      await writeEntry(client, actor, { ...item.entry, status: 'draft' }, current, 'import');
      if (current) result.replaced++; else result.created++;
    }
    await client.query('UPDATE church_devotion_imports SET result=$1 WHERE id=$2', [JSON.stringify(result), id]);
    return result;
  });
}

export function batchChurchDevotions(actor: string, items: Array<{ id: string; version: number }>, action: 'publish' | 'draft' | 'shift' | 'swap', days?: number) {
  return transaction(async client => {
    const current = (await client.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE id=ANY($1::uuid[]) ORDER BY date FOR UPDATE`, [items.map(item => item.id)])).rows;
    if (current.length !== items.length || current.some(entry => items.find(item => item.id === entry.id)?.version !== entry.version)) throw new DevotionConflict('選取的課程已被修改，請重新載入。');
    const result: DevotionEntry[] = [];
    for (const [index, entry] of current.entries()) {
      const date = action === 'swap' ? current[1 - index].date : action === 'shift' ? shiftDevotionDate(entry.date, days!) : entry.date;
      result.push(await writeEntry(client, actor, { ...entry, date, status: action === 'publish' ? 'published' : action === 'draft' ? 'draft' : entry.status }, entry, action));
    }
    return result;
  });
}

export async function churchDevotionHistory(id: string) {
  return (await pool.query('SELECT id, action, before_data AS "before", after_data AS "after", created_at AS "createdAt" FROM church_devotion_history WHERE devotion_id=$1 ORDER BY created_at DESC, id DESC LIMIT 30', [id])).rows;
}

export function restoreChurchDevotion(actor: string, id: string, historyId: string, version: number) {
  return transaction(async client => {
    const current = (await client.query<DevotionEntry>(`SELECT ${columns} FROM church_devotions WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!current || current.version !== version) throw new DevotionConflict('課程已被修改，請重新載入後再回復。');
    const history = (await client.query('SELECT after_data FROM church_devotion_history WHERE id=$1 AND devotion_id=$2', [historyId, id])).rows[0];
    if (!history) throw new DevotionConflict('找不到這筆課程的歷史版本。');
    // Restore content into the current slot; never silently move dates or republish.
    return writeEntry(client, actor, { ...history.after_data, date: current.date, status: 'draft' }, current, 'restore');
  });
}

export async function getManagedChurchDevotion(date: string) {
  // One statement gives a consistent schedule/mode snapshot during publication.
  const row = (await pool.query(`SELECT EXISTS(SELECT 1 FROM church_devotions) AS managed,
    (SELECT row_to_json(d) FROM (SELECT ${columns} FROM church_devotions WHERE date=$1 AND status='published') d) AS entry`, [date])).rows[0];
  return row as { managed: boolean; entry: DevotionEntry | null };
}
