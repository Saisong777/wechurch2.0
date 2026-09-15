import { z } from 'zod';

export const mentoringStatuses = ['pending','active','declined','ended'] as const;
export type MentoringStatus = typeof mentoringStatuses[number];
export const mentoringLabels: Record<MentoringStatus,string> = { pending:'等待接受',active:'陪伴中',declined:'未接受',ended:'已結束' };
export const mentoringInvite = z.object({
  journeyId:z.string().uuid(), groupId:z.string().uuid(), mentorId:z.string().uuid(),
  cadenceDays:z.union([z.literal(7),z.literal(14),z.literal(30)]),
  agreement:z.string().trim().min(1).max(2000), consent:z.literal(true),
}).strict();
export const mentoringAction = z.object({version:z.number().int().positive(),action:z.enum(['accept','decline','end']),consent:z.literal(true)}).strict();
export const mentoringFeedback = z.object({
  version:z.number().int().positive(),kind:z.enum(['reflection','practice','feedback']),body:z.string().trim().min(1).max(5000),
}).strict();
export function mayActOnMentoring(status:MentoringStatus, action:'accept'|'decline'|'end', isLearner:boolean) {
  if(action==='end')return status==='active'||(isLearner&&status==='pending');
  return !isLearner&&status==='pending';
}
export interface MentoringContract {
  id:string;journeyId:string;mentorId:string;learnerId:string;mentorName:string;learnerName:string;
  status:MentoringStatus;version:number;cadenceDays:number;agreement:string;courseName:string;isLearner:boolean;
  acceptedAt:string|null;endedAt:string|null;createdAt:string;
}
export interface MentoringTarget {groupId:string;groupName:string;mentorId:string;mentorName:string}
export interface MentoringDetail {
  contract:MentoringContract;
  progress:Array<{id:string;dayNumber:number;title:string;status:string;responseText:string|null}>;
  feedback:Array<{id:string;authorName:string;kind:'reflection'|'practice'|'feedback';body:string;createdAt:string}>;
  hasOlderFeedback:boolean;
}
