import { Router, type Request, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { churchContext } from './churchContext';
import { GroupError } from './groupError';
import { devotionDate } from '../shared/churchDevotion';
import { initialChurchChoiceInput,churchArrivalHandleInput,churchLoginDayReadInput,churchLoginInboxQuery } from '../shared/churchOnboarding';
import * as repo from './churchLoginRepository';
import type { SessionIdentity } from './authSessionVersion';
import { persistAuthenticatedSession } from './authSessionPersistence';
import { boundedWindowLimiter } from './requestLimits';

export function churchOnboardingRoutes(resolveId:(req:Request)=>Promise<string|null>){
  const router=Router(),uuid=z.string().uuid();
  router.use((req,_res,next)=>{
    if (!/^\/(?:me\/(?:church-onboarding|church-login-summary)|admin\/church-login-inbox)(?:\/|$)/.test(req.path)) return next('router');
    next();
  });
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
  router.use(persistAuthenticatedSession);
  router.use(async(req,res,next)=>{
    res.setHeader('Cache-Control','private, no-store');const id=await resolveId(req);
    if(!id)return void res.status(401).json({error:'請先登入。'});
    if(churchContext()?.actorId!==id)return void res.status(403).json({error:'無法確認帳號與教會範圍。'});
    if(!['GET','HEAD'].includes(req.method)){
      let invalid=req.get('sec-fetch-site')==='cross-site';
      if(req.get('origin')){try{invalid ||= new URL(req.get('origin')!).host!==req.get('host');}catch{invalid=true;}}
      if(invalid)return void res.status(403).json({error:'不接受跨網站寫入。'});
    }
    res.locals.actor=id;next();
  });
  router.get('/me/church-onboarding',async(_req,res)=>res.json(await repo.onboardingStatus(res.locals.actor)));
  router.post('/me/church-onboarding',boundedWindowLimiter({max:20,windowMs:60_000,key:req=>resActor(req)}),async(req,res)=>{
    const input=initialChurchChoiceInput.parse(req.body);
    res.json(await repo.chooseInitialChurch(res.locals.actor,input.churchId,input.requestId,(req.user as SessionIdentity|undefined)?.loginReceiptId as string|undefined));
  });
  router.get('/me/church-login-summary',async(_req,res)=>res.json(await repo.loginSummary(res.locals.actor)));
  router.get('/admin/church-login-inbox',async(req,res)=>{
    const input=churchLoginInboxQuery.parse(req.query);let cursor:{at:string;id:string}|undefined;
    if(input.cursor){const [at,id]=input.cursor.split('_');cursor=z.object({at:z.string().datetime({offset:true}),id:uuid}).parse({at,id});}
    res.json(await repo.loginInbox(res.locals.actor,input.scope,cursor,input.limit));
  });
  router.patch('/admin/church-login-inbox/:id/handle',async(req,res)=>res.json(await repo.handleArrival(res.locals.actor,uuid.parse(req.params.id),churchArrivalHandleInput.parse(req.body).version)));
  router.post('/admin/church-login-inbox/days/read',async(req,res)=>{const input=churchLoginDayReadInput.parse(req.body);res.json(await repo.readLoginDay(res.locals.actor,devotionDate.parse(input.day),input.scope));});
  router.get('/admin/church-login-inbox/days/:day',async(req,res)=>{
    const input=z.object({scope:z.enum(['church','unassigned']).optional(),cursor:uuid.optional(),limit:z.coerce.number().int().min(1).max(50).default(20)}).strict().parse(req.query);
    res.json(await repo.loginDayMembers(res.locals.actor,devotionDate.parse(req.params.day),input.cursor,input.limit,input.scope));
  });
  const errors:ErrorRequestHandler=(e,_req,res,_next)=>{
    if(e instanceof z.ZodError)return void res.status(400).json({error:'資料格式不正確，請重新確認。'});
    if(e instanceof GroupError)return void res.status(e.status).json({error:e.message});
    if(e?.code==='22007'||e?.code==='22008')return void res.status(400).json({error:'日期格式不正確。'});
    console.error('[Church onboarding] Request failed');res.status(503).json({error:'教會與登入紀錄暫時無法完整處理，請重試。'});
  };router.use(errors);return router;
}
function resActor(req:Request){return churchContext()?.actorId||req.ip||'unknown';}
