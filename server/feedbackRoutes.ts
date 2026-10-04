import { Router, type Request, type RequestHandler, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { feedbackCategory,feedbackPriority,feedbackStatus } from '../shared/feedback';
import { createFeedback,myFeedback,adminFeedback,updateFeedback,feedbackHistory,exportFeedback,reanalyzeFeedback,FeedbackError } from './feedbackRepository';
const pagination=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)});
const sameOrigin:RequestHandler=(req,res,next) => {
  res.setHeader('Cache-Control','private, no-store');
  if (!['GET','HEAD'].includes(req.method)) {
    let invalid=req.get('sec-fetch-site')==='cross-site';
    const origin=req.get('origin');
    if(origin) { try {invalid ||=new URL(origin).host!==req.get('host');} catch {invalid=true;} }
    if(invalid) return void res.status(403).json({error:'不接受跨網站寫入。'});
  }
  next();
};
const errors:ErrorRequestHandler=(error,_req,res,_next) => {
  if(error instanceof z.ZodError) return void res.status(400).json({error:'意見格式不正確，請檢查欄位內容。'});
  if(error instanceof FeedbackError) return void res.status(error.status).json({error:error.message});
  console.error('[feedback]',error?.code||error?.name);
  res.status(503).json({error:'意見服務暫時無法使用，請稍後重試。'});
};
export function feedbackRoutes(resolveUserId:(req:Request)=>Promise<string|null>) {
  const router=Router(); router.use(sameOrigin);
  router.use(async(req,res,next)=> {
    const actor=await resolveUserId(req);
    if(!actor) return void res.status(401).json({error:'請先登入，才能送出或查看你的意見。'});
    res.locals.actor=actor;next();
  });
  router.get('/me',async(req,res)=> {
    const p=pagination.parse(req.query);res.json(await myFeedback(res.locals.actor,p.limit,p.offset));
  });
  router.post('/',async(req,res)=> {
    const result=await createFeedback(res.locals.actor,req.body);res.status(result.created?201:200).json({feedback:result.feedback});
  });
  router.use(errors);return router;
}
export function adminFeedbackRoutes(requireManager:RequestHandler) {
  const router=Router();router.use(sameOrigin,requireManager);
  router.use((req,res,next)=> {res.locals.actor=(req as Request&{legacyUserId:string}).legacyUserId;next();});
  router.get('/',async(req,res)=> {
    const input=pagination.extend({status:feedbackStatus.optional(),category:feedbackCategory.optional(),priority:feedbackPriority.optional(),sort:z.enum(['ai','manual']).default('manual')}).parse(req.query);
    res.json(await adminFeedback(input));
  });
  router.get('/export',async(req,res)=> {const p=pagination.parse(req.query);res.json(await exportFeedback(p.limit,p.offset));});
  router.get('/:id/history',async(req,res)=>res.json(await feedbackHistory(z.string().uuid().parse(req.params.id))));
  router.patch('/:id',async(req,res)=>res.json({feedback:await updateFeedback(res.locals.actor,z.string().uuid().parse(req.params.id),req.body)}));
  router.post('/:id/reanalyze',async(req,res)=> {
    const {version}=z.object({version:z.number().int().positive()}).strict().parse(req.body);
    res.json({feedback:await reanalyzeFeedback(res.locals.actor,z.string().uuid().parse(req.params.id),version)});
  });
  router.use(errors);return router;
}
