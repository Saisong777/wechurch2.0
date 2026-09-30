import { pool } from './db';

export async function deleteDevotionalNote(id: string, actor: string, version: number): Promise<'deleted' | 'missing' | 'conflict'> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('im-bible-import',0))");
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`devotional:${id}`]);
    const note = (await c.query('SELECT version FROM devotional_notes WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, actor])).rows[0];
    if (!note) {
      const deleted = (await c.query('SELECT 1 FROM devotional_note_deletions WHERE note_id=$1 AND user_id=$2', [id, actor])).rowCount;
      await c.query('COMMIT');
      return deleted ? 'deleted' : 'missing';
    }
    if (note.version !== version) {
      await c.query('ROLLBACK');
      return 'conflict';
    }
    await c.query(`INSERT INTO devotional_note_deletions(note_id,user_id,source_key,record_sha256)
      SELECT $1,$2,r.source_key,r.record_sha256 FROM (SELECT 1) seed
      LEFT JOIN im_source_records r ON r.note_id=$1 AND r.user_id=$2`, [id, actor]);
    // Remove only shares linked to this private original; unrelated posts and reading check-ins survive.
    await c.query("UPDATE life_group_shares SET withdrawn_at=COALESCE(withdrawn_at,now()),title='已刪除筆記',body='',reference='',source_id=NULL,version=version+1,updated_at=now() WHERE source_id=$1 AND author_id=$2 AND kind='note'", [id, actor]);
    await c.query('DELETE FROM devotion_wall_posts WHERE source_note_id=$1 AND user_id=$2', [id, actor]);
    await c.query('UPDATE user_reading_progress SET devotional_note_id=NULL WHERE devotional_note_id=$1', [id]);
    await c.query('DELETE FROM im_source_records WHERE note_id=$1 AND user_id=$2', [id, actor]);
    await c.query('DELETE FROM devotional_notes WHERE id=$1 AND user_id=$2', [id, actor]);
    await c.query('COMMIT');
    return 'deleted';
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}
