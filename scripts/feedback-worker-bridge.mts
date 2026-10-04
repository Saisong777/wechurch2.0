// Authenticated maintenance bridge. It has no public endpoint and grants no user role.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pool} from '../server/db';
import {claimFeedbackAnalysis,completeFeedbackAnalysis,failFeedbackAnalysis} from '../server/feedbackRepository';
const sites={A:{environment:'f4b11351-cf4c-4a95-a3c0-45b195e9a0e0',app:'b5a40406-1614-4d8b-9eaa-f6f0cd32cac6'},B:{environment:'ae398a3f-4f0e-4617-8c55-838d1c5b47d9',app:'fef7af7c-e3c3-4977-8294-c3a123a4242e'}};
try{
 const request=JSON.parse(Buffer.from(process.argv[2]||'','base64').toString('utf8'));
 const site=sites[request.site as keyof typeof sites];
 if(!site||process.env.RAILWAY_ENVIRONMENT_ID!==site.environment||process.env.RAILWAY_SERVICE_ID!==site.app||process.env.RAILWAY_PROJECT_ID!=='9371f53f-3043-4a19-b25f-a55d891fb46a')throw Error('Target');
 const sha=(x:any)=>createHash('sha256').update(x).digest('hex');
 if(sha(new URL(process.env.DATABASE_URL!).hostname)!==request.databaseHostSha256||sha(fs.readFileSync('/app/server/feedbackRepository.ts'))!==request.repositorySha256)throw Error('Source');
 let result;
 if(request.operation==='claim')result={claims:await claimFeedbackAnalysis(1,900)};
 else if(request.operation==='complete')result=await completeFeedbackAnalysis(request.claim,{analysis:request.analysis,model:request.model});
 else if(request.operation==='fail')result=await failFeedbackAnalysis(request.claim);
 else throw Error('Operation');
 console.log('WECHURCH_FEEDBACK_RESULT:'+JSON.stringify(result));
}catch{console.error('WECHURCH_FEEDBACK_FAILED:operation_not_confirmed');process.exitCode=1;}
finally{await pool.end();}
