import express from 'express';
import type {AddressInfo} from 'node:net';
import {CastleAvatarRepository} from './castleAvatarRepository';
import type {CastleProfileSave,CastleProfileResponse} from '../shared/castleAvatar';
import { castleJoinResponseSchema, castleJoinV2ResponseSchema, castleRosterV2Schema, castleRosterSchema } from '../shared/castlePresence';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
vi.mock('./db', () => ({ pool: {query:vi.fn()} }));
import {runChurchContext} from './churchContext';
import {defaultCastleProfile, type CastleAvatarProfile} from '../shared/castleAvatar';
import { castleLeaseVerifier, castlePresenceRoutes } from './castlePresenceRoutes';
import { CastlePresenceStore, type CastleActor } from './castlePresenceStore';
const actor: CastleActor = { actorId: '11111111-1111-4111-8111-111111111111', church: 'IM 行動教會', sid: 'private-session', sessionVersion: 1, authSub: 'auth-sub' };
let server: Server | undefined;
afterEach(async () => { if (server)
    await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });
describe('presence API boundary', () => {
    it('authenticates, rejects forged strict bodies and cross-site writes, and never exposes actor/session IDs', async () => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => { Object.assign(req, { user: { sessionUserId: actor.actorId, sessionVersion: 1, claims: { sub: actor.authSub } }, sessionID: actor.sid }); next(); });
        const store = new CastlePresenceStore(async (c) => new Set(c.map(c => c.token)));
        app.use('/api/castle-presence', castlePresenceRoutes(store, (req, res, next) => req.get('X-Test-Guest') ? void res.status(401).end() : next(), () => ({ actorId: actor.actorId, actorChurch: actor.church, selectedChurch: actor.church, isSystemAdmin: false }), true));
        server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        const port = (server.address() as AddressInfo).port, url = `http://127.0.0.1:${port}/api/castle-presence`;
        const send = (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
        expect((await send('', undefined, { 'X-Test-Guest': '1' })).status).toBe(401);
        for (const body of [{ alias: 'A', preset: 'jade', actorId: actor.actorId }, { alias: '\u0000', preset: 'jade' }, { alias: 'A', preset: 'photo' }])
            expect((await send('/join', body)).status).toBe(400);
        expect((await send('/join', { alias: 'A', preset: 'jade' }, { Origin: 'https://foreign.test' })).status).toBe(403);
        const joinedResponse = await send('/join', { alias: '<b>A</b>', preset: 'jade' });
        expect(joinedResponse.headers.get('cache-control')).toBe('private, no-store');
        const joined = castleJoinResponseSchema.parse(await joinedResponse.json());
        expect(joined.avatars).toHaveLength(1);
        const roster = await (await send('')).json();
        expect(JSON.stringify(roster)).not.toContain(actor.actorId);
        expect(JSON.stringify(roster)).not.toContain(actor.sid);
        expect(JSON.stringify(roster)).not.toContain('leaseToken');
        expect((await send('/move', { targetNode: 2, from: [0, 0] }, { 'X-Castle-Lease': joined.leaseToken })).status).toBe(400);
        for (const [path,body] of [['/heartbeat',{}],['/move',{targetNode:2}]] as const) {
            const result=await send(path,body,{'X-Castle-Lease':joined.leaseToken});
            expect(result.status).toBe(200);
            const legacy=castleRosterSchema.parse(await result.json());
            expect(Object.keys(legacy.avatars[0])).toEqual(['avatarId','alias','preset','isSelf','motion']);
        }
    });
    it('batch-checks canonical identity, session expiry, scope and version without private fields in output', async () => {
        let mapping = actor.actorId, expire: any = new Date(Date.now() + 60000), version = 1;
        let missingAuth = false;
        const query = { query: vi.fn(async (sql: string) => ({ rows: sql.includes('FROM auth_users') ? (missingAuth ? [] : [{ id: actor.authSub, actor_id: mapping }]) : sql.includes('FROM auth_sessions') ? [{ sid: actor.sid, expire, sess: { passport: { user: { claims: { sub: actor.authSub }, sessionUserId: actor.actorId, sessionVersion: 1, expires_at: Math.floor(Date.now() / 1000) + 60 } } } }] : [{ id: actor.actorId, church: actor.church, session_version: version, admin: false }] })) };
        const verify = castleLeaseVerifier(query), candidate = { ...actor, token: 'opaque' };
        expect((await verify([candidate])).has('opaque')).toBe(true);
        expect(query.query).toHaveBeenCalledTimes(3);
        mapping = 'other';
        expect((await verify([candidate])).size).toBe(0);
        mapping = actor.actorId;
        missingAuth = true;
        expect((await verify([candidate])).size).toBe(0);
        missingAuth = false;
        expire = 'invalid-date';
        expect((await verify([candidate])).size).toBe(0);
        expire = new Date(Date.now() + 60000);
        version = 2;
        expect((await verify([candidate])).size).toBe(0);
    });
});

