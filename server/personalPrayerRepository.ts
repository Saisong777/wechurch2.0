import { pool } from './db';
import type { PersonalPrayerWrite } from '../shared/personalPrayer';
import { GroupError } from './lifeGroupRepository';

const columns = 'id, user_id AS "userId", title, prayer, response, status, response_type AS "responseType", created_at AS "createdAt", updated_at AS "updatedAt"';

export async function listPersonalPrayers(userId: string) {
  return (await pool.query(`SELECT ${columns} FROM personal_prayers WHERE user_id=$1 ORDER BY created_at DESC`, [userId])).rows;
}

export async function savePersonalPrayer(userId: string, id: string, input: PersonalPrayerWrite, create: boolean) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const values = [id, userId, input.title, input.prayer, input.response, input.status, input.responseType];
    if (create) {
      const inserted = await c.query(`INSERT INTO personal_prayers (id,user_id,title,prayer,response,status,response_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING RETURNING ${columns}`, values);
      // A retried create must never overwrite a later edit or republish a closed share.
      const saved = inserted.rows[0] || (await c.query(`SELECT ${columns} FROM personal_prayers WHERE id=$1 AND user_id=$2`, [id,userId])).rows[0];
      await c.query('COMMIT');
      return saved;
    }
    const previous = (await c.query('SELECT updated_at FROM personal_prayers WHERE id=$1 AND user_id=$2 FOR UPDATE', [id,userId])).rows[0];
    if (!previous) { await c.query('COMMIT'); return undefined; }
    if (input.expectedUpdatedAt && new Date(previous.updated_at).getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
      throw new GroupError(409, '這筆禱告已在另一個頁面更新。你的文字仍保留，請先重新載入並核對最新紀錄。');
    }
    const saved = (await c.query(`UPDATE personal_prayers SET title=$3,prayer=$4,response=$5,status=$6,response_type=$7,
      updated_at=GREATEST(clock_timestamp(),updated_at + interval '1 millisecond') WHERE id=$1 AND user_id=$2 RETURNING ${columns}`, values)).rows[0];
    if (input.closePublicShare) {
      await c.query(`UPDATE prayers SET closed_at=COALESCE(closed_at,now()),is_urgent=false,is_pinned=false,
        is_answered=$3,answered_at=CASE WHEN $3 THEN COALESCE(answered_at,now()) ELSE NULL END
        WHERE user_id=$2 AND id IN (SELECT post_id FROM personal_prayer_shares WHERE prayer_id=$1 AND owner_id=$2 AND destination='public')`,
      [id,userId,input.status === 'answered']);
    }
    await c.query('COMMIT');
    return saved;
  } catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}
