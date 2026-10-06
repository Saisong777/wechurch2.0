import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { insertSessionSchema } from '../shared/schema';
import { normalizeChurch, getChurchAliases } from '../server/churches';
import { mayManageStudySession } from '../server/studySessionPolicy';

// Extract the actual handlers without importing routes/storage or opening a database connection.
function source(file: string) {
  return ts.createSourceFile(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
}
const routes = source('server/routes.ts');
const storageSource = source('server/storage.ts');
const crmSource = source('server/crmPermissions.ts');
function find(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  const walk = (node: ts.Node) => { if (predicate(node)) found = node; else ts.forEachChild(node, walk); };
  walk(root);
  assert.ok(found, 'Expected production source node');
  return found;
}
function compile(text: string, bindings: Record<string, unknown> = {}) {
  const js = ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return runInNewContext(js, { z, insertSessionSchema, normalizeChurch, mayManageStudySession, console, ...bindings });
}
function helper(name: string, bindings: Record<string, unknown> = {}) {
  const node = find(routes, n => ts.isVariableDeclaration(n) && n.name.getText(routes) === name) as ts.VariableDeclaration;
  return compile(node.initializer!.getText(routes), bindings);
}
function route(method: string, path: string) {
  return find(routes, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
    n.expression.expression.getText(routes) === 'app' && n.expression.name.text === method &&
    ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === path) as ts.CallExpression;
}
function handler(method: string, path: string, bindings: Record<string, unknown>) {
  return compile(route(method, path).arguments.at(-1)!.getText(routes), bindings);
}
function method(name: string, bindings: Record<string, unknown>) {
  const node = find(storageSource, n => ts.isMethodDeclaration(n) && n.name.getText(storageSource) === name) as ts.MethodDeclaration;
  return compile(`async function(${node.parameters.map(p => p.getText(storageSource)).join(',')}) ${node.body!.getText(storageSource)}`, bindings);
}
function crmFunction(name: string, bindings: Record<string, unknown>) {
  const node = find(crmSource, n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration;
  return compile(node.getText(crmSource).replace(/^export /, ''), bindings);
}
const churchMatches = crmFunction('churchMatches', { getChurchAliases, normalizeChurch });
const actorId = '00000000-0000-4000-8000-000000000001';
const ownId = '00000000-0000-4000-8000-000000000002';
const foreignId = '00000000-0000-4000-8000-000000000003';
const otherId = '00000000-0000-4000-8000-000000000004';
const responseId = '00000000-0000-4000-8000-000000000005';
function response() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

export async function runSecurityAccessRegressions() {
  let role = 'leader';
  let selected = 'IM 行動教會';
  const churchContext = () => ({actorId,actorChurch:normalizeChurch(actor.church),selectedChurch:selected,isSystemAdmin:role==='admin'});
  const selectedChurch=()=>selected;
  const filterUsersForCrmAccess = crmFunction('filterUsersForCrmAccess', { churchMatches, churchContext, normalizeChurch });
  const actor = { id: actorId, church: 'IM', email: 'actor@example.test' };
  const target = { id: otherId, church: 'IM', email: 'other@example.test', displayName: 'Other', password: 'TEST_HASH', birthday: '2000-01-01', userGender: 'other', address: 'PRIVATE' };
  const sessions = new Map([
    [ownId, { ownerId: actorId, church: 'IM 行動教會', churchUnit: 'IM 行動教會' }],
    [foreignId, { ownerId: actorId, church: '火樂', churchUnit: '火樂' }],
  ]);
  const deletes: string[] = [];
  const writes: any[] = [];
  const storage = {
    getUserRole: async () => role,
    getUser: async (id: string) => id === actorId ? actor : id === otherId ? target : undefined,
    getSession: async (id: string) => sessions.get(id),
    getParticipant: async () => ({ sessionId: foreignId }),
    getStudyResponseWithOwner: async () => ({ id: responseId, sessionId: foreignId }),
    deleteStudyResponse: async (id: string) => deletes.push(id),
    deleteSession: async (id: string) => deletes.push(id),
    updateUser: async (_id: string, data: any) => { writes.push(data); return data; },
    updateSession: async (_id: string, data: any) => { writes.push(data); return data; },
    createSession: async (data: any) => { writes.push(data); return data; },
    getUsers: async () => [target],
    upsertPotentialMember: async (data: any) => { writes.push(data); return undefined; },
  };
  const canManageSession = helper('canManageSession', { churchContext, storage, getRequestRole: async () => role,
    resolveUserId: async () => actorId, sessionManagerRoles: ['admin', 'leader'],
    pool: { query: async () => ({ rows: [{ session_id: foreignId }] }) },
  });
  const req = (id: string) => ({ path: `/api/sessions/${id}`, params: { id }, query: { sessionId: ownId } });
  assert.equal(await canManageSession(req(foreignId)), false, 'query cannot override foreign path, even for an owner');
  assert.equal(await canManageSession(req(ownId)), true, 'legitimate owner still allowed');
  assert.equal(await canManageSession({ ...req(ownId), path: '/api/participants/p' }), false, 'participant association wins over query');
  assert.equal(await canManageSession({ ...req(ownId), path: '/api/reports/r' }), false, 'report association wins over query');
  assert.equal(await canManageSession(req(ownId), foreignId), false, 'explicit database association wins');
  assert.equal(await canManageSession({ params: { id: foreignId }, path: '/unknown', query: { sessionId: ownId } }), false);
  const church = actor.church;
  actor.church = '火樂';
  assert.equal(await canManageSession(req(ownId)), false, 'cross-church management denied');
  actor.church = church;
  role = 'admin'; selected='火樂';
  assert.equal(await canManageSession(req(foreignId)), true);
  selected='IM 行動教會';
  role = 'leader';
  assert.equal(route('delete', '/api/sessions/:id').arguments[1].getText(routes), 'requireSessionManager');
  const common = { storage, canManageSession, churchContext, selectedChurch, resolveUserId:async()=>actorId, approveChurchAffiliation:async (_actor:string,_target:string,updates:any)=>{const {expectedChurch,...data}=updates;writes.push(data);return data;}, GroupError:Error, sessionCache: { invalidate() {} } };
  let res = response();
  await handler('delete', '/api/study-responses/:id', common)({ ...req(responseId), path: `/api/study-responses/${responseId}` }, res);
  assert.equal(res.statusCode, 403); assert.equal(deletes.length, 0);
  storage.getStudyResponseWithOwner = async () => ({ id: responseId, sessionId: ownId });
  res = response();
  await handler('delete', '/api/study-responses/:id', common)(req(responseId), res);
  assert.deepEqual(deletes, [responseId]);

  const baseAccess = { role: 'leader', canEnterCrm: true, canViewPersonal: false, canManageMembers: false, churchScopes: [], userIds: [otherId], memberEmails: [] };
  let access = { ...baseAccess };
  const guard = helper('requireSelfOrRole', { hasPermission:async()=>false, storage, resolveUserId: async () => actorId,
    getCrmAccessForRequest: async (_req: unknown, capability: string) => { assert.ok(['personal', 'members'].includes(capability)); return access; }, filterUsersForCrmAccess,
  })('id', 'leader', 'admin');
  let allowed = 0;
  res = response();
  await guard({ method: 'GET', params: { id: otherId } }, res, () => allowed++);
  assert.equal(res.statusCode, 403); assert.equal(allowed, 0);
  access = { ...baseAccess, canViewPersonal: true, userIds: [] };
  res = response(); await guard({ method: 'GET', params: { id: otherId } }, res, () => allowed++);
  assert.equal(res.statusCode, 403, 'capability without target scope denied');
  access.userIds = [otherId];
  await guard({ method: 'GET', params: { id: otherId } }, response(), () => allowed++);
  assert.equal(allowed, 1);
  res = response(); await guard({ method: 'PATCH', params: { id: otherId } }, res, () => allowed++);
  assert.equal(res.statusCode, 403, 'personal viewing does not grant member editing');
  access.canManageMembers = true;
  await guard({ method: 'PATCH', params: { id: otherId } }, response(), () => allowed++);
  assert.equal(allowed, 2);
  role = 'member';
  const self: any = { method: 'PATCH', params: { id: actorId }, body: { church: '火樂' } };
  await guard(self, response(), () => allowed++);
  assert.equal(allowed, 3, 'self may edit ordinary fields');
  res = response(); await handler('patch', '/api/users/:id/profile', common)(self, res);
  assert.equal(res.statusCode, 403); assert.equal(writes.length, 0, 'self church escalation denied');
  self.body = { displayName: ' Changed ' };
  res = response(); await handler('patch', '/api/users/:id/profile', common)(self, res);
  assert.deepEqual(plain(writes.pop()), { displayName: 'Changed' }, 'omitted fields stay omitted');
  self.body = { church: '火樂', expectedChurch:'IM 行動教會' }; self.userRole = 'admin';
  await handler('patch', '/api/users/:id/profile', common)(self, response());
  assert.deepEqual(plain(writes.pop()), { church: '火樂' });
  const list = handler('get', '/api/users', { ...common, getCrmChurchFilter: async () => selected,
    memberRoleNames: async () => new Map(),
    getCrmAccessForRequest: async () => ({ ...baseAccess, personalAccess: access }), filterUsersForCrmAccess,
    sanitizeUserRecord: helperSanitizer(),
  });
  access = { ...baseAccess, canViewPersonal: true, userIds: [] };
  res = response(); await list({}, res);
  for (const field of ['password', 'email', 'birthday', 'userGender', 'address']) assert.equal(field in res.body[0], false);
  access.userIds = [otherId];
  res = response(); await list({}, res);
  assert.equal(res.body[0].address, target.address); assert.equal('password' in res.body[0], false);

  role = 'leader';
  const create = handler('post', '/api/sessions', common);
  const creator = { legacyUserId: actorId, userRole: role, body: { verseReference: 'Test', churchUnit: '火樂' } };
  res = response(); await create(creator, res); assert.equal(res.statusCode, 201,'churchUnit is an internal unit, not tenant selector'); assert.equal(writes.pop().church,selected);
  creator.body = { verseReference: 'Test', churchUnit: 'IM' };
  await create(creator, response());
  assert.equal(writes.at(-1).ownerId, actorId); assert.equal(writes.pop().churchUnit, 'IM');
  res = response(); await create({ ...creator, body: { verseReference: 'Test', ownerId: otherId } }, res); assert.equal(res.statusCode, 403);
  const patch = handler('patch', '/api/sessions/:id', common);
  for (const body of [{ ownerId: otherId }, { churchUnit: '火樂' }]) {
    res = response(); await patch({ ...req(ownId), userRole: 'leader', body }, res); assert.equal(res.statusCode, 403);
  }
  await patch({ ...req(ownId), userRole: 'leader', body: { status: 'studying' } }, response());
  assert.deepEqual(plain(writes.pop()), { status: 'studying' });
  const intake = handler('post', '/api/potential-members', common);
  res = response(); await intake({ body: { email: 'test@example.test', name: 'Test', status: 'member' } }, res); assert.equal(res.statusCode, 400);
  res = response(); await intake({ body: { email: 'test@example.test', name: 'Test' } }, res);
  assert.deepEqual(plain(res.body), { success: true }); writes.length = 0;

  const rows: any[] = [{ id: 'existing', email: ' Known@Example.Test ', name: 'Original', church: 'IM', status: 'member' }];
  const original = JSON.stringify(rows);
  const statements: string[] = [];
  let queued = Promise.resolve();
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join('?'), values });
  const table = { id: 'id', email: 'email' };
  const upsert = method('upsertPotentialMember', { normalizeChurch, potentialMembers: table, sql, db: {
    transaction: async (run: any) => {
      let release!: () => void;
      const previous = queued; queued = new Promise<void>(resolve => { release = resolve; });
      let email = '';
      try { return await run({
        execute: async (query: any) => { assert.match(query.text, /pg_advisory_xact_lock/); assert.match(query.values[0], /^potential-member:/); await previous; statements.push('lock'); },
        select: () => ({ from: () => ({ where: (query: any) => {
          assert.match(query.text, /lower\(trim\(/); email = query.values.at(-1);
          return { limit: async () => { statements.push('select'); return rows.filter(row => row.email.trim().toLowerCase() === email).map(row => ({ id: row.id })); } };
        } }) }),
        insert: () => ({ values: (data: any) => ({ onConflictDoNothing: async () => { statements.push('insert'); rows.push(data); } }) }),
      }); } finally { release(); }
    },
  } });
  assert.equal(await upsert({ email: 'known@example.test', name: 'Overwrite', church: '火樂' }), undefined);
  assert.equal(JSON.stringify(rows), original, 'duplicate intake never modifies the existing row');
  await Promise.all([upsert({ email: ' New@Example.Test ', name: 'New', status: 'member', userId: otherId }), upsert({ email: 'new@example.test', name: 'Overwrite' })]);
  assert.equal(rows.length, 2); assert.equal(rows[1].email, 'new@example.test'); assert.equal(rows[1].name, 'New');
  assert.equal('status' in rows[1], false); assert.equal('userId' in rows[1], false);
  assert.deepEqual(statements, ['lock', 'select', 'lock', 'select', 'insert', 'lock', 'select']);

  let committed: string[] = []; let fail = true;
  const deleteSession = method('deleteSession', {lockDrizzleChurchContext:async()=>{},selectedChurch:()=>selected,sql:(strings:TemplateStringsArray,...values:unknown[])=>({text:strings.join('?'),values}),and:(...args:any[])=>args,eq: (...args: any[]) => args, inArray: (...args: any[]) => args,
    ...Object.fromEntries(['sessions', 'participants', 'studyResponses', 'submissions', 'aiReports', 'icebreakerGames', 'icebreakerPlayers'].map(name => [name, { name }])),
    db: { transaction: async (run: any) => {
      const pending: string[] = [];
      await run({ execute:async()=>({rowCount:1}),select: () => ({ from: () => ({ where: async () => [{ id: 'game' }] }) }),
        delete: (table: any) => ({ where: async () => { pending.push(table.name); if (fail && table.name === 'sessions') throw new Error('FK failure'); } }),
      }); committed = pending;
    } },
  });
  await assert.rejects(deleteSession(ownId), /FK failure/); assert.deepEqual(committed, [], 'late failure cannot commit partial deletes');
  fail = false; await deleteSession(ownId);
  assert.deepEqual(committed, ['icebreakerPlayers', 'icebreakerGames', 'aiReports', 'submissions', 'studyResponses', 'participants', 'sessions']);
  console.log('PASS security access regressions: target binding, scope/capability, profile fields, intake, transaction rollback (mocked; no DB/network)');
}

function helperSanitizer() {
  const node = find(routes, n => ts.isFunctionDeclaration(n) && n.name?.text === 'sanitizeUserRecord');
  return compile(node.getText(routes));
}

if (process.argv[1]?.endsWith('security-access-regressions.ts')) await runSecurityAccessRegressions();
