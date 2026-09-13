import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { groupAccess, GroupError } from './lifeGroupRepository';
import type { PrayerSharingInput } from '../shared/prayerSharing';

async function transaction<T>(work: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}

export async function listPrayerDeliveries(actor: string) {
  return (await pool.query(`SELECT s.prayer_id AS "prayerId",s.destination,s.group_id AS "groupId",s.post_id AS "postId",s.is_anonymous AS anonymous,s.created_at AS "createdAt",
    CASE WHEN s.group_id IS NULL THEN CASE WHEN EXISTS(SELECT 1 FROM prayers p WHERE p.id=s.post_id AND (p.closed_at IS NOT NULL OR p.is_answered)) THEN '已結束的代禱（本人紀錄）' ELSE '公共禱告牆' END ELSE COALESCE(g.name,'原小組') END AS name,
    CASE WHEN s.group_id IS NULL THEN (SELECT p.content FROM prayers p WHERE p.id=s.post_id)
      ELSE (SELECT p.title || E'\\n\\n' || p.body FROM life_group_shares p WHERE p.id=s.post_id AND p.withdrawn_at IS NULL) END AS content
    FROM personal_prayer_shares s LEFT JOIN small_groups g ON g.id=s.group_id
    WHERE s.owner_id=$1 AND ((s.group_id IS NULL AND EXISTS(SELECT 1 FROM prayers p WHERE p.id=s.post_id)) OR
    (s.group_id IS NOT NULL AND EXISTS(SELECT 1 FROM life_group_shares p WHERE p.id=s.post_id AND p.withdrawn_at IS NULL)))
    ORDER BY s.created_at DESC`, [actor])).rows;
}

export function sharePersonalPrayers(actor: string, input: PrayerSharingInput) {
  return transaction(async c => {
    if (input.groupId) await groupAccess(c, input.groupId, actor);
    // Serialize on source rows so overlapping batches cannot publish duplicates.
    const owned = await c.query('SELECT id FROM personal_prayers WHERE id=ANY($1::uuid[]) AND user_id=$2 ORDER BY id FOR UPDATE', [input.items.map(i => i.sourceId), actor]);
    if (owned.rowCount !== input.items.length) throw new GroupError(404, '找不到本人禱告，未分享任何內容。');
    let created = 0; let skipped = 0;
    const destinations = [...(input.groupId ? [input.groupId] : []), ...(input.publicWall ? ['public'] : [])];
    for (const item of input.items) for (const destination of destinations) {
      const isPublic = destination === 'public';
      const previous = (await c.query('SELECT post_id FROM personal_prayer_shares WHERE prayer_id=$1 AND destination=$2', [item.sourceId, destination])).rows[0];
      if (previous) {
        const active = await c.query(isPublic ? 'SELECT id FROM prayers WHERE id=$1' : 'SELECT id FROM life_group_shares WHERE id=$1 AND withdrawn_at IS NULL', [previous.post_id]);
        if (active.rowCount) { skipped++; continue; }
      }
      const postId = randomUUID();
      if (isPublic) await c.query("INSERT INTO prayers(id,user_id,content,category,is_anonymous) VALUES($1,$2,$3,'supplication',$4)", [postId,actor,`${item.title}\n\n${item.body}`,input.anonymous]);
      else await c.query("INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,reference,source_id,is_anonymous) VALUES($1,$2,$3,'prayer',$4,$5,'',$6,$7)", [postId,destination,actor,item.title,item.body,item.sourceId,input.anonymous]);
      await c.query(`INSERT INTO personal_prayer_shares(prayer_id,destination,owner_id,group_id,post_id,is_anonymous) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(prayer_id,destination) DO UPDATE SET post_id=$5,is_anonymous=$6,created_at=now()`, [item.sourceId,destination,actor,isPublic ? null : destination,postId,input.anonymous]);
      created++;
    }
    return { created, skipped };
  });
}

