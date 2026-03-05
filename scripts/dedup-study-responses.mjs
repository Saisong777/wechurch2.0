import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const client = await pool.connect();
try {
  const dupes = await client.query(`
    SELECT session_id, user_id, COUNT(*) as cnt
    FROM study_responses
    GROUP BY session_id, user_id
    HAVING COUNT(*) > 1
  `);
  console.log('重複組合數:', dupes.rows.length);

  if (dupes.rows.length > 0) {
    const result = await client.query(`
      DELETE FROM study_responses
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (PARTITION BY session_id, user_id ORDER BY updated_at DESC) as rn
          FROM study_responses
        ) t
        WHERE rn > 1
      )
    `);
    console.log('已刪除舊重複筆數:', result.rowCount);
  }

  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "study_responses_session_user_unique" ON "study_responses"("session_id","user_id")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "study_responses_session_id_idx" ON "study_responses"("session_id")`);
  console.log('索引建立成功 ✓');
} finally {
  client.release();
  await pool.end();
}
