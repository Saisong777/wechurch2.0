import { z } from 'zod';

export const feedbackCategory = z.enum(['bug','suggestion','question','other']);
export const feedbackStatus = z.enum(['new','reviewing','planned','done']);
export const feedbackPriority = z.enum(['P0','P1','P2','P3']);
export const feedbackUrgency = z.enum(['normal','blocked','security']);
// PostgreSQL length(text) counts Unicode code points, not JavaScript UTF-16 units.
function databaseText(min:number,max:number) {
  return z.string().trim().superRefine((value,ctx)=> {
    const count=Array.from(value).length;
    if(count<min || count>max) ctx.addIssue({code:z.ZodIssueCode.custom,message:`請輸入 ${min} 到 ${max} 個字元。`});
    if(value.includes('\0') || /\p{Cs}/u.test(value)) ctx.addIssue({code:z.ZodIssueCode.custom,message:'含有不支援的文字字元。'});
  });
}
export const feedbackCreateInput = z.object({
  requestId:z.string().uuid(), category:feedbackCategory,
  title:databaseText(3,120), body:databaseText(10,5000),
  location:z.string().max(200).regex(/^\/(?!\/)[A-Za-z0-9_./%-]*$/).default('/'),
  urgency:feedbackUrgency.default('normal'), consent:z.literal(true),
}).strict();
export const feedbackUpdateInput = z.object({
  version:z.number().int().positive(), status:feedbackStatus.optional(),
  priority:feedbackPriority.optional(), publicReply:databaseText(0,3000).optional(),
}).strict().refine(v => v.status!==undefined || v.priority!==undefined || v.publicReply!==undefined,'請指定要修改的欄位。');
export const feedbackAnalysisInput = z.object({
  category:feedbackCategory, summary:z.string().trim().min(1).max(600),
  urgency:z.enum(['low','medium','high','critical']), importance:z.enum(['low','medium','high']),
  reason:z.string().trim().min(1).max(1000), tags:z.array(z.string().trim().min(1).max(40)).max(8),
  nextAction:z.string().trim().min(1).max(600), suggestedPriority:feedbackPriority,
  evidence:z.array(z.string().trim().min(1).max(300)).min(1).max(5),
}).strict();
export type FeedbackAnalysis = z.infer<typeof feedbackAnalysisInput>;
export type FeedbackCreate = z.infer<typeof feedbackCreateInput>;
export type FeedbackRecord = {
  id:string; category:z.infer<typeof feedbackCategory>; title:string; body:string; location:string;
  urgency:z.infer<typeof feedbackUrgency>; status:z.infer<typeof feedbackStatus>;
  priority:z.infer<typeof feedbackPriority>; publicReply:string; version:number;
  createdAt:string; updatedAt:string; analysisStatus?:'pending'|'running'|'ready'|'failed';
  analysis?:FeedbackAnalysis|null; analysisError?:string|null; analyzedAt?:string|null; analysisModel?:string|null;
};
export type FeedbackClaim = {
  id:string; token:string; contentHash:string; sourceVersion:number; category:FeedbackCreate['category'];
  title:string; body:string; location:string; urgency:FeedbackCreate['urgency'];
};
// Model output is untrusted. Evidence must be traceable to this exact input.
export function validateFeedbackAnalysis(input:unknown, source:Pick<FeedbackClaim,'title'|'body'>) {
  const result=feedbackAnalysisInput.parse(input);
  if (result.evidence.some(quote => !source.title.includes(quote) && !source.body.includes(quote))) {
    throw new Error('AI 證據不符合原始反饋。');
  }
  return result;
}
