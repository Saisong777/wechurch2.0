import { pool } from './db';
import type { PersonalPrayerInput } from '../shared/personalPrayer';

const columns = 'id, user_id AS "userId", title, prayer, response, status, response_type AS "responseType", created_at AS "createdAt", updated_at AS "updatedAt"';

export async function listPersonalPrayers(userId: string) {
  return (await pool.query(`SELECT ${columns} FROM personal_prayers WHERE user_id=$1 ORDER BY created_at DESC`, [userId])).rows;
}

export async function savePersonalPrayer(userId: string, id: string, input: PersonalPrayerInput, create: boolean) {
  const values = [id, userId, input.title, input.prayer, input.response, input.status, input.responseType];
  const query = create
    ? `INSERT INTO personal_prayers (id,user_id,title,prayer,response,status,response_type) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET title=$3,prayer=$4,response=$5,status=$6,response_type=$7,updated_at=now()
       WHERE personal_prayers.user_id=$2 RETURNING ${columns}`
    : `UPDATE personal_prayers SET title=$3,prayer=$4,response=$5,status=$6,response_type=$7,updated_at=now()
       WHERE id=$1 AND user_id=$2 RETURNING ${columns}`;
  return (await pool.query(query, values)).rows[0];
}
