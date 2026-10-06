import { selectedChurch, lockChurchContext } from './churchContext';
import { createHash } from 'node:crypto';
import { pool } from './db';
import { GroupError,groupAccess } from './lifeGroupRepository';
import { devotionDayWindow,type DevotionMultiShareInput,type DevotionMultiShareResult } from '../shared/devotionWall';
const conflict=()=>new GroupError(409,'分享內容或狀態已變更，請重新確認；尚未重新發布。');
export async function publishDevotionShare(actor:string,requestId:string,input:DevotionMultiShareInput):Promise<DevotionMultiShareResult>{
  const c=await pool.connect();
  try{
    await c.query('BEGIN'); await lockChurchContext(c);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`devotion-share/${actor}/${requestId}`]);
    const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const previous=(await c.query('SELECT request_hash,result,church FROM devotion_share_requests WHERE user_id=$1 AND request_id=$2',[actor,requestId])).rows[0];
    if(previous && (previous.request_hash!==hash || previous.church!==selectedChurch()))throw conflict();
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`devotional:${input.sourceId}`]);
    // Match existing group mutation lock order; membership cannot disappear mid-publication.
    if(input.group)await groupAccess(c,input.group.groupId,actor);
    if(!(await c.query('SELECT n.id FROM devotional_notes n WHERE n.id=$1 AND n.user_id=$2 AND n.hidden=false AND NOT EXISTS(SELECT 1 FROM devotional_note_deletions d WHERE d.note_id=n.id) FOR UPDATE',[input.sourceId,actor])).rowCount)throw new GroupError(404,'找不到本人已儲存的筆記，尚未分享。');
    const window=devotionDayWindow((await c.query('SELECT clock_timestamp() AS now')).rows[0].now);
    if(input.wall && input.wall.day!==window.day)throw new GroupError(409,'已經換日，請重新確認今天的分享日期。');
    // A retry must never resurrect a withdrawn, edited or expired destination.
    if(previous){
      const result=previous.result as DevotionMultiShareResult;
      if(result.group && !(await c.query(`SELECT id FROM life_group_shares WHERE id=$1 AND group_id=$2 AND author_id=$3 AND source_id=$4 AND kind='note' AND title=$5 AND body=$6 AND reference=$7 AND NOT is_anonymous AND withdrawn_at IS NULL`,[result.group.id,result.group.groupId,actor,input.sourceId,input.title,input.body,input.reference])).rowCount)throw conflict();
      if(result.wall && !(await c.query(`SELECT id FROM devotion_wall_posts WHERE id=$1 AND user_id=$2 AND source_note_id=$3 AND published_day=$4 AND title=$5 AND body=$6 AND reference=$7 AND is_anonymous=$8 AND withdrawn_at IS NULL AND expires_at>clock_timestamp() AND church=$9`,[result.wall.id,actor,input.sourceId,input.wall!.day,input.title,input.body,input.reference,input.wall!.anonymous,selectedChurch()])).rowCount)throw conflict();
      await c.query('COMMIT');return {...result,created:false};
    }
    const result:DevotionMultiShareResult={requestId,created:true,group:null,wall:null};
    if(input.group){
      // IDs from the older endpoint cannot be claimed as a new operation.
      if((await c.query('SELECT id FROM life_group_shares WHERE id=$1',[requestId])).rowCount)throw conflict();
      await c.query(`INSERT INTO life_group_shares(id,group_id,author_id,kind,title,body,reference,source_id,is_anonymous) VALUES($1,$2,$3,'note',$4,$5,$6,$7,false)`,[requestId,input.group.groupId,actor,input.title,input.body,input.reference,input.sourceId]);
      result.group={id:requestId,groupId:input.group.groupId};
    }
    if(input.wall){
      const existing=(await c.query(`SELECT id,user_id,title,body,reference,is_anonymous FROM devotion_wall_posts WHERE source_note_id=$1 AND published_day=$2 AND church=$3 AND withdrawn_at IS NULL`,[input.sourceId,window.day,selectedChurch()])).rows[0];
      if(existing){
        if(existing.user_id!==actor || existing.title!==input.title || existing.body!==input.body || existing.reference!==input.reference || existing.is_anonymous!==input.wall.anonymous)throw conflict();
        result.wall={id:existing.id,day:window.day};
      }else{
        if((await c.query('SELECT id FROM devotion_wall_posts WHERE id=$1',[requestId])).rowCount)throw conflict();
        await c.query(`INSERT INTO devotion_wall_posts(id,source_note_id,user_id,published_day,title,body,reference,is_anonymous,expires_at,church) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[requestId,input.sourceId,actor,window.day,input.title,input.body,input.reference,input.wall.anonymous,window.expiresAt,selectedChurch()]);
        result.wall={id:requestId,day:window.day};
      }
    }
    await c.query('INSERT INTO devotion_share_requests(user_id,request_id,request_hash,result,church) VALUES($1,$2,$3,$4,$5)',[actor,requestId,hash,JSON.stringify(result),selectedChurch()]);
    await c.query('COMMIT');return result;
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
