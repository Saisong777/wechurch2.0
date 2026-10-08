import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

type Client = (path: string, method?: string, body?: unknown) => Promise<Response>;

// Only synthetic fixtures in the integrity runner's new disposable localhost database.
export async function verifyPrivateReadingTemplatesHttp(pool: Pool, makeClient: () => Client) {
  const url = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name, /^wechurch_integrity_[a-f0-9]{32}$/);
  const church = 'IM 行動教會', foreignChurch = '桃園WeChurch';
  const register = async (affiliation: string | null, admin = false) => {
    const client = makeClient(), email = `private-template-${randomUUID()}@example.test`;
    const response = await client('/api/auth/register', 'POST', { email, password: randomUUID(), displayName: 'Synthetic reading fixture' });
    assert.equal(response.status, 200);
    const id = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id as string;
    await pool.query('UPDATE users SET church=$2,church_choice_locked=true,church_choice_none=$3 WHERE id=$1', [id, affiliation, affiliation === null]);
    if (admin) await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [id]);
    return { id, client };
  };
  const owner = await register(church), other = await register(church), admin = await register(church, true);
  const outsider = await register(foreignChurch), pending = await register(null), guest = makeClient();
  const custom = async (client: Client) => {
    const response = await client('/api/user-reading-plans', 'POST', {
      name: 'Synthetic private plan', description: 'SYNTHETIC_PRIVATE_DESCRIPTION', startDate: '2038-03-17',
      bookSelections: [{ bookName: '詩篇', chapterStart: 1, chapterEnd: 2 }], chaptersPerDay: 1,
    });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json() as Promise<{ id: string; templateId: string }>;
  };
  const privatePlan = await custom(owner.client), adminPlan = await custom(admin.client), nullChurchPlan = await custom(pending.client);
  const seed = async (affiliation: string, isPublic: boolean, creator: string | null) => {
    const id = (await pool.query(`INSERT INTO reading_plan_templates(name,description,duration_days,is_public,created_by,church)
      VALUES('Synthetic catalog template','Synthetic fixture description',1,$1,$2,$3) RETURNING id`, [isPublic, creator, affiliation])).rows[0].id as string;
    await pool.query("INSERT INTO reading_plan_template_items(template_id,day_number,scripture_reference,notes) VALUES($1,1,'詩篇 23','SYNTHETIC_TEMPLATE_ITEM')", [id]);
    return id;
  };
  const publicId = await seed(church, true, null), orphanPrivateId = await seed(church, false, null);
  const foreignPublicId = await seed(foreignChurch, true, null), foreignOwnPrivateId = await seed(foreignChurch, false, owner.id);
  const catalog = async (client: Client, visible: string[], hidden: string[], suffix = '') => {
    const list = await client(`/api/reading-plans${suffix}`);
    assert.equal(list.status, 200);
    const ids = (await list.json() as { id: string }[]).map(t => t.id);
    for (const id of visible) assert(ids.includes(id), `catalog must include accessible template ${id}`);
    for (const id of hidden) assert(!ids.includes(id), `catalog must hide inaccessible template ${id}`);
    for (const id of visible) {
      const detail = await client(`/api/reading-plans/${id}${suffix}`);
      assert.equal(detail.status, 200); assert.equal((await detail.json()).id, id);
      const items = await client(`/api/reading-plans/${id}/items${suffix}`);
      assert.equal(items.status, 200); assert((await items.json()).length > 0);
    }
    for (const id of hidden) {
      assert.equal((await client(`/api/reading-plans/${id}${suffix}`)).status, 404, 'inaccessible detail retains 404');
      const items = await client(`/api/reading-plans/${id}/items${suffix}`);
      assert.equal(items.status, 200); assert.deepEqual(await items.json(), [], 'inaccessible items retain empty-array contract');
    }
  };
  const sameChurchHidden = [privatePlan.templateId, adminPlan.templateId, orphanPrivateId, nullChurchPlan.templateId, foreignPublicId, foreignOwnPrivateId];
  await catalog(other.client, [publicId], sameChurchHidden);
  await catalog(admin.client, [publicId, adminPlan.templateId], sameChurchHidden.filter(id => id !== adminPlan.templateId));
  await catalog(owner.client, [publicId, privatePlan.templateId], sameChurchHidden.filter(id => id !== privatePlan.templateId));
  await catalog(outsider.client, [foreignPublicId], [publicId, privatePlan.templateId, adminPlan.templateId, orphanPrivateId, foreignOwnPrivateId, nullChurchPlan.templateId]);
  await catalog(admin.client, [foreignPublicId], [publicId, privatePlan.templateId, adminPlan.templateId, foreignOwnPrivateId], `?church=${encodeURIComponent(foreignChurch)}`);
  // Client identity/role fields cannot substitute for the verified request actor.
  await catalog(other.client, [publicId], [privatePlan.templateId], `?userId=${owner.id}&createdBy=${owner.id}&role=admin`);
  assert.equal((await other.client(`/api/reading-plans?church=${encodeURIComponent(foreignChurch)}`)).status, 403);
  assert.equal((await other.client('/api/user-reading-plans', 'POST', { name: 'Synthetic forbidden adoption', startDate: '2038-03-17', templateId: privatePlan.templateId })).status, 404);
  const subscribed = await other.client('/api/user-reading-plans', 'POST', { name: 'Synthetic public adoption', startDate: '2038-03-17', templateId: publicId });
  assert.equal(subscribed.status, 201);
  console.log('PASS private reading templates: list/detail/items owner and public controls, same-church member/admin rejection, cross-church and spoofed identity rejection');

  for (const path of ['/api/reading-plans', `/api/reading-plans/${publicId}`, `/api/reading-plans/${publicId}/items`]) {
    assert.equal((await guest(path)).status, 401);
    assert.equal((await pending.client(path)).status, 403);
  }
  const { storage } = await import('../server/storage');
  const { runChurchContext } = await import('../server/churchContext');
  await assert.rejects(storage.getReadingPlanTemplates(), (e: { status?: number }) => e.status === 403);
  await assert.rejects(storage.getReadingPlanTemplate(publicId), (e: { status?: number }) => e.status === 403);
  await assert.rejects(storage.getReadingPlanItems(publicId), (e: { status?: number }) => e.status === 403);
  await runChurchContext({ actorId: '', actorChurch: church, selectedChurch: church, isSystemAdmin: true }, async () => {
    assert.deepEqual(await storage.getReadingPlanTemplates(), [], 'missing actor fails closed even for public content');
    assert.equal(await storage.getReadingPlanTemplate(publicId), undefined);
    assert.deepEqual(await storage.getReadingPlanItems(publicId), []);
  });
  const nullHistory = await pending.client(`/api/user-reading-plans/${nullChurchPlan.id}/items`);
  assert.equal(nullHistory.status, 200); assert.equal((await nullHistory.json()).length, 2);
  await pool.query('UPDATE users SET church=$2 WHERE id=$1', [owner.id, foreignChurch]);
  await catalog(owner.client, [foreignPublicId, foreignOwnPrivateId], [publicId, privatePlan.templateId]);
  const history = await owner.client(`/api/user-reading-plans/${privatePlan.id}/items`);
  assert.equal(history.status, 200); assert.equal((await history.json()).length, 2, 'owned historical plan survives church move');
  assert.equal((await outsider.client(`/api/user-reading-plans/${privatePlan.id}/items`)).status, 404);
  assert((await storage.getOwnedReadingTemplate(privatePlan.templateId, owner.id))?.id === privatePlan.templateId);
  console.log('PASS private reading templates: anonymous/no-context/missing-actor fail closed, null-church personal history and owner history after church move retained');
}