it('negotiates appearance without changing v1 strict responses, and legacy join cannot overwrite stored look',async()=>{
 const profile={version:1 as const,alias:'Saved',genderPresentation:'female' as const,skinTone:'deep' as const,hairStyle:'long' as const,hairColor:'silver' as const,outfit:'jacket' as const,outfitColor:'violet' as const};let saved:CastleProfileResponse={profile,revision:1};const profiles={run:async(_actor:unknown,work:()=>Promise<unknown>)=>work(),read:vi.fn(async()=>saved),save:vi.fn(async(_actor:unknown,input:CastleProfileSave)=>{if(input.expectedRevision!==saved.revision)throw Object.assign(Error('conflict'),{status:409});saved={profile:input.profile,revision:saved.revision+1};return saved;})};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{Object.assign(req,{user:{sessionUserId:actor.actorId,sessionVersion:1,claims:{sub:actor.authSub}},sessionID:actor.sid});next();});const store=new CastlePresenceStore(async c=>new Set(c.map(c=>c.token)));app.use('/api/castle-presence',castlePresenceRoutes(store,(_req,_res,next)=>next(),()=>({actorId:actor.actorId,actorChurch:actor.church,selectedChurch:actor.church,isSystemAdmin:false}),true,profiles as unknown as CastleAvatarRepository));server=await new Promise<Server>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/castle-presence`,send=(path:string,method='GET',body?:unknown,headers={})=>fetch(url+path,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const v2=castleJoinV2ResponseSchema.parse(await(await send('/join','POST',{}, {'X-Castle-Protocol':'2'})).json());expect(v2.avatars[0].appearance).toMatchObject({outfit:'jacket',skinTone:'deep'});expect(Object.keys(v2.avatars[0])).toHaveLength(6);const legacy=castleJoinResponseSchema.parse(await(await send('/join','POST',{alias:'Old',preset:'coral'},{'X-Castle-Lease':v2.leaseToken})).json());expect(legacy.avatars[0].alias).toBe('Saved');expect(legacy.avatarId).toBe(v2.avatarId);expect(Object.keys(legacy.avatars[0])).toHaveLength(5);expect(profiles.save).not.toHaveBeenCalled();expect((await send('/profile','PUT',{expectedRevision:1,profile,userId:'forged'})).status).toBe(400);expect((await send('','GET',undefined,{'X-Castle-Protocol':'3'})).status).toBe(400);
 const motion=v2.avatars[0].motion;expect((await send('/profile','PUT',{expectedRevision:1,profile:{...profile,alias:'New'}})).status).toBe(200);const after=castleRosterV2Schema.parse(await(await send('','GET',undefined,{'X-Castle-Protocol':'2'})).json());expect(after.avatars[0].alias).toBe('New');expect(after.avatars[0].motion).toEqual(motion);expect(after.avatars[0].avatarId).toBe(v2.avatarId);
 for (const [path,body] of [['/heartbeat',{}],['/move',{targetNode:2}]] as const) {
  const result=await send(path,'POST',body,{'X-Castle-Protocol':'2','X-Castle-Lease':v2.leaseToken});
  expect(result.status).toBe(200);
  const modern=castleRosterV2Schema.parse(await result.json());
  expect(Object.keys(modern.avatars[0])).toHaveLength(6);
  expect(modern.avatars[0].appearance).toEqual(v2.avatars[0].appearance);
 }

});

async function realProfileRouteFixture() {
    let profile: CastleAvatarProfile = defaultCastleProfile('Before'), revision = 1;
    let valid = true, church = actor.church, revokeOnCommit = false;
    const statements: string[] = [];
    const query = async (sql: string, values?: unknown[]) => {
        statements.push(sql);
        if (sql.includes('FOR SHARE OF u'))
            return { rows: [{ church, admin: false }] };
        if (sql.startsWith('SELECT u.display_name'))
            return { rows: [{ display_name: 'Before', profile, revision }] };
        if (sql.startsWith('UPDATE castle_avatar_profiles')) {
            if (values?.[2] !== revision)
                return { rows: [] };
            profile = JSON.parse(values![1] as string);
            revision++;
            return { rows: [{ profile, revision }] };
        }
        if (sql === 'COMMIT' && revokeOnCommit)
            valid = false;
        return { rows: [] };
    };
    const repo = new CastleAvatarRepository({ query, connect: async () => ({ query, release: () => {
            } }) }, () => async (candidates) => new Set(valid ? candidates.map(c => c.token) : []));
    const store = new CastlePresenceStore(async (candidates) => new Set(valid ? candidates.map(c => c.token) : []));
    const app = express();
    app.use(express.json());
    const context = { actorId: actor.actorId, actorChurch: actor.church, selectedChurch: actor.church, isSystemAdmin: false };
    app.use((req, _res, next) => {
        Object.assign(req, { user: { sessionUserId: actor.actorId, sessionVersion: 1, claims: { sub: actor.authSub } }, sessionID: actor.sid });
        runChurchContext(context, next);
    });
    app.use('/api/castle-presence', castlePresenceRoutes(store, (_req, _res, next) => next(), undefined, true, repo));
    server = await new Promise<Server>(resolve => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/castle-presence`;
    const send = (path: string, method = 'GET', body?: unknown) => fetch(url + path, { method, headers: { 'Content-Type': 'application/json', 'X-Castle-Protocol': '2' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { repo, store, statements, send, setChurch: (value: string) => {
            church = value;
        }, revokeOnCommit: () => {
            revokeOnCommit = true;
        }, restore: () => {
            valid = true;
            revokeOnCommit = false;
        }, saved: () => ({ profile, revision }) };
}
it('maps a real locked church change to CHURCH_CONTEXT_CHANGED 409 without leaking unexpected errors', async () => {
    const f = await realProfileRouteFixture();
    expect((await f.send('/profile')).status).toBe(200);
    f.setChurch('火樂');
    const response = await f.send('/profile', 'PUT', { expectedRevision: 1, profile: defaultCastleProfile('Changed') });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CHURCH_CONTEXT_CHANGED', error: '所屬教會或權限已變更，請重新載入。' });
    expect(f.statements).toContain('ROLLBACK');
    expect(f.statements).not.toContain('COMMIT');
    expect(f.saved().revision).toBe(1);
});
it('does not publish after a committed save fails reauthorization, then legally reconciles via GET and join', async () => {
    const f = await realProfileRouteFixture();
    const joined = castleJoinV2ResponseSchema.parse(await (await f.send('/join', 'POST', {})).json());
    const before = (await f.store.roster(actor)).avatars[0];
    const patch = vi.spyOn(f.store, 'updateProfile');
    patch.mockClear();
    f.revokeOnCommit();
    const response = await f.send('/profile', 'PUT', { expectedRevision: 1, profile: defaultCastleProfile('Committed') });
    expect(response.status).toBe(401);
    expect(patch).not.toHaveBeenCalled();
    expect(f.statements).toContain('COMMIT');
    expect(f.statements).not.toContain('ROLLBACK');
    expect(f.saved()).toMatchObject({ revision: 2, profile: { alias: 'Committed' } });
    f.restore();
    const still = (await f.store.roster(actor)).avatars[0];
    expect(still.alias).toBe('Before');
    expect(still.avatarId).toBe(before.avatarId);
    expect(still.motion).toEqual(before.motion);
    const receipt = await (await f.send('/profile')).json();
    expect(receipt).toMatchObject({ revision: 2, profile: { alias: 'Committed' } });
    // Use the original lease so reconciliation also preserves its avatar/motion.
    const rejoin = await fetch(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/castle-presence/join`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Castle-Protocol': '2', 'X-Castle-Lease': joined.leaseToken }, body: '{}' });
    const reconciled = castleJoinV2ResponseSchema.parse(await rejoin.json());
    expect(reconciled.avatarId).toBe(before.avatarId);
    expect(reconciled.avatars[0].motion).toEqual(before.motion);
    expect(reconciled.avatars[0].alias).toBe('Committed');
});
