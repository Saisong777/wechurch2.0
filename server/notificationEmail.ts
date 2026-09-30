import { pool } from './db';
import { emailAppUrl, emailProviderStatus, escapeEmailHtml } from './emailPolicy';
import { sendEmail } from './resend';
import { visibleNotification } from './notificationRepository';

export function buildInteractionEmail() {
  const url = emailAppUrl('/notifications');
  const settings = emailAppUrl('/notifications#email-settings');
  return {
    subject:'WeChurch｜有人回應你了',
    text:`有人為你禱告、留下鼓勵，或回應你的小家分享。\n\n查看通知：${url}\n\n關閉 Email 通知：${settings}`,
    html:`<p>有人為你禱告、留下鼓勵，或回應你的小家分享。</p><p><a href="${escapeEmailHtml(url)}">查看通知</a></p><p><a href="${escapeEmailHtml(settings)}">關閉 Email 通知</a></p>`,
  };
}

export async function runInteractionEmails(options: { dryRun?: boolean; userIds?: string[]; now?: Date; stopped?: () => boolean; send?: typeof sendEmail } = {}) {
  const dryRun = options.dryRun !== false;
  if (!dryRun && !emailProviderStatus().interactionNotificationsEnabled) throw new Error('INTERACTION_EMAIL_DISABLED');
  const now = options.now || new Date();
  const hour = new Date(Math.floor(now.getTime()/3_600_000)*3_600_000).toISOString();
  const users = (await pool.query(`SELECT p.user_id FROM user_email_preferences p
    WHERE p.interaction_email_enabled AND p.interaction_email_consent_at IS NOT NULL
    AND ($1::uuid[] IS NULL OR p.user_id=ANY($1::uuid[]))
    AND NOT EXISTS(SELECT 1 FROM interaction_email_deliveries d WHERE d.user_id=p.user_id AND d.batch_hour=$2)
    AND EXISTS(SELECT 1 FROM interaction_notifications n WHERE n.user_id=p.user_id AND n.read_at IS NULL AND n.email_claimed_at IS NULL
      AND n.created_at>=p.interaction_email_consent_at AND n.created_at<=$3::timestamptz-interval '5 minutes' AND ${visibleNotification})
    ORDER BY p.user_id LIMIT 50`,[options.userIds || null,hour,now])).rows;
  const result = {eligible:users.length,accepted:0,unconfirmed:0,skipped:0,dryRun};
  if (dryRun) return result;
  for (const [index,u] of users.entries()) {
    if (options.stopped?.() || !emailProviderStatus().interactionNotificationsEnabled) break;
    if (index) await new Promise(resolve => setTimeout(resolve,650));
    const c = await pool.connect();
    let claim: {email:string;consent:string;ids:string[]} | undefined;
    try {
      await c.query('BEGIN');
      const p = (await c.query(`SELECT u.email,p.interaction_email_consent_at::text AS consent FROM user_email_preferences p JOIN users u ON u.id=p.user_id
        WHERE p.user_id=$1 AND p.interaction_email_enabled AND p.interaction_email_consent_at IS NOT NULL FOR UPDATE OF p SKIP LOCKED`,[u.user_id])).rows[0];
      if (p) {
        const ids = (await c.query(`SELECT n.id FROM interaction_notifications n WHERE n.user_id=$1 AND n.read_at IS NULL AND n.email_claimed_at IS NULL
          AND n.created_at>=$2::timestamptz AND n.created_at<=$3::timestamptz-interval '5 minutes' AND ${visibleNotification}
          ORDER BY n.created_at LIMIT 500 FOR UPDATE OF n`,[u.user_id,p.consent,now])).rows.map(n => n.id);
        if (ids.length && (await c.query(`INSERT INTO interaction_email_deliveries(user_id,batch_hour,status) VALUES($1,$2,'claimed') ON CONFLICT DO NOTHING RETURNING user_id`,[u.user_id,hour])).rowCount) {
          await c.query('UPDATE interaction_notifications SET email_claimed_at=$2 WHERE id=ANY($1::uuid[])',[ids,now]);
          claim = {email:p.email,consent:p.consent,ids};
        }
      }
      await c.query('COMMIT');
    } catch(e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }
    if (!claim) continue;
    // Recheck consent and visibility immediately before handing off a generic unread digest.
    const current = (await pool.query(`SELECT 1 FROM user_email_preferences p JOIN users u ON u.id=p.user_id
      WHERE p.user_id=$1 AND p.interaction_email_enabled AND p.interaction_email_consent_at=$2::timestamptz AND u.email=$3
      AND EXISTS(SELECT 1 FROM interaction_notifications n WHERE n.user_id=p.user_id AND n.id=ANY($4::uuid[]) AND n.read_at IS NULL AND ${visibleNotification})`,[u.user_id,claim.consent,claim.email,claim.ids])).rowCount;
    if (!current || options.stopped?.() || !emailProviderStatus().interactionNotificationsEnabled) {
      await pool.query("UPDATE interaction_email_deliveries SET status='skipped' WHERE user_id=$1 AND batch_hour=$2",[u.user_id,hour]); result.skipped++; continue;
    }
    try {
      await (options.send || sendEmail)({purpose:'self',to:claim.email,...buildInteractionEmail(),idempotencyKey:`interaction/${u.user_id}/${hour.replace(/[:]/g,'-')}`});
      await pool.query("UPDATE interaction_email_deliveries SET status='accepted' WHERE user_id=$1 AND batch_hour=$2",[u.user_id,hour]); result.accepted++;
    } catch {
      // Timeout can mean acceptance; retain the receipt and never automatically resend this batch.
      await pool.query("UPDATE interaction_email_deliveries SET status='unconfirmed' WHERE user_id=$1 AND batch_hour=$2",[u.user_id,hour]); result.unconfirmed++;
    }
  }
  return result;
}
