import { planImport, summarizePlan } from './im-bible-import-plan.mjs';
import { SOURCE_PROJECT, sha256 } from './im-bible-migration.mjs';
import { randomUUID } from 'node:crypto';

const digest = value => sha256(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object'
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const sameRecord = (a,b) => digest(canonical(a))===digest(canonical(b));
export class ImportError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const stop = code => { throw new ImportError(code); };

export async function readTarget(client) {
  const rows = async sql => (await client.query(sql)).rows;
  return { format: 'wechurch-im-bible-target-v1',
    users: await rows('SELECT id,email FROM users'),
    authUsers: await rows('SELECT id,email FROM auth_users'),
    googleLinks: await rows('SELECT google_subject AS "googleSubject",user_id AS "userId",auth_user_id AS "authUserId" FROM google_account_links'),
    sourceAccounts: await rows('SELECT project_id AS "projectId",source_uid AS "sourceUid",user_id AS "userId" FROM im_source_accounts'),
    records: await rows(`SELECT r.source_key AS "sourceKey",r.record_sha256 AS "recordSha256",r.user_id AS "userId",r.kind,r.note_id AS "noteId",
      CASE WHEN r.kind='note' THEN n.id IS NOT NULL AND n.user_id=r.user_id
      ELSE p.id IS NOT NULL AND p.user_id=r.user_id END AS "targetExists"
      FROM im_source_records r LEFT JOIN devotional_notes n ON n.id=r.note_id
      LEFT JOIN user_reading_progress p ON p.id=r.progress_id`) };
}

function validatePrepared(prepared) {
  if (prepared?.format !== 'wechurch-im-bible-prepared-v1' || !prepared.sourceExportedAt ||
      !Number.isFinite(Date.parse(prepared.sourceExportedAt)) ||
      digest(prepared.calendar) !== prepared.bundle?.calendarSha256) stop('INVALID_PREPARED');
  const empty = { format:'wechurch-im-bible-target-v1', users:[], authUsers:[], googleLinks:[], sourceAccounts:[], records:[] };
  if (!planImport(prepared.bundle, empty).ready) stop('INVALID_BUNDLE');
  const days = new Map(prepared.calendar.entries.map((day, index) => [day.key, { ...day, number:index + 1 }]));
  if (!days.size || days.size !== prepared.calendar.entries.length) stop('INVALID_CALENDAR');
  for (const row of [...prepared.bundle.notes, ...prepared.bundle.readDays]) {
    const day=days.get(row.dayKey);
    if (!day || day.date!==row.devotionalDate || day.reference!==row.reference || day.planTitle!==row.planTitle) stop('CALENDAR_RECORD_MISMATCH');
  }
  return days;
}

// One transaction owns the complete batch. Shares, role assignments and passwords are never imported.
export async function importPrepared(pool, prepared, { dryRun = true } = {}) {
  const days=validatePrepared(prepared), bundle=prepared.bundle;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('im-bible-import',0))");
    // Match Google login's locking order; prevent registration racing with identity creation.
    const locks=bundle.members.flatMap(m=>[`google:${m.googleSubject}`,`google-email:${m.email.trim().toLowerCase()}`]).sort();
    for(const lock of locks) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);
    const before=await readTarget(client);
    const plan=planImport(bundle,before);
    if(!plan.ready) return { ...summarizePlan(plan), committed:false };
    if(dryRun) return { ...summarizePlan(plan), committed:false };
    const existing=(await client.query('SELECT id FROM im_import_batches WHERE bundle_sha256=$1 AND rolled_back_at IS NULL',[bundle.bundleSha256])).rows[0];
    if(existing) {
      if(plan.actions.some(a=>a.action!=='unchanged')) stop('BATCH_LEDGER_DRIFT');
      await client.query('COMMIT');
      return { ...summarizePlan(plan), committed:true, replay:true, batchId:existing.id };
    }
    const batch=(await client.query('INSERT INTO im_import_batches(bundle_sha256,source_exported_at) VALUES ($1,$2) RETURNING id',[bundle.bundleSha256,prepared.sourceExportedAt])).rows[0].id;
    const owners=new Map(), noteIds=new Map();
    const dates=[...days.values()].map(d=>d.date).sort();
    for(const member of bundle.members) {
      const action=plan.actions.find(a=>a.kind==='account' && a.sourceUid===member.sourceUid);
      let userId=action.userId;
      if(action.action==='create-member') {
        userId=(await client.query('INSERT INTO users(email,display_name) VALUES ($1,$2) RETURNING id',[member.email.trim().toLowerCase(),member.name||'讀經夥伴'])).rows[0].id;
        await client.query('INSERT INTO auth_users(id,email,first_name) VALUES ($1,$2,$3)',[member.googleSubject,member.email.trim().toLowerCase(),member.name||'']);
        await client.query('INSERT INTO google_account_links(google_subject,user_id,auth_user_id) VALUES ($1,$2,$1)',[member.googleSubject,userId]);
      }
      if(action.action!=='unchanged') {
        const planId=(await client.query(`INSERT INTO user_reading_plans(user_id,name,description,start_date,end_date,is_active,reminder_enabled,total_days)
          VALUES ($1,'iM 讀經紀錄（舊 App）','保留原有讀經日期；實際打卡時間未知。',$2,$3,false,false,$4) RETURNING id`,[userId,dates[0],dates.at(-1),days.size])).rows[0].id;
        await client.query('INSERT INTO im_source_accounts(project_id,source_uid,user_id,google_subject,plan_id) VALUES ($1,$2,$3,$4,$5)',[SOURCE_PROJECT,member.sourceUid,userId,member.googleSubject,planId]);
      }
      const account=(await client.query('SELECT user_id,plan_id FROM im_source_accounts WHERE project_id=$1 AND source_uid=$2',[SOURCE_PROJECT,member.sourceUid])).rows[0];
      owners.set(member.sourceUid,account);
    }
    const existingRecords=new Map(before.records.map(r=>[r.sourceKey,r]));
    for(const [kind,items] of [['note',bundle.notes],['read-day',bundle.readDays]]) {
      const pending=[];
      for(const item of items) {
        const previous=existingRecords.get(item.sourceKey);
        if(previous) {if(kind==='note')noteIds.set(`${item.sourceUid}:${item.dayKey}`,previous.noteId);continue;}
        const owner=owners.get(item.sourceUid),id=randomUUID();
        if(kind==='note')noteIds.set(`${item.sourceUid}:${item.dayKey}`,id);
        pending.push({item,id,user_id:owner.user_id,plan_id:owner.plan_id,day_number:days.get(item.dayKey).number,
          date:item.devotionalDate,reference:item.reference,body:item.body,title:item.planTitle,note_id:noteIds.get(`${item.sourceUid}:${item.dayKey}`)||null});
      }
      // Parameterized batches keep the remote transaction short and avoid thousands of round trips.
      for(let offset=0;offset<pending.length;offset+=200) {
        const chunk=pending.slice(offset,offset+200);
        const targets=kind==='note'
          ? await client.query(`INSERT INTO devotional_notes(id,user_id,verse_reference,verse_text,observation,title_phrase,source_devotional_date,source_label)
            SELECT id,user_id,reference,'',body,title,date,'iM 讀經 App' FROM jsonb_to_recordset($1::jsonb)
            AS x(id uuid,user_id uuid,reference text,body text,title text,date date) RETURNING *`,[JSON.stringify(chunk)])
          : await client.query(`INSERT INTO user_reading_progress(id,user_id,plan_id,day_number,reading_date,scripture_reference,is_completed,completed_at,devotional_note_id)
            SELECT id,user_id,plan_id,day_number,date,reference,true,NULL,note_id FROM jsonb_to_recordset($1::jsonb)
            AS x(id uuid,user_id uuid,plan_id uuid,day_number integer,date date,reference text,note_id uuid) RETURNING *`,[JSON.stringify(chunk)]);
        const inserted=new Map(targets.rows.map(row=>[row.id,row]));
        const records=chunk.map(row=>({source_key:row.item.sourceKey,source_uid:row.item.sourceUid,user_id:row.user_id,
          record_sha256:row.item.recordSha256,original_record:row.item,note_id:kind==='note'?row.id:null,
          progress_id:kind==='read-day'?row.id:null,target_sha256:digest(inserted.get(row.id))}));
        await client.query(`INSERT INTO im_source_records(source_key,project_id,source_uid,user_id,batch_id,kind,record_sha256,original_record,note_id,progress_id,target_sha256)
          SELECT source_key,$2,source_uid,user_id,$3,$4,record_sha256,original_record,note_id,progress_id,target_sha256
          FROM jsonb_to_recordset($1::jsonb) AS x(source_key text,source_uid text,user_id uuid,record_sha256 text,
            original_record jsonb,note_id uuid,progress_id uuid,target_sha256 text)`,[JSON.stringify(records),SOURCE_PROJECT,batch,kind]);
      }
    }
    const after=planImport(bundle,await readTarget(client));
    if(!after.ready || after.actions.some(a=>a.action!=='unchanged')) stop('POST_IMPORT_RECONCILIATION_FAILED');
    const verification=await verifyImported(client,prepared);
    if(verification.mismatches)stop('POST_IMPORT_CONTENT_MISMATCH');
    await client.query('COMMIT');
    return {...summarizePlan(plan),committed:true,replay:false,batchId:batch,verification};
  } finally {
    await client.query('ROLLBACK').catch(()=>{});
    client.release();
  }
}

