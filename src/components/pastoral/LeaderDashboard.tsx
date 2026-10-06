import { churchFetch as fetch } from '@/lib/churchFetch';
import { UnsavedChangesGuard } from '@/components/layout/UnsavedChangesGuard';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, Check, HandHeart, Heart, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { familyBase, familyRequest, familySelectClass } from '@/lib/familyApi';
import { attendanceLabels, gatheringKinds, type AttendanceStatus, type DashboardCare, type DashboardGroup, type DashboardPrayer, type Gathering, type GatheringDetail, type LeaderDashboardData } from '@shared/leaderDashboard';
import { taipeiToday } from '@shared/churchDevotion';

const base = '/dashboard';
function useDashboard<T>(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery<T>({ queryKey: [familyBase,user?.id,'dashboard',path], queryFn: async ({ signal }) => {
    const r = await fetch(familyBase+base+path,{ credentials: 'include', cache: 'no-store', signal });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || '暫時無法讀取，請重試。'); return data;
  }, enabled: !!user && enabled, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: true, refetchOnMount: 'always', refetchInterval: 30000 });
}
function Problem({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border p-4"><p>{message}</p><Button variant="outline" onClick={retry}>重新載入</Button></div>;
}
function CareRow({ item, today }: { item: DashboardCare; today: string }) {
  return <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
    <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{item.groupName} · {item.dueDate && item.dueDate <= today ? '已到提醒日' : !item.responsibleName ? '待認領' : '持續陪伴'}</p><h4 className="mt-1 font-semibold">{item.name}</h4>
      <p className="mt-1 text-sm leading-6">{item.nextAction || '查看近況，接著關心'}</p><p className="mt-1 text-xs text-muted-foreground">{item.responsibleName ? `負責人：${item.responsibleName}` : '尚未指派負責人'}{item.dueDate && ` · 提醒 ${item.dueDate}`}</p></div>
    <Button asChild variant="outline"><Link to={`/groups/${item.groupId}?view=care&focus=${item.id}`}>記錄關心<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
  </li>;
}
function AttendanceSummary({ meeting }: { meeting: Gathering }) {
  if (meeting.cancelled) return <p className="text-sm text-muted-foreground">已取消 · 不列入出席摘要</p>;
  return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">{Object.entries(attendanceLabels).map(([key,label]) => <span key={key} className={key === 'unrecorded' && meeting.counts.unrecorded ? 'font-medium text-primary' : ''}><span className="tabular-nums">{meeting.counts[key as AttendanceStatus]}</span> {label}</span>)}{meeting.visitors > 0 && <span>{meeting.visitors} 位訪客</span>}</div>;
}
function Pagination({ page, total, change }: { page: number; total: number; change: (n: number) => void }) {
  if (total <= 30) return null;
  return <div className="flex items-center justify-center gap-4 py-4"><Button variant="outline" disabled={!page} onClick={() => change(page-1)}>上一頁</Button><span className="text-sm">第 {page+1} 頁</span><Button variant="outline" disabled={(page+1)*30 >= total} onClick={() => change(page+1)}>下一頁</Button></div>;
}

export function LeaderDashboard() {
  const { user } = useAuth();
  return user ? <DashboardWorkspace key={user.id} /> : null;
}
function DashboardWorkspace() {
  const [scope,setScope] = useState('all');
  const [view,setView] = useState<'overview'|'care'|'prayers'|'gatherings'>('overview');
  const [filter,setFilter] = useState('active');
  const [page,setPage] = useState(0);
  const [editor,setEditor] = useState<{ groupId: string; id?: string } | null>(null);
  const [editorGroup,setEditorGroup] = useState<DashboardGroup|null>(null);
  const q = useDashboard<LeaderDashboardData>(`?scope=${scope}`, !editor);
  const client = useQueryClient();
  async function refresh() { await client.invalidateQueries({ queryKey: [familyBase] }); }
  function openView(next: typeof view, nextFilter = 'active') { setView(next); setFilter(nextFilter); setPage(0); }
  function edit(value: {groupId:string;id?:string}) {
    const group = q.data?.groups.find(g=>g.id===value.groupId);
    if (!group) return;
    setEditorGroup(group); setEditor(value);
  }
  if (editor && editorGroup) return <AttendanceEditor key={`${editor.groupId}:${editor.id || 'new'}`} group={editorGroup} id={editor.id} close={() => setEditor(null)} saved={refresh} />;
  if (q.isError) return <section aria-label="牧養概況"><h2 className="mb-4 text-xl font-semibold">牧養概況</h2><Problem message={q.error.message} retry={() => { setScope('all'); void q.refetch(); }} /></section>;
  if (!q.data) return <p role="status" className="py-6">正在整理牧養概況…</p>;
  const data = q.data;
  const selected = scope === 'all' ? data.groups : data.groups.filter(g => g.id === scope);
  const readable = selected.filter(g => g.sharedReadable).length;
  if (!data.groups.length) return <section className="space-y-3 border-b pb-6"><h2 className="text-xl font-semibold">牧養概況</h2><p className="text-muted-foreground">目前沒有已指派的牧養範圍。負責的小家設定完成後，這裡會顯示近況與待辦。</p></section>;
  return <section aria-label="牧養概況" className="space-y-6 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">一起照顧正在同行的人</p><h2 className="mt-1 text-2xl font-semibold">牧養概況</h2></div><Button aria-label="重新整理牧養概況" variant="ghost" size="icon" onClick={() => void refresh()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="min-w-0 flex-1 space-y-1 text-sm"><span>負責範圍</span><select aria-label="牧養範圍" className={`${familySelectClass} max-w-md`} value={scope} onChange={e => { setScope(e.target.value); setPage(0); }}><option value="all">我的全部範圍（{data.groups.length} 個小家）</option>{data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><p className="text-xs text-muted-foreground">{new Date(data.updatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'})} 更新 · 台北時間</p></div>
    {readable < selected.length && <p className="text-sm leading-6 text-muted-foreground">關懷與代禱僅整理你可閱讀的共同內容；部分小家尚未開放共同內容給你。出席依負責範圍顯示。</p>}
    {view !== 'overview' && <Button variant="ghost" onClick={() => openView('overview')}><ArrowLeft className="mr-2 h-4 w-4" />返回概況</Button>}
    {view === 'overview' ? <>
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <SummaryCard icon={CalendarDays} title="最近聚會" caption="各小家最近一次 · 已取消除外" action="查看與記錄出席" onClick={() => openView('gatherings')}>
          {selected.length === 1 && data.gatherings[0] ? <><p className="text-sm">{data.gatherings[0].date} · {gatheringKinds[data.gatherings[0].kind]}</p><AttendanceSummary meeting={data.gatherings[0]} /></> : <><p className="text-2xl font-semibold tabular-nums">{data.gatherings.length}<span className="ml-2 text-sm font-normal">個小家已有記錄</span></p>{data.groupsWithoutGathering > 0 && <p className="mt-2 text-sm text-muted-foreground">{data.groupsWithoutGathering} 個小家尚無有效聚會記錄</p>}</>}
        </SummaryCard>
        <SummaryCard icon={HandHeart} title="待關懷" caption="截至目前 · 可見的共同關懷" action="查看待關懷" onClick={() => openView('care')}>
          {readable ? <><p className="text-2xl font-semibold tabular-nums">{data.care.active}<span className="ml-2 text-sm font-normal">件進行中</span></p><p className="mt-2 text-sm text-muted-foreground">{data.care.due} 件已到提醒日 · {data.care.unassigned} 件待認領</p></> : <p className="text-sm text-muted-foreground">尚無可閱讀的共同關懷範圍</p>}
        </SummaryCard>
        <SummaryCard icon={Heart} title="共同代禱" caption={`近 7 天 · ${data.since} 起`} action="查看共同代禱" onClick={() => openView('prayers')}>
          {readable ? <><p className="text-2xl font-semibold tabular-nums">{data.prayers.recent}<span className="ml-2 text-sm font-normal">則有新內容或更新</span></p><p className="mt-2 text-sm text-muted-foreground">只包含已分享的內容</p></> : <p className="text-sm text-muted-foreground">尚無可閱讀的共同代禱範圍</p>}
        </SummaryCard>
      </div>
      <section><div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><h3 className="text-lg font-semibold">需要我留意</h3><Button size="sm" variant="ghost" onClick={() => openView('care','due')}>查看到期關懷<ArrowRight className="ml-1 h-4 w-4" /></Button></div>
        <ul className="divide-y">{data.care.items.map(item => <CareRow key={item.id} item={item} today={data.today} />)}{data.gatherings.filter(m => m.counts.unrecorded > 0).slice(0,3).map(m => <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h4 className="font-medium">{m.groupName} · {m.date}</h4><p className="mt-1 text-sm text-muted-foreground">{m.counts.unrecorded} 人尚未填寫出席</p></div><Button variant="outline" onClick={() => edit({groupId:m.groupId,id:m.id})}>補記錄</Button></li>)}</ul>
        {!data.care.items.length && !data.gatherings.some(m => m.counts.unrecorded > 0) && <p className="py-6 text-sm text-muted-foreground">目前可見記錄中沒有到期、待認領或待補填事項。</p>}
      </section>
    </> : view === 'care' ? <CareList scope={scope} filter={filter} setFilter={v => {setFilter(v);setPage(0);}} page={page} setPage={setPage} today={data.today} /> : view === 'prayers' ? <PrayerList scope={scope} page={page} setPage={setPage} /> : <GatheringsList groups={selected} scope={scope} page={page} setPage={setPage} edit={edit} />}
  </section>;
}
function SummaryCard({ icon: Icon, title, caption, children, action, onClick }: { icon: typeof Heart; title: string; caption: string; children: React.ReactNode; action: string; onClick: () => void }) {
  return <article className="flex min-w-0 flex-col rounded-lg border bg-card p-4"><h3 className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</p><div className="my-4 flex-1">{children}</div><Button className="w-full justify-between" variant="outline" onClick={onClick}>{action}<ArrowRight className="h-4 w-4 shrink-0" /></Button></article>;
}
function CareList({ scope,filter,setFilter,page,setPage,today }: { scope: string; filter: string; setFilter: (v:string)=>void; page:number;setPage:(v:number)=>void; today:string }) {
  const q = useDashboard<{items:DashboardCare[];total:number}>(`/care?scope=${scope}&filter=${filter}&offset=${page*30}`);
  return <section className="space-y-4"><h3 className="text-lg font-semibold">待關懷</h3><select aria-label="關懷篩選" className={`${familySelectClass} max-w-xs`} value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">全部進行中</option><option value="due">已到提醒日</option><option value="unassigned">待認領</option></select>
    {q.isError ? <Problem message={q.error.message} retry={()=>void q.refetch()} /> : !q.data ? <p role="status">載入中…</p> : <><p className="text-sm text-muted-foreground">共 {q.data.total} 件可見的共同關懷</p><ul className="divide-y">{q.data.items.map(item=><CareRow key={item.id} item={item} today={today}/>)}</ul>{!q.data.total && <p className="py-4 text-muted-foreground">目前沒有符合條件的記錄。</p>}<Pagination page={page} total={q.data.total} change={setPage}/></>}
  </section>;
}
function PrayerList({scope,page,setPage}:{scope:string;page:number;setPage:(v:number)=>void}) {
  const q=useDashboard<{items:DashboardPrayer[];total:number}>(`/prayers?scope=${scope}&offset=${page*30}`);
  return <section className="space-y-4"><h3 className="text-lg font-semibold">共同代禱 · 近 7 天新動態</h3>{q.isError ? <Problem message={q.error.message} retry={()=>void q.refetch()}/> : !q.data ? <p role="status">載入中…</p> : <><p className="text-sm text-muted-foreground">共 {q.data.total} 則 · 同一則更新不重複計數</p><ul className="divide-y">{q.data.items.map(p=><li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{p.groupName} · {p.authorName}{p.answered ? ' · 已記下回應' : ''}</p><h4 className="mt-1 font-medium">{p.title}</h4></div><Button asChild variant="outline"><Link to={`/groups/${p.groupId}?view=prayer`}>前往代禱</Link></Button></li>)}</ul>{!q.data.total&&<p className="py-4 text-muted-foreground">近 7 天沒有可見的新代禱或更新。</p>}<Pagination page={page} total={q.data.total} change={setPage}/></>}</section>;
}
function GatheringsList({groups,scope,page,setPage,edit}:{groups:DashboardGroup[];scope:string;page:number;setPage:(v:number)=>void;edit:(v:{groupId:string;id?:string})=>void}) {
  const [chosen,setChosen]=useState(groups[0]?.id || '');
  const q=useDashboard<{items:Gathering[];total:number}>(`/gatherings?scope=${scope}&offset=${page*30}`);
  const groupId=groups.some(g=>g.id===chosen)?chosen:groups[0]?.id;
  return <section className="space-y-4"><h3 className="text-lg font-semibold">聚會出席</h3><div className="flex flex-wrap items-center gap-3"><select aria-label="建立聚會的小家" className={`${familySelectClass} sm:max-w-xs`} value={groupId} onChange={e=>setChosen(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><Button disabled={!groupId} onClick={()=>edit({groupId})}><Plus className="mr-2 h-4 w-4"/>新增聚會記錄</Button></div>
    {q.isError?<Problem message={q.error.message} retry={()=>void q.refetch()}/>:!q.data?<p role="status">載入中…</p>:<><ul className="divide-y">{q.data.items.map(m=><li key={m.id} className="space-y-2 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">{m.groupName}</h4><p className="text-sm text-muted-foreground">{m.date} · {gatheringKinds[m.kind]}</p></div><Button variant="outline" onClick={()=>edit({groupId:m.groupId,id:m.id})}>{m.cancelled?'查看記錄':'記錄出席'}</Button></div><AttendanceSummary meeting={m}/></li>)}</ul>{!q.data.total&&<p className="py-6 text-muted-foreground">尚未建立聚會出席記錄。從最近一次聚會開始即可。</p>}<Pagination page={page} total={q.data.total} change={setPage}/></>}
  </section>;
}
function AttendanceEditor({group,id,close,saved}:{group:DashboardGroup;id?:string;close:()=>void;saved:()=>Promise<void>}) {
  const [meetingId,setMeetingId]=useState(id);
  const [createId]=useState(()=>crypto.randomUUID());
  const detail=useDashboard<GatheringDetail>(`/${group.id}/gatherings/${meetingId}`,!!meetingId);
  const [date,setDate]=useState(taipeiToday());
  const roster=useDashboard<{key:string;name:string}[]>(`/${group.id}/roster?date=${date}`,!meetingId&&!!date);
  const [kind,setKind]=useState<'group'|'sunday'>('group');
  const [selected,setSelected]=useState<string[]>([]);
  const [draft,setDraft]=useState<GatheringDetail|null>(null);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(detail.data&&!dirty)setDraft(detail.data);},[detail.data,dirty]);
  function back(){if(dirty&&!window.confirm('放棄尚未儲存的出席記錄？'))return;close();}
  async function create(){setBusy(true);setError('');try{const result=await familyRequest<{id:string}>(`${base}/${group.id}/gatherings/${createId}`,'PUT',{date,kind,roster:selected});setDirty(false);setMeetingId(result.id);await saved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function save(){if(!draft)return;setBusy(true);setError('');try{await familyRequest(`${base}/${group.id}/gatherings/${meetingId}`,'PATCH',{version:draft.version,entries:draft.entries.map(e=>({key:e.key,status:e.status})),visitors:draft.visitors,cancelled:draft.cancelled});setDirty(false);await saved();await detail.refetch();close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const blocked=detail.isError||roster.isError;
  return <section className="space-y-5 [overflow-wrap:anywhere]"><UnsavedChangesGuard dirty={dirty}/><Button variant="ghost" disabled={busy} onClick={back}><ArrowLeft className="mr-2 h-4 w-4"/>返回牧養概況</Button><div><p className="text-sm text-primary">{group.name}</p><h2 className="mt-1 text-xl font-semibold">{meetingId?'記錄聚會出席':'新增聚會記錄'}</h2></div>
    {blocked?<Problem message={(detail.error||roster.error)?.message||'無法讀取'} retry={()=>{void detail.refetch();void roster.refetch();}}/>:meetingId ? !draft?<p role="status">載入中…</p>:<>
      <p className="text-sm text-muted-foreground">{draft.date} · {gatheringKinds[draft.kind]} · 當次名單 {draft.entries.length} 人</p><p className="text-sm leading-6 text-muted-foreground">未確認的人保留「未填」。訪客另外計數。</p>
      <fieldset disabled={busy||draft.cancelled} className="divide-y border-y">{draft.entries.map(entry=><div key={entry.key} className="py-4"><p className="mb-2 font-medium">{entry.name}</p><div role="group" aria-label={`${entry.name}的出席狀態`} className="grid grid-cols-4 gap-1.5">{Object.entries(attendanceLabels).map(([status,label])=><button key={status} type="button" aria-pressed={entry.status===status} onClick={()=>{setDirty(true);setDraft({...draft,entries:draft.entries.map(e=>e.key===entry.key?{...e,status:status as AttendanceStatus}:e)});}} className={`min-h-11 rounded-md border px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${entry.status===status?'border-primary bg-primary text-primary-foreground':'bg-background hover:bg-muted'}`}>{label}</button>)}</div></div>)}</fieldset>
      <label className="block max-w-xs space-y-2 text-sm"><span>訪客人數</span><Input type="number" min={0} max={10000} value={draft.visitors} disabled={busy||draft.cancelled} onChange={e=>{setDirty(true);setDraft({...draft,visitors:Number(e.target.value)});}}/></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.cancelled} disabled={busy} onChange={e=>{setDirty(true);setDraft({...draft,cancelled:e.target.checked});}}/>這次聚會取消（不列入出席摘要）</label>
      <Button className="w-full sm:w-auto" disabled={busy} onClick={()=>void save()}><Check className="mr-2 h-4 w-4"/>{busy?'儲存中…':'儲存出席'}</Button>
    </>:<>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="block min-w-0 space-y-2 text-sm"><span>聚會日期</span><Input type="date" className="max-w-full" max={taipeiToday()} value={date} disabled={busy} onChange={e=>{setDate(e.target.value);setSelected([]);setDirty(true);}}/></label><label className="block min-w-0 space-y-2 text-sm"><span>聚會類型</span><select className={familySelectClass} value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as typeof kind);setDirty(true);}}>{Object.entries(gatheringKinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      <div><h3 className="font-semibold">確認當次應出席名單</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">請確認當次應出席名單。補登過去聚會時，名單可能需要核對；現任領袖也會列出。建立後每個人都先保留「未填」。</p></div>
      {!roster.data?<p role="status">載入名單中…</p>:<fieldset disabled={busy} className="divide-y border-y"><label className="flex min-h-12 items-center gap-3 py-2 font-medium"><input type="checkbox" checked={!!roster.data.length&&selected.length===roster.data.length} onChange={e=>{setSelected(e.target.checked?roster.data!.map(m=>m.key):[]);setDirty(true);}}/>選取這份名單全部成員</label>{roster.data.map(m=><label key={m.key} className="flex min-h-12 items-center gap-3 py-2"><input type="checkbox" checked={selected.includes(m.key)} onChange={e=>{setSelected(e.target.checked?[...selected,m.key]:selected.filter(k=>k!==m.key));setDirty(true);}}/>{m.name}</label>)}</fieldset>}
      <Button className="w-full sm:w-auto" disabled={busy||!selected.length||!date} onClick={()=>void create()}>{busy?'建立中…':`建立並記錄出席（${selected.length} 人）`}</Button>
    </>}{error&&<div role="alert" className="space-y-3 rounded-lg border border-destructive p-4 text-sm"><p className="text-destructive">{error}</p>{meetingId&&<Button variant="outline" disabled={busy} onClick={async()=>{if(dirty&&!window.confirm('放棄本次修改，載入最新記錄？'))return;const result=await detail.refetch();if(result.data){setDraft(result.data);setDirty(false);setError('');}}}>重新載入最新記錄</Button>}</div>}
  </section>;
}