export async function deletePublicPrayer(c: PoolClient, postId: string) {
  await c.query('DELETE FROM prayer_notifications WHERE prayer_id=$1', [postId]);
  await c.query('DELETE FROM prayer_comments WHERE prayer_id=$1', [postId]);
  await c.query('DELETE FROM prayer_amens WHERE prayer_id=$1', [postId]);
  await c.query('DELETE FROM prayers WHERE id=$1', [postId]);
}

export function withdrawPrayerDelivery(actor: string, prayerId: string, destination: string) {
  return transaction(async c => {
    if (!(await c.query('SELECT id FROM personal_prayers WHERE id=$1 AND user_id=$2 FOR UPDATE', [prayerId,actor])).rowCount) throw new GroupError(404, '找不到本人禱告。');
    const s = (await c.query('SELECT * FROM personal_prayer_shares WHERE prayer_id=$1 AND destination=$2 AND owner_id=$3 FOR UPDATE', [prayerId,destination,actor])).rows[0];
    if (!s) return { ok: true };
    // Owners may withdraw their own previously shared copy even after leaving a group.
    if (s.group_id) await c.query('UPDATE life_group_shares SET withdrawn_at=now() WHERE id=$1 AND author_id=$2', [s.post_id,actor]);
    else { await c.query('SELECT id FROM prayers WHERE id=$1 FOR UPDATE', [s.post_id]); await deletePublicPrayer(c,s.post_id); }
    await c.query('DELETE FROM personal_prayer_shares WHERE prayer_id=$1 AND destination=$2', [prayerId,destination]);
    return { ok: true };
  });
}

export async function publicPrayerFeed(actor: string, mine = false) {
  return (await pool.query(`SELECT p.id,p.content,p.category,p.is_anonymous AS "isAnonymous",p.is_pinned AS "isPinned",p.is_answered AS "isAnswered",p.answered_at AT TIME ZONE 'UTC' AS "answeredAt",p.scripture_reference AS "scriptureReference",p.created_at AT TIME ZONE 'UTC' AS "createdAt",
    CASE WHEN p.is_anonymous THEN NULL ELSE p.user_id END AS "userId",p.user_id=$1 AS "isOwner",
    CASE WHEN p.is_anonymous THEN '匿名' ELSE COALESCE(NULLIF(u.display_name,''),'教會成員') END AS "authorName",
    CASE WHEN p.is_anonymous THEN NULL ELSE u.avatar_url END AS "authorAvatar",
    (SELECT count(DISTINCT a.user_id)::int FROM prayer_amens a WHERE a.prayer_id=p.id) AS "amenCount",
    EXISTS(SELECT 1 FROM prayer_amens a WHERE a.prayer_id=p.id AND a.user_id=$1) AS "hasAmened",
    p.is_urgent AS "isUrgent",p.closed_at AS "closedAt",
    (SELECT count(*)::int FROM prayer_comments c WHERE c.prayer_id=p.id) AS "commentCount",
    COALESCE((SELECT jsonb_agg(r) FROM (SELECT kind,count(*)::int AS count,bool_or(user_id=$1) AS selected FROM prayer_reactions WHERE prayer_id=p.id GROUP BY kind) r),'[]'::jsonb) AS reactions
    FROM prayers p JOIN users u ON u.id=p.user_id
    WHERE CASE WHEN $2::boolean THEN p.user_id=$1 ELSE p.closed_at IS NULL AND NOT p.is_answered END
    ORDER BY p.created_at DESC`, [actor,mine])).rows;
}

export function publicPrayerReceipt(prayer: { id: string; isAnonymous: boolean; isPinned?: boolean; isUrgent?: boolean; isAnswered?: boolean; answeredAt?: Date | null; closedAt?: Date | null }) {
  return { id: prayer.id, isAnonymous: prayer.isAnonymous, isPinned: prayer.isPinned, isUrgent: prayer.isUrgent, isAnswered: prayer.isAnswered, answeredAt: prayer.answeredAt, closedAt: prayer.closedAt };
}