export async function verifyImported(client,prepared) {
  validatePrepared(prepared);
  let mismatches=0,editedNotes=0;
  const identities=new Map((await client.query(`SELECT a.source_uid,a.user_id,a.google_subject,g.user_id AS google_user,p.user_id AS plan_user
    FROM im_source_accounts a JOIN google_account_links g ON g.google_subject=a.google_subject
    JOIN user_reading_plans p ON p.id=a.plan_id JOIN auth_users u ON u.id=g.auth_user_id WHERE a.project_id=$1`,[SOURCE_PROJECT])).rows.map(r=>[r.source_uid,r]));
  for(const member of prepared.bundle.members) {
    const identity=identities.get(member.sourceUid);
    if(!identity || identity.google_subject!==member.googleSubject || identity.google_user!==identity.user_id || identity.plan_user!==identity.user_id)mismatches++;
  }
  const records=new Map((await client.query(`SELECT r.*,a.google_subject,g.user_id AS google_user,
      to_jsonb(n) AS note,to_jsonb(p) AS progress FROM im_source_records r
      JOIN im_source_accounts a ON a.project_id=r.project_id AND a.source_uid=r.source_uid
      JOIN google_account_links g ON g.google_subject=a.google_subject
      LEFT JOIN devotional_notes n ON n.id=r.note_id LEFT JOIN user_reading_progress p ON p.id=r.progress_id
      WHERE r.project_id=$1`,[SOURCE_PROJECT])).rows.map(r=>[r.source_key,r]));
  for(const [kind,items] of [['note',prepared.bundle.notes],['read-day',prepared.bundle.readDays]]) for(const item of items) {
    const row=records.get(item.sourceKey);
    const member=prepared.bundle.members.find(m=>m.sourceUid===item.sourceUid);
    const target=kind==='note'?row?.note:row?.progress;
    if(!row || row.kind!==kind || row.record_sha256!==item.recordSha256 ||
      row.original_record.recordSha256!==item.recordSha256 || !sameRecord(row.original_record,item) ||
      row.google_subject!==member.googleSubject || row.google_user!==row.user_id || target?.user_id!==row.user_id) {mismatches++;continue;}
    if(kind==='note') {
      if(target.version===1 && (target.observation!==item.body || target.source_devotional_date!==item.devotionalDate || target.verse_reference!==item.reference))mismatches++;
      if(target.version>1)editedNotes++;
    } else if(target.reading_date!==item.devotionalDate || target.scripture_reference!==item.reference)mismatches++;
  }
  return {members:prepared.bundle.members.length,notes:prepared.bundle.notes.length,readDays:prepared.bundle.readDays.length,mismatches,editedNotes};
}

