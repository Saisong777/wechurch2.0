import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;
export async function verifyEmailPermissions(pool: Pool, makeClient: () => Client) {
  const originalFetch = globalThis.fetch;
  const envKeys = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_REPLY_TO', 'DISABLE_OUTBOUND_EMAIL', 'DAILY_EMAIL_SCHEDULER_ENABLED'];
  const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const sent: Array<{ to: string[]; html: string; text: string }> = [];
  let failProvider = false;
  let intercept: (() => Promise<void>) | undefined;
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      assert.equal(process.env.RESEND_API_KEY, 'isolated-test-only');
      sent.push(JSON.parse(String(init?.body)));
      if (intercept) await intercept();
      if (failProvider) throw new Error('simulated timeout');
      return new Response(JSON.stringify({ id: randomUUID() }), { status: 200 });
    }
    return originalFetch(input, init);
  };
  try {
    Object.assign(process.env, { RESEND_API_KEY: 'isolated-test-only', RESEND_FROM_EMAIL: 'Church <mail@example.test>', RESEND_REPLY_TO: 'reply@example.test', DISABLE_OUTBOUND_EMAIL: '0', DAILY_EMAIL_SCHEDULER_ENABLED: '1' });
    const fixture = async (role: string, church = 'IM 行動教會') => {
      const client = makeClient();
      const email = `email-${randomUUID()}@example.test`;
      assert.equal((await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Email fixture' })).status, 200);
      const id = (await pool.query('UPDATE users SET church=$2 WHERE email=$1 RETURNING id', [email, church])).rows[0].id;
      const changed = await pool.query('UPDATE user_roles SET role=$2 WHERE user_id=$1', [id, role]);
      if (!changed.rowCount) await pool.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id, role]);
      return { client, email, id };
    };
    const admin = await fixture('admin');
    const pastor = await fixture('pastor');
    const member = await fixture('member');
    const outside = await fixture('member', '火樂');
    const careOnly = await fixture('member');
    const senior = await fixture('senior_pastor');
    const guest = makeClient();
    await pool.query("INSERT INTO crm_scope_assignments(assignee_user_id,scope_type,member_user_id,can_manage_members) VALUES($1,'member',$2,true)", [pastor.id, member.id]);
    await pool.query("INSERT INTO crm_scope_assignments(assignee_user_id,scope_type,member_user_id,can_manage_care) VALUES($1,'member',$2,true)", [pastor.id, careOnly.id]);
    const body = (email: string) => ({ requestId: randomUUID(), recipients: [{ email }], subject: 'Fixture', body: 'Fixture', isHtml: false });
    assert.equal((await guest('/api/admin/users-for-email')).status, 401);
    assert.equal((await member.client('/api/admin/users-for-email')).status, 403);
    assert.equal((await member.client('/api/send-bulk-email', 'POST', body(member.email))).status, 403);
    const visibleResponse = await pastor.client('/api/admin/users-for-email');
    assert.equal(visibleResponse.status, 200);
    const visible = await visibleResponse.json();
    assert(visible.some((row: { id: string }) => row.id === member.id));
    assert(!visible.some((row: { id: string }) => [outside.id, careOnly.id].includes(row.id)));
    assert.equal((await pastor.client('/api/send-bulk-email', 'POST', body(outside.email))).status, 403);
    assert.equal((await pastor.client('/api/send-profile-notification', 'POST', { email: careOnly.email, name: 'Other', type: 'notification' })).status, 403);
    const seniorVisible = await (await senior.client('/api/admin/users-for-email')).json();
    assert(!seniorVisible.some((row: { id: string }) => row.id === outside.id));
    assert.equal((await pastor.client('/api/send-bulk-email', 'POST', body(member.email))).status, 200);
    assert.equal((await admin.client('/api/send-bulk-email', 'POST', body(member.email))).status, 200);
    assert.equal((await member.client('/api/daily-follow-email/send-test', 'POST', { userId: outside.id, email: outside.email })).status, 200);
    assert.deepEqual(sent.at(-1)!.to, [member.email]);
    assert(sent.at(-1)!.text.includes('/me'));
    assert(!sent.at(-1)!.text.includes('Fixture private'));
    assert.equal((await pool.query('SELECT * FROM user_email_preferences WHERE user_id=$1', [member.id])).rowCount, 0);
    const prefs = await member.client('/api/email-preferences', 'PATCH', { dailyFollowEnabled: true, dailyFollowTime: '00:00', timezone: 'Asia/Taipei', userId: outside.id });
    assert.equal(prefs.status, 200);
    assert((await prefs.json()).dailyFollowConsentAt);
    assert.equal((await pool.query('SELECT * FROM user_email_preferences WHERE user_id=$1', [outside.id])).rowCount, 0);
    const { runDailyReminders } = await import('../server/emailReminders');
    const before = sent.length;
    const concurrent = await Promise.all([runDailyReminders({ userIds: [member.id], dryRun: false }), runDailyReminders({ userIds: [member.id], dryRun: false })]);
    assert.equal(concurrent.reduce((sum, row) => sum + row.sent, 0), 1);
    assert.equal(sent.length, before + 1);
    assert.equal((await runDailyReminders({ userIds: [member.id], dryRun: false })).total, 0);
    assert.equal((await member.client('/api/email-preferences', 'PATCH', { dailyFollowEnabled: false })).status, 200);
    const tomorrow = new Date(Date.now() + 86_400_000);
    assert.equal((await runDailyReminders({ userIds: [member.id], dryRun: false, now: tomorrow })).total, 0);
    // Old preview-only subscriptions must not become real mail after rollout.
    await pool.query("INSERT INTO user_email_preferences(user_id,daily_follow_enabled,daily_follow_time) VALUES($1,true,'00:00')", [outside.id]);
    assert.equal((await runDailyReminders({ userIds: [outside.id], dryRun: false })).total, 0);
    await pool.query('UPDATE user_email_preferences SET daily_follow_enabled=true,daily_follow_consent_at=now() WHERE user_id=$1', [member.id]);
    failProvider = true;
    const failure = await runDailyReminders({ userIds: [member.id], dryRun: false, now: tomorrow });
    assert.equal(failure.failed, 1);
    failProvider = false;
    assert.equal((await runDailyReminders({ userIds: [member.id], dryRun: false, now: tomorrow })).total, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM email_reminder_deliveries WHERE user_id=$1 AND status='unconfirmed'", [member.id])).rows[0].count, 1);
    // Revocation while another user is being sent must be honored before claim.
    await pool.query('UPDATE user_email_preferences SET daily_follow_consent_at=now() WHERE user_id=$1', [outside.id]);
    intercept = async () => { await pool.query('UPDATE user_email_preferences SET daily_follow_enabled=false WHERE user_id=$1', [outside.id]); };
    await runDailyReminders({ userIds: [member.id], dryRun: false, now: new Date(Date.now() + 2 * 86_400_000) });
    intercept = undefined;
    assert.equal((await runDailyReminders({ userIds: [outside.id], dryRun: false })).total, 0);
    process.env.DISABLE_OUTBOUND_EMAIL = '1';
    assert.equal((await senior.client('/api/send-bulk-email', 'POST', body(member.email))).status, 503);
    await assert.rejects(runDailyReminders({ dryRun: false }), /EMAIL_REMINDERS_DISABLED/);
    console.log('PASS email staff scopes, member/self isolation, consent, concurrent claims, opt-out and uncertain-send protection (mock provider only)');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
  }
}
