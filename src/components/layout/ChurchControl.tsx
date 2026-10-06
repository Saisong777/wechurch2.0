import { useChurchContext } from '@/contexts/ChurchContext';
export function ChurchControl() {
  const church=useChurchContext();
  if(!church)return null;
  if(church.loading)return <p role="status" className="text-xs text-muted-foreground">確認教會中…</p>;
  if(church.error)return <button className="min-h-11 text-sm underline" onClick={()=>void church.refreshChurch()}>重新確認教會</button>;
  if(!church.data)return null;
  const {data}=church;
  if(!data.isSystemAdmin)return <p className="text-sm [overflow-wrap:anywhere]">所屬教會：{data.allowedOptions.find(option=>option.id===data.actorChurch)?.name || '尚未確認'}</p>;
  return <label className="block min-w-0 space-y-1 text-xs text-muted-foreground">目前教會（管理範圍）<select aria-label="目前教會" className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={data.selectedChurch || ''} onChange={event=>{if(window.confirm('切換教會後，目前教會的分享與管理未送出內容會重設；個人筆記保留；意見草稿會留在原教會，切回後才可送出。是否切換？'))void church.selectChurch(event.target.value);}}>{!data.selectedChurch&&<option value="" disabled>請選擇教會</option>}{data.allowedOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><span className="block leading-5">分享牆、小家與課表依此教會顯示。</span></label>;
}