// Never delete accounts, plans, or post-import edits. Any reference outside this batch blocks rollback.
export async function rollbackBatch(pool,batchId) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('im-bible-import',0))");
    const batch=(await client.query('SELECT * FROM im_import_batches WHERE id=$1 AND rolled_back_at IS NULL FOR UPDATE',[batchId])).rows[0];
    if(!batch)stop('BATCH_NOT_ACTIVE');
    const records=(await client.query('SELECT * FROM im_source_records WHERE batch_id=$1 FOR UPDATE',[batchId])).rows;
    for(const record of records) {
      const table=record.kind==='note'?'devotional_notes':'user_reading_progress';
      const id=record.note_id||record.progress_id;
      const current=(await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if(!current || digest(current)!==record.target_sha256)stop('TARGET_CHANGED_ROLLBACK_BLOCKED');
      // Discover every FK, including future sharing features with ON DELETE SET NULL.
      const refs=(await client.query(`SELECT c.conrelid::regclass::text AS table_name,a.attname AS column_name
        FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
        WHERE c.contype='f' AND c.confrelid=$1::regclass`,[table])).rows;
      for(const ref of refs) {
        if(ref.table_name==='im_source_records')continue;
        const quote=v=>'"'+v.replaceAll('"','""')+'"';
        const tableName=ref.table_name.split('.').map(quote).join('.');
        const rows=(await client.query(`SELECT * FROM ${tableName} WHERE ${quote(ref.column_name)}=$1`,[id])).rows;
        if(rows.some(r=>ref.table_name!=='user_reading_progress' || !records.some(entry=>entry.progress_id===r.id)))stop('SHARED_OR_REFERENCED_ROLLBACK_BLOCKED');
      }
    }
    await client.query('DELETE FROM im_source_records WHERE batch_id=$1',[batchId]);
    for(const kind of ['read-day','note'])for(const record of records.filter(r=>r.kind===kind)) {
      await client.query(`DELETE FROM ${kind==='note'?'devotional_notes':'user_reading_progress'} WHERE id=$1`,[record.note_id||record.progress_id]);
    }
    await client.query('UPDATE im_import_batches SET rolled_back_at=now() WHERE id=$1',[batchId]);
    await client.query('COMMIT');
    return {rolledBack:true,records:records.length,accountsRetained:true};
  } finally {await client.query('ROLLBACK').catch(()=>{});client.release();}
}
