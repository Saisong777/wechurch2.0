import {IncomingMessage,ServerResponse} from 'node:http';import {Duplex} from 'node:stream';import {it as test} from 'vitest';import assert from 'node:assert/strict';
import express from 'express';import session from 'express-session';import passport from 'passport';
import {persistAuthenticatedSession,destroyAuthenticatedSession,sessionCookieOptions,SESSION_TTL_MS,SESSION_TTL_SECONDS} from './authSessionPersistence';
import {createSessionVersionGuard} from './authSessionVersion';
const DAY=86400000;
function storeGet(store: session.MemoryStore,sid: string): Promise<session.SessionData | undefined> {return new Promise<session.SessionData | undefined>((resolve,reject)=>store.get(sid,(e,v)=>e?reject(e):resolve(v ?? undefined)));}
function sessionId(cookie: string){return decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('=')).slice(2).split('.')[0];}
async function fixture(){
 let version=0;process.env.NODE_ENV='development';const app=express(),auth=new passport.Authenticator(),store=new session.MemoryStore();
 const guard=createSessionVersionGuard({getUser:async()=>({legacyUserId:'synthetic-member'})},async()=>version);
 auth.serializeUser((u,done)=>guard.serialize(u).then(v=>done(null,v),done));auth.deserializeUser((u,done)=>guard.deserialize(u).then(v=>done(null,v),done));
 app.use(session({secret:'synthetic-test-secret-with-sufficient-length',store,resave:false,saveUninitialized:false,rolling:true,cookie:{...sessionCookieOptions(),maxAge:SESSION_TTL_MS}}));app.use(auth.initialize());app.use(auth.session());
 app.get('/login',(req,res,next)=>{const legacy=req.query.legacy==='1',expiry=Math.floor(Date.now()/1000)+(legacy?7*86400:SESSION_TTL_SECONDS);req.login({claims:{sub:'synthetic-auth'},expires_at:expiry},e=>{if(e)return next(e);if(legacy)req.session.cookie.maxAge=7*DAY;req.session.save(e=>e?next(e):res.json({signedIn:true}));});});
 app.get('/private',(_req,res,next)=>{res.set('Cache-Control','no-store');next();},persistAuthenticatedSession,(req,res)=>res.json({expires:(req.user as any).expires_at}));
 app.get('/logout',destroyAuthenticatedSession);app.use((e,_req,res,_next)=>res.status(503).json({error:'synthetic-failure'}));
 async function request(url: string,cookie?: string | null){
  const chunks: Buffer[]=[];class Socket extends Duplex{_read(){} _write(chunk,_encoding,done){chunks.push(Buffer.from(chunk));done();}}const socket=new Socket();
  const req=new IncomingMessage(socket as never);req.method='GET';req.url=url;req.headers={host:'synthetic.example.test',...(cookie?{cookie:cookie.split(';')[0]}:{})};req.httpVersionMajor=1;req.httpVersionMinor=1;
  const res=new ServerResponse(req);res.assignSocket(socket as never);await new Promise<void>((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject);(app as unknown as {handle(req: IncomingMessage,res: ServerResponse,next: () => void): void}).handle(req,res,()=>res.end());});
  const raw=Buffer.concat(chunks).toString(),body=raw.slice(raw.indexOf('\r\n\r\n')+4);const headers=new Headers();for(const [k,v]of Object.entries(res.getHeaders()))headers.set(k,Array.isArray(v)?v.join(', '):String(v));socket.destroy();
  return{status:res.statusCode,headers,json:async()=>JSON.parse(body)};
 }
 return{store,version:()=>++version,close:async()=>{},request};
}
test('persistent cookie survives a fresh client, advances browser/store/serialized identity together, and logout cannot reuse it',async()=>{
 const f=await fixture(),realNow=Date.now;try{
  const login=await f.request('/login?legacy=1'),cookie=login.headers.get('set-cookie');assert(cookie);assert(cookie.includes('Expires='));const sid=sessionId(cookie),before=await storeGet(f.store,sid);assert(before);assert.equal(before.cookie.originalMaxAge,7*DAY);
  const clock=realNow()+6*DAY;Date.now=()=>clock;const reopened=await f.request('/private',cookie);assert.equal(reopened.status,200);assert.equal(reopened.headers.get('cache-control'),'no-store');const renewed=reopened.headers.get('set-cookie');assert(renewed&&renewed.includes('Expires='));assert(!renewed.includes('Domain='));const payload=await reopened.json();
  const saved=await storeGet(f.store,sid);assert(saved);assert(saved.cookie.expires);assert.equal((saved as any).passport.user.expires_at,payload.expires);assert.equal(payload.expires,Math.floor(clock/1000)+SESSION_TTL_SECONDS);assert.equal(saved.cookie.originalMaxAge,SESSION_TTL_MS);assert.equal(new Date(saved.cookie.expires).getTime(),clock+SESSION_TTL_MS);
  Date.now=()=>clock+DAY;assert.equal((await f.request('/private',renewed)).status,200);
  const logout=await f.request('/logout',renewed);assert.equal(logout.status,302);assert.match(logout.headers.get('set-cookie')!,/connect.sid=;.*Expires=Thu, 01 Jan 1970/);assert.equal(await storeGet(f.store,sid),undefined);assert.equal((await f.request('/private',renewed)).status,401);
 }finally{Date.now=realNow;await f.close();}
});
test('a password reset version revokes rolling sessions; inactivity never revives expired identity',async()=>{
 const f=await fixture(),realNow=Date.now;try{
  const cookie=(await f.request('/login')).headers.get('set-cookie');assert.equal((await f.request('/private',cookie)).status,200);f.version();assert.equal((await f.request('/private',cookie)).status,401);
  const fresh=(await f.request('/login')).headers.get('set-cookie');assert(fresh);const sid=sessionId(fresh),before=await storeGet(f.store,sid);Date.now=()=>realNow()+8*DAY;assert.equal((await f.request('/private',fresh)).status,401);const after=await storeGet(f.store,sid);if(after)assert.equal((after as any).passport.user.expires_at,(before as any).passport.user.expires_at);
 }finally{Date.now=realNow;await f.close();}
});
test('a verified identity cannot extend a different serialized subject',()=>{
 const now=Math.floor(Date.now()/1000),saved={claims:{sub:'other-auth'},expires_at:now+100},user={claims:{sub:'synthetic-auth'},expires_at:now+100};let status=0,next=false;
 persistAuthenticatedSession({user,isAuthenticated:()=>true,session:{passport:{user:saved},cookie:{},touch(){throw Error('must not touch')}}} as never,{status(v){status=v;return this},json(){}} as never,()=>{next=true});assert.equal(status,401);assert.equal(next,false);assert.equal(saved.expires_at,now+100);
});
