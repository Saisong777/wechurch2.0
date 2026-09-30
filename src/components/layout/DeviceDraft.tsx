import { useEffect, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { clearDeviceDraft, readDeviceDraft, writeDeviceDraft } from '@/lib/deviceDraft';

// Mount with a key containing the owner and scope after initial server loading.
export function DeviceDraft<T>({ owner, scope, revision, value, dirty, busy, schema, restore, preview }: {
  owner: string; scope: string; revision: number | null; value: T; dirty: boolean; busy: boolean;
  schema: z.ZodType<T>; restore: (value:T)=>void; preview: (value:T)=>ReactNode;
}) {
  const [candidate,setCandidate] = useState(()=>readDeviceDraft(owner,scope,schema));
  const [status,setStatus] = useState('');
  const serialized = JSON.stringify(value);
  useEffect(()=>{
    if(!dirty || busy) return;
    try { writeDeviceDraft(owner,scope,revision,JSON.parse(serialized),schema); setStatus('草稿已保留在此裝置，尚未同步'); }
    catch { setStatus('此裝置無法保存草稿，請勿關閉，並重試儲存'); }
  },[owner,scope,revision,serialized,dirty,busy,schema]);
  const conflict = candidate && candidate.revision !== revision;
  return <div className="space-y-2 border-y py-3 text-sm">
    <p role="status" aria-live="polite">{busy ? '正在儲存，請稍候…' : dirty ? status || '尚未儲存' : '只有自己可見'}</p>
    {candidate && <details><summary className="min-h-11 cursor-pointer py-2">前次草稿 · {new Date(candidate.savedAt).toLocaleString('zh-TW')}</summary>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap py-2 leading-7">{preview(candidate.value)}</div>
      {conflict && <p role="alert">雲端版本已改變，請對照草稿手動合併，不會自動覆蓋。</p>}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={busy || !!conflict} onClick={()=>{
        if(dirty && !window.confirm('以這份草稿取代目前尚未儲存的輸入？'))return;
        restore(candidate.value);setCandidate(null);
      }}>恢復草稿</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>{
        if(!window.confirm('刪除此裝置的前次草稿？雲端筆記不受影響。'))return;
        try { clearDeviceDraft(owner,scope);setCandidate(null); } catch { setStatus('無法刪除草稿，請重試'); }
      }}>刪除前次草稿</Button></div>
    </details>}
  </div>;
}
