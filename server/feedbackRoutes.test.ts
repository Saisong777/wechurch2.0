import { afterAll,beforeAll,expect,it,vi } from 'vitest';
import express from 'express';
import { feedbackRoutes,adminFeedbackRoutes } from './feedbackRoutes';
import type { Server } from 'node:http';
vi.mock('./feedbackRepository',()=>({
  FeedbackError:class extends Error {},createFeedback:vi.fn(async()=>({feedback:{id:'fixture'},created:true})),
  myFeedback:vi.fn(async()=>({items:[],hasMore:false})),adminFeedback:vi.fn(async()=>({items:[],hasMore:false})),
  updateFeedback:vi.fn(),feedbackHistory:vi.fn(),exportFeedback:vi.fn(),reanalyzeFeedback:vi.fn(),
}));
let server:Server,origin:string;
beforeAll(async()=> {
  const app=express();app.use(express.json());
  app.use('/api/feedback',feedbackRoutes(async req=>req.get('x-test-actor')||null));
  app.use('/api/admin/feedback',adminFeedbackRoutes((req,res,next)=> {
    if(req.get('x-test-actor')!=='manager') return void res.status(403).json({error:'Forbidden'});
    Object.assign(req,{legacyUserId:'manager'});next();
  }));
  await new Promise<void>(resolve=>{server=app.listen(0,'127.0.0.1',()=>resolve());});
  const addr=server.address();if(!addr||typeof addr==='string') throw new Error('no fixture server');
  origin=`http://127.0.0.1:${addr.port}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
it('requires member authentication and returns private cache headers',async()=> {
  const response=await fetch(origin+'/api/feedback/me');expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('rejects cross-origin JSON, form, malformed origins and fetch-site writes',async()=> {
  for(const headers of ([{origin:'https://evil.example'},{origin:'invalid'},{'sec-fetch-site':'cross-site'}] as Record<string,string>[])) {
    const response=await fetch(origin+'/api/feedback',{method:'POST',headers:{...headers,'x-test-actor':'member','content-type':'application/json'},body:'{}'});
    expect(response.status).toBe(403);
  }
  const form=await fetch(origin+'/api/feedback',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/x-www-form-urlencoded'},body:'title=fake'});expect(form.status).toBe(403);
});
it('enforces admin guard before list/export/reanalysis',async()=> {
  for(const path of ['/api/admin/feedback','/api/admin/feedback/export']) expect((await fetch(origin+path)).status).toBe(403);
  expect((await fetch(origin+'/api/admin/feedback',{headers:{'x-test-actor':'manager'}})).status).toBe(200);
  const bad=await fetch(origin+'/api/admin/feedback?priority=unbounded',{headers:{'x-test-actor':'manager'}});expect(bad.status).toBe(400);
});
