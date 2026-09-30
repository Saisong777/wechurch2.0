import { pool } from './db';
import { dailyEmailDue, emailAppUrl, emailProviderStatus, escapeEmailHtml } from './emailPolicy';
import { sendEmail } from './resend';
import { runInteractionEmails } from './notificationEmail';

export function buildSelfReminder() {
  const home = emailAppUrl('/');
  const settings = emailAppUrl('/me');
  const subject = 'WeChurch 每日提醒';
  const text = `為今天留一點時間，讀經、禱告，也關心身邊的人。\n\n回到 WeChurch：${home}\n\n這是你開啟的個人提醒，只寄到你的帳號信箱。\n更改時間或關閉提醒：${settings}`;
  const html = `<h1>${subject}</h1><p>為今天留一點時間，讀經、禱告，也關心身邊的人。</p><p><a href="${escapeEmailHtml(home)}">回到 WeChurch</a></p><p>這是你開啟的個人提醒，只寄到你的帳號信箱。</p><p><a href="${escapeEmailHtml(settings)}">更改時間或關閉提醒</a></p>`;
  return { subject, text, html };
}

type Preference = {
  userId: string; email: string; dailyFollowEnabled: boolean; dailyFollowConsentAt: string | null;
  dailyFollowTime: string; timezone: string; lastDailyFollowSentAt: Date | null;
};
const localDay = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export async function runDailyReminders(options: {
  userIds?: string[]; dryRun?: boolean; limit?: number; now?: Date; stopped?: () => boolean;
} = {}) {
  const now = options.now || new Date();
  const dryRun = options.dryRun ?? true;
  if (!dryRun && !emailProviderStatus().remindersEnabled) throw new Error('EMAIL_REMINDERS_DISABLED');
  const result = { dryRun, total: 0, sent: 0, failed: 0, previews: [] as Array<{ userId: string; email: string; subject: string }>, errors: [] as string[] };
  const preferences = await pool.query<Preference>(`SELECT p.user_id AS "userId", u.email,
    p.daily_follow_enabled AS "dailyFollowEnabled", p.daily_follow_consent_at::text AS "dailyFollowConsentAt",
    p.daily_follow_time AS "dailyFollowTime", p.timezone, p.last_daily_follow_sent_at AS "lastDailyFollowSentAt"
    FROM user_email_preferences p JOIN users u ON u.id=p.user_id
    WHERE p.daily_follow_enabled AND p.daily_follow_consent_at IS NOT NULL
      AND ($1::uuid[] IS NULL OR u.id=ANY($1::uuid[]))
    ORDER BY p.last_daily_follow_sent_at NULLS FIRST, p.user_id`, [options.userIds ?? null]);
  for (const preference of preferences.rows) {
    if (options.stopped?.() || result.total >= Math.min(options.limit ?? 50, 500)) break;
    if (!dailyEmailDue(preference, now)) continue;
    const day = localDay(now, preference.timezone);
    if ((await pool.query('SELECT 1 FROM email_reminder_deliveries WHERE user_id=$1 AND local_day=$2', [preference.userId, day])).rowCount) continue;
    if (dryRun) {
      result.total++;
      result.previews.push({ userId: preference.userId, email: preference.email, subject: buildSelfReminder().subject });
      continue;
    }
    // Atomic claim shared by every replica, manual trigger and scheduler. A timeout
    // stays unconfirmed, never blindly retried or reported as delivered.
    const claim = await pool.query(`INSERT INTO email_reminder_deliveries(user_id,local_day,status)
      SELECT p.user_id,$2,'claimed' FROM user_email_preferences p
      WHERE p.user_id=$1 AND p.daily_follow_enabled AND p.daily_follow_consent_at IS NOT NULL
        AND p.daily_follow_time=$3 AND p.timezone=$4
        AND p.daily_follow_consent_at=$5
      ON CONFLICT DO NOTHING RETURNING user_id`, [preference.userId, day, preference.dailyFollowTime, preference.timezone, preference.dailyFollowConsentAt]);
    if (!claim.rowCount) continue;
    result.total++;
    try {
      // Recheck opt-out and address immediately before handing off to the provider.
      const current = await pool.query(`SELECT u.email FROM users u JOIN user_email_preferences p ON p.user_id=u.id
        WHERE u.id=$1 AND p.daily_follow_enabled AND p.daily_follow_consent_at=$2`, [preference.userId, preference.dailyFollowConsentAt]);
      if (!current.rowCount) continue;
      const accepted = await sendEmail({ purpose: 'self', to: current.rows[0].email,
        ...buildSelfReminder(), idempotencyKey: `reminder/${preference.userId}/${day}` });
      await pool.query("UPDATE email_reminder_deliveries SET status='accepted',provider_id=$3,updated_at=now() WHERE user_id=$1 AND local_day=$2", [preference.userId, day, accepted.data.id]);
      await pool.query('UPDATE user_email_preferences SET last_daily_follow_sent_at=$2 WHERE user_id=$1', [preference.userId, now]);
      result.sent++;
    } catch {
      await pool.query("UPDATE email_reminder_deliveries SET status='unconfirmed',updated_at=now() WHERE user_id=$1 AND local_day=$2 AND status='claimed'", [preference.userId, day]);
      result.failed++;
      result.errors.push('一封提醒未確認送出，已保留紀錄，不自動重寄。');
    }
    await new Promise(resolve => setTimeout(resolve, 650));
  }
  return result;
}

export function startEmailReminderScheduler() {
  let stopped = false;
  let running: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (stopped || running || (!emailProviderStatus().remindersEnabled && !emailProviderStatus().interactionNotificationsEnabled)) return;
    running = (async () => {
      if (emailProviderStatus().remindersEnabled) {
        try {
          const result = await runDailyReminders({dryRun:false,stopped:() => stopped});
          if (result.total) console.info('[Email reminders]',JSON.stringify({accepted:result.sent,unconfirmed:result.failed}));
        } catch { console.error('[Email reminders] cycle failed'); }
      }
      if (!stopped && emailProviderStatus().interactionNotificationsEnabled) {
        const result = await runInteractionEmails({dryRun:false,stopped:() => stopped});
        if (result.eligible) console.info('[Interaction email]',JSON.stringify({accepted:result.accepted,unconfirmed:result.unconfirmed}));
      }
    })()
      .catch(() => console.error('[Email reminders] cycle failed'))
      .finally(() => { running = undefined; });
  }, 60_000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
