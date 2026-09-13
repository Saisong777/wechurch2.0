import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { getChurchAliases, normalizeChurch, UNASSIGNED_CHURCH_ID } from './churches';
import { appendPastoralAccessCondition, type PastoralAccessFilter } from './pastoralAccess';

export class PersonMergeError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

// Every live person reference must move; historical evidence keeps its original IDs.
const references = [
  ['facility_bookings', 'requester_person_id'], ['journey_milestones', 'person_id'],
  ['line_accounts', 'person_id'], ['mentor_assignments', 'person_id'],
  ['mentor_assignments', 'mentor_person_id'], ['pastoral_tasks', 'person_id'],
  ['person_identity_links', 'person_id'], ['person_journeys', 'person_id'],
  ['person_journeys', 'mentor_person_id'], ['person_stage_progress', 'person_id'],
  ['serving_assignments', 'person_id'], ['serving_team_members', 'person_id'],
  ['persons', 'merged_into_person_id'],
] as const;
const historical = ['person_merge_suggestions.primary_person_id', 'person_merge_suggestions.duplicate_person_id',
  'person_merge_audit.primary_person_id', 'person_merge_audit.duplicate_person_id'];

export async function mergePersons(database: Pool, input: {
  primaryPersonId: string; duplicatePersonId: string; churchScope: string | null;
  actorUserId?: string | null; preview?: boolean; previewToken?: string;
  access?: PastoralAccessFilter;
}) {
  const { primaryPersonId: primary, duplicatePersonId: duplicate, churchScope } = input;
  if (primary === duplicate) throw new PersonMergeError('不可合併同一個人', 400);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('person-merge'))");
    const people = await client.query('SELECT * FROM persons WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[primary, duplicate]]);
    if (input.access) {
      const params: unknown[] = [[primary, duplicate]], conditions = ['p.id=ANY($1::uuid[])'];
      appendPastoralAccessCondition(conditions, params, 'p', input.access);
      if ((await client.query(`SELECT p.id FROM persons p WHERE ${conditions.join(' AND ')}`, params)).rowCount !== 2) throw new PersonMergeError('對象不在管理範圍內', 404);
    }
    const inScope = (church: string | null) => churchScope === null || (churchScope === UNASSIGNED_CHURCH_ID
      ? !church?.trim() : getChurchAliases(churchScope).includes(church || ''));
    if (people.rows.length !== 2 || people.rows.some(p => p.merged_into_person_id || !inScope(p.church))) {
      throw new PersonMergeError('對象不存在、已合併，或不在管理範圍內', 404);
    }
    if (normalizeChurch(people.rows[0].church) !== normalizeChurch(people.rows[1].church)) throw new PersonMergeError('不同教會的資料不可合併');
    const foreignKeys = await client.query<{ table_name: string; column_name: string }>(
      `SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
       WHERE c.contype='f' AND c.confrelid='persons'::regclass`);
    const known = new Set([...references.map(([table, column]) => `${table}.${column}`), ...historical]);
    if (foreignKeys.rows.some(row => !known.has(`${row.table_name}.${row.column_name}`))) {
      throw new PersonMergeError('有尚未納入合併的新資料關聯，請先更新合併規則');
    }
    const snapshot: Record<string, unknown> = { people: people.rows };
    const counts: Record<string, number> = {};
    for (const [table, column] of references) {
      const rows = await client.query(`SELECT * FROM "${table}" WHERE "${column}"=ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[primary, duplicate]]);
      snapshot[`${table}.${column}`] = rows.rows;
      counts[`${table}.${column}`] = rows.rows.filter(row => row[column] === duplicate).length;
    }
    const previewToken = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    if (!input.preview && input.previewToken !== previewToken) throw new PersonMergeError('資料已變更，請重新預覽後再合併');
    for (const [table, column] of references) {
      await client.query(`UPDATE "${table}" SET "${column}"=$1 WHERE "${column}"=$2`, [primary, duplicate]);
    }
    await client.query(`UPDATE persons p SET notes=concat_ws(E'\n',NULLIF(p.notes,''),
      (SELECT CASE WHEN NULLIF(notes,'') IS NOT NULL THEN '[合併紀錄] ' || notes ELSE NULL END FROM persons WHERE id=$2)),
      updated_at=NOW() WHERE p.id=$1`, [primary, duplicate]);
    await client.query("UPDATE persons SET merged_into_person_id=$1, pastoral_status='merged', updated_at=NOW() WHERE id=$2", [primary, duplicate]);
    await client.query(`INSERT INTO person_merge_audit(primary_person_id,duplicate_person_id,actor_user_id,snapshot)
      VALUES($1,$2,$3,$4::jsonb)`, [primary, duplicate, input.actorUserId || null, JSON.stringify(snapshot)]);
    await client.query(`INSERT INTO person_merge_suggestions(primary_person_id,duplicate_person_id,reason,confidence,status)
      VALUES($1,$2,'已合併',100,'merged') ON CONFLICT(primary_person_id,duplicate_person_id)
      DO UPDATE SET status='merged',updated_at=NOW()`, [primary, duplicate]);
    await client.query(input.preview ? 'ROLLBACK' : 'COMMIT');
    return { success: true, primaryPersonId: primary, duplicatePersonId: duplicate, previewToken, counts,
      primaryName: people.rows.find(p => p.id === primary).display_name,
      duplicateName: people.rows.find(p => p.id === duplicate).display_name };
  } catch (error) {
    await client.query('ROLLBACK');
    const code = (error as { code?: string }).code;
    if (code === '23505') throw new PersonMergeError('兩筆資料有重複的進度、服事或身份紀錄。請先確認衝突，原資料均未更動');
    if (code === '55P03' || code === '40P01') throw new PersonMergeError('資料正在更新，請稍後重新預覽');
    throw error;
  } finally { client.release(); }
}
