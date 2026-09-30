import type { PoolClient } from 'pg';
import { pool } from './db';
import { notificationLabels, type NotificationKind } from '../shared/notifications';

type Event = { recipient: string; actor: string; kind: NotificationKind; key: string; prayerId?: string; shareId?: string; prayerCommentId?: string; familyCommentId?: string };
export async function recordInteraction(c: PoolClient, event: Event) {
  if (event.recipient === event.actor) return;
  // Called inside the interaction's transaction. Receipt/reaction retries never create new alerts.
  await c.query(`INSERT INTO interaction_notifications(user_id,actor_id,kind,event_key,prayer_id,share_id,prayer_comment_id,family_comment_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,event_key) DO NOTHING`,
  [event.recipient,event.actor,event.kind,event.key,event.prayerId || null,event.shareId || null,event.prayerCommentId || null,event.familyCommentId || null]);
}
export async function recordCommentInteraction(c: PoolClient, actor: string, targetId: string, commentId: string, family = false) {
  // Notify the author and existing participants, never the sender or the entire church/family.
  const recipients = family
    ? `SELECT author_id AS id FROM life_group_shares WHERE id=$1 UNION SELECT author_id AS id FROM life_group_comments WHERE share_id=$1 AND withdrawn_at IS NULL`
    : `SELECT user_id AS id FROM prayers WHERE id=$1 UNION SELECT user_id AS id FROM prayer_comments WHERE prayer_id=$1`;
  await c.query(`INSERT INTO interaction_notifications(user_id,actor_id,kind,event_key,${family ? 'share_id,family_comment_id' : 'prayer_id,prayer_comment_id'})
    SELECT r.id,$2,$4,$5,$1,$3 FROM (${recipients}) r WHERE r.id<>$2 ON CONFLICT(user_id,event_key) DO NOTHING`,
  [targetId,actor,commentId,family ? 'family_comment' : 'prayer_comment',`${family ? 'family-' : ''}comment/${commentId}`]);
}

// Recheck the source and current membership on every read, including unread counts and email.
export const visibleNotification = `(EXISTS(SELECT 1 FROM prayers p WHERE p.id=n.prayer_id AND (p.user_id=n.user_id OR (p.closed_at IS NULL AND NOT p.is_answered)))
  OR EXISTS(SELECT 1 FROM life_group_shares s JOIN small_groups g ON g.id=s.group_id
    WHERE s.id=n.share_id AND s.withdrawn_at IS NULL AND g.is_active
    AND (g.leader_user_id=n.user_id OR g.pastor_user_id=n.user_id OR EXISTS(
      SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=n.user_id AND m.is_active AND m.history_from<=s.created_at))))
  AND (n.family_comment_id IS NULL OR EXISTS(SELECT 1 FROM life_group_comments c WHERE c.id=n.family_comment_id AND c.share_id=n.share_id AND c.withdrawn_at IS NULL))`;

export async function notificationFeed(actor: string, cursor?: { at: string; id: string }) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshotAt = (await c.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`)).rows[0].at;
    const unreadCount = (await c.query(`SELECT count(*)::int AS count FROM interaction_notifications n WHERE n.user_id=$1 AND n.read_at IS NULL AND ${visibleNotification}`, [actor])).rows[0].count;
    const rows = (await c.query(`SELECT n.id,n.kind,n.created_at AS "createdAt",to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",n.read_at AS "readAt",n.prayer_id,n.share_id,n.prayer_comment_id,n.family_comment_id,s.group_id
      FROM interaction_notifications n LEFT JOIN life_group_shares s ON s.id=n.share_id
      WHERE n.user_id=$1 AND ${visibleNotification} AND ($2::timestamptz IS NULL OR (n.created_at,n.id)<($2::timestamptz,$3::uuid))
      ORDER BY n.created_at DESC,n.id DESC LIMIT 31`, [actor,cursor?.at || null,cursor?.id || null])).rows;
    await c.query('COMMIT');
    const items = rows.slice(0,30).map(n => ({ id:n.id,kind:n.kind as NotificationKind,title:notificationLabels[n.kind as NotificationKind],createdAt:n.createdAt,readAt:n.readAt,
      href:n.prayer_id ? `/prayer-wall?prayer=${n.prayer_id}${n.prayer_comment_id ? `&comment=${n.prayer_comment_id}` : ''}`
        : `/groups/${n.group_id}?share=${n.share_id}${n.family_comment_id ? `&comment=${n.family_comment_id}` : ''}` }));
    const last = rows[29];
    return { items,unreadCount,snapshotAt,nextCursor:rows.length > 30 ? `${last.cursorAt}_${last.id}` : null };
  } catch(e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

export async function markNotificationRead(actor: string, id: string) {
  return !!(await pool.query(`UPDATE interaction_notifications n SET read_at=COALESCE(read_at,now()) WHERE n.id=$1 AND n.user_id=$2 AND ${visibleNotification} RETURNING id`,[id,actor])).rowCount;
}
export async function markNotificationsRead(actor: string, before: string) {
  await pool.query(`UPDATE interaction_notifications n SET read_at=now() WHERE n.user_id=$1 AND read_at IS NULL AND created_at<=$2::timestamptz AND created_at<=now() AND ${visibleNotification}`,[actor,before]);
}
