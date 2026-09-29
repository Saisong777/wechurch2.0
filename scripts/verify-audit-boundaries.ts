import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

export async function verifyAuditBoundaries(pool: Pool, actor: Client, guest: Client, actorId: string, targetId: string) {
  const originalRole = (await pool.query('SELECT role FROM user_roles WHERE user_id=$1', [actorId])).rows[0].role;
  const inboxId = (await pool.query("INSERT INTO inbox_emails(from_email,to_email,body_text) VALUES('audit@example.test','church@example.test','Private fixture') RETURNING id")).rows[0].id;
  const routes: Array<[string, string, unknown?]> = [
    ['/api/admin/inbox', 'GET'], ['/api/admin/inbox/unread-count', 'GET'],
    [`/api/admin/inbox/${inboxId}/read`, 'PATCH', { isRead: true }],
    [`/api/admin/inbox/${inboxId}/archive`, 'PATCH', { isArchived: true }],
    ['/api/admin/users-for-email', 'GET'], ['/api/message-card-downloads', 'GET'],
    [`/api/message-card-downloads/by-card/${randomUUID()}`, 'GET'],
    ['/api/admin/daily-follow-email/send', 'POST', { dryRun: true, userIds: [targetId] }],
    ['/api/send-bulk-email', 'POST', {}], ['/api/send-profile-notification', 'POST', {}],
  ];
  const personId = randomUUID(), assignmentId = randomUUID();
  const email = `private-${randomUUID()}@example.test`;
  try {
    for (const [path, method, body] of routes) assert.equal((await guest(path, method, body)).status, 401, path);
    for (const role of ['member', 'leader', 'group_leader', 'future_leader', 'minister', 'pastor', 'senior_pastor']) {
      await pool.query('UPDATE user_roles SET role=$2 WHERE user_id=$1', [actorId, role]);
      for (const [path, method, body] of routes) {
        if (['pastor', 'senior_pastor'].includes(role) && ['/api/admin/users-for-email', '/api/admin/daily-follow-email/send', '/api/send-bulk-email', '/api/send-profile-notification'].includes(path)) continue;
        assert.equal((await actor(path, method, body)).status, 403, `${role}: ${path}`);
      }
    }
    assert.deepEqual((await pool.query('SELECT is_read,is_archived FROM inbox_emails WHERE id=$1', [inboxId])).rows[0], { is_read: false, is_archived: false });
    await pool.query("UPDATE user_roles SET role='admin' WHERE user_id=$1", [actorId]);
    for (const [path, method, body] of routes.slice(0, 7)) assert.equal((await actor(path, method, body)).status, 200, path);
    await pool.query('INSERT INTO user_email_preferences(user_id,daily_follow_enabled) VALUES($1,false) ON CONFLICT(user_id) DO UPDATE SET daily_follow_enabled=false', [targetId]);
    const skipped = await actor('/api/admin/daily-follow-email/send', 'POST', { userIds: [targetId], dryRun: true });
    assert.equal(skipped.status, 200);
    assert.equal((await skipped.json()).total, 0, 'Explicit selection cannot override opt-out');
    const blockedSend = await actor('/api/admin/daily-follow-email/send', 'POST', { userIds: [targetId], dryRun: false });
    assert.equal(blockedSend.status, 503, 'Disabled mail must not report a successful send');
    assert.equal((await guest('/api/email-provider-status')).status, 401);
    assert.equal((await actor('/api/email-preferences', 'PATCH', { dailyFollowTime: '25:99' })).status, 400);
    await pool.query("UPDATE user_email_preferences SET daily_follow_enabled=true,daily_follow_consent_at=now(),daily_follow_time='00:00',timezone='UTC',last_daily_follow_sent_at=null WHERE user_id=$1", [targetId]);
    const preview = await actor('/api/admin/daily-follow-email/send', 'POST', { userIds: [targetId], dryRun: true });
    assert.equal(preview.status, 200);
    const data = await preview.json(); assert.equal(data.total, 1); assert.equal(data.failed, 0);
    assert.equal('context' in data.previews[0], false, 'Batch receipt must not disclose private activity');

    await pool.query("UPDATE user_roles SET role='leader' WHERE user_id=$1", [actorId]);
    await pool.query('INSERT INTO persons(id,display_name,primary_email,church) VALUES($1,$2,$3,$4)', [personId, 'Privacy fixture', email, 'IM 行動教會']);
    await pool.query("INSERT INTO person_identity_links(person_id,user_id,source_type) VALUES($1,$2,'user')", [personId, targetId]);
    await pool.query("INSERT INTO crm_scope_assignments(id,assignee_user_id,scope_type,member_user_id,can_view_personal) VALUES($1,$2,'member',$3,false)", [assignmentId, actorId, targetId]);
    const { getCrmAccessContext } = await import('../server/crmPermissions');
    const { getPastoralPersons, getPastoralPersonDetail } = await import('../server/pastoralJourneyRepository');
    const accessFor = async () => {
      const access = await getCrmAccessContext(actorId, 'leader');
      access.personalAccess = await getCrmAccessContext(actorId, 'leader', 'personal');
      return access;
    };
    let access = await accessFor();
    assert.equal((await getPastoralPersons(null, { access })).find(p => p.id === personId)?.primaryEmail, null);
    assert.equal((await getPastoralPersons(null, { access, search: email })).length, 0, 'Hidden email must not be searchable');
    assert.equal((await getPastoralPersonDetail(personId, null, { access, canViewPersonal: true }))?.person.primaryEmail, null, 'Broad boolean cannot bypass target scope');
    await pool.query('UPDATE crm_scope_assignments SET can_view_personal=true WHERE id=$1', [assignmentId]);
    access = await accessFor();
    assert.equal((await getPastoralPersons(null, { access, search: email })).find(p => p.id === personId)?.primaryEmail, email);
    assert.equal((await getPastoralPersonDetail(personId, null, { access, canViewPersonal: true }))?.person.primaryEmail, email);
    await pool.query('UPDATE crm_scope_assignments SET is_active=false WHERE id=$1', [assignmentId]);
    access = await accessFor();
    assert.equal(await getPastoralPersonDetail(personId, null, { access, canViewPersonal: true }), null);
  } finally {
    await pool.query('DELETE FROM crm_scope_assignments WHERE id=$1', [assignmentId]);
    await pool.query('DELETE FROM person_identity_links WHERE person_id=$1', [personId]);
    await pool.query('DELETE FROM persons WHERE id=$1', [personId]);
    await pool.query('DELETE FROM inbox_emails WHERE id=$1', [inboxId]);
    await pool.query('DELETE FROM user_email_preferences WHERE user_id=$1', [targetId]);
    await pool.query('UPDATE user_roles SET role=$2 WHERE user_id=$1', [actorId, originalRole]);
  }
  console.log('PASS role-sensitive audit boundaries, guest denial, admin access, opt-out, private-email projection/search and revocation');
}
