import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Plus, Save, Pencil, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppearanceControl } from '@/components/theme/AppearanceControl';
import { permissionKeys, permissionLabels, globalPermissions, type Permission, type AccessTemplate, type AccessGrant } from '@shared/accessControl';
import { crmRoleLabels } from '@/lib/crm-members';
import { churchDisplayName } from '@shared/churches';
import { toast } from 'sonner';

type Member={id:string;name:string;email:string;role:keyof typeof crmRoleLabels};
type Snapshot={church:string;isSystemAdmin:boolean;users:Member[];roles:AccessTemplate[];groups:{id:string;name:string}[];grants:AccessGrant[];
 history:{id:string;action:string;actorName:string;createdAt:string;before:unknown;after:unknown}[];
 legacyScopes:{id:string;userId:string;scopeName:string;canManageMembers:boolean;canManageCare:boolean;canViewPersonal:boolean}[];
 appointments:{id:string;name:string;leaderId:string;pastorId:string}[]};
const selectClass='min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
const scopeLabels={church:'所屬教會',group:'指定小家',member:'指定會員',site:'全站公共內容'};
const live=(g:AccessGrant)=>g.active && (!g.expiresAt || Date.parse(g.expiresAt)>Date.now());
async function api(path:string,method='GET',body?:unknown) {
 const r=await fetch('/api/access-control'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const result=await r.json();if(!r.ok)throw new Error(result.error || '無法完成設定');return result;
}
function PermissionChecks({value,onChange,allowed=permissionKeys,busy=false}:{value:Permission[];onChange:(v:Permission[])=>void;allowed?:readonly Permission[];busy?:boolean}) {
 return <fieldset disabled={busy} className="grid gap-x-5 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">工作權限</legend>{permissionKeys.map(p=><label key={p} className={`flex min-h-11 items-center gap-3 text-sm ${!allowed.includes(p)?'text-muted-foreground':''}`}><input type="checkbox" className="h-4 w-4 shrink-0 accent-primary" checked={value.includes(p)} disabled={!allowed.includes(p)} onChange={e=>onChange(e.target.checked?[...value,p]:value.filter(v=>v!==p))}/>{permissionLabels[p]}</label>)}</fieldset>;
}
function AuditValue({value,data}:{value:unknown;data:Snapshot}) {
 if(!value||typeof value!=='object')return <p className="text-muted-foreground">無</p>;
 const v=value as Record<string,unknown>;
 const user=data.users.find(u=>u.id===(v.userId||v.user_id));
 const role=data.roles.find(r=>r.id===(v.roleId||v.role_id));
 const target=data.groups.find(g=>g.id===(v.groupId||v.group_id))?.name || data.users.find(u=>u.id===(v.memberId||v.member_id))?.name;
 return <div className="space-y-1 break-words text-sm">
  {user&&<p>成員：{user.name}</p>}{!!(role||v.name)&&<p>職分：{role?.name||String(v.name)}</p>}
  {!!v.role&&<p>帳號角色：{crmRoleLabels[v.role as keyof typeof crmRoleLabels]||String(v.role)}</p>}
  {!!v.scope&&<p>範圍：{scopeLabels[v.scope as keyof typeof scopeLabels]}{target?' · '+target:''}</p>}
  {Array.isArray(v.permissions)&&<p>權限：{v.permissions.map(p=>permissionLabels[p as Permission]).filter(Boolean).join('、')||'無額外權限'}</p>}
  {Array.isArray(v.names)&&<p>職分：{v.names.join('、')}</p>}
  {!!v.reason&&<p>原因：{String(v.reason)}</p>}
  {!!(v.expiresAt||v.expires_at)&&<p>到期：{new Date(String(v.expiresAt||v.expires_at)).toLocaleString()}</p>}
 </div>;
}
function GrantEditor({data,member,initial,close,done}:{data:Snapshot;member:Member;initial?:AccessGrant;close:()=>void;done:()=>Promise<void>}) {
 const [roleId,setRole]=useState(initial?.roleId || data.roles.find(r=>r.name==='同工')?.id || data.roles[0]?.id || '');
 const [scope,setScope]=useState<AccessGrant['scope']>(initial?.scope || 'church');
 const [target,setTarget]=useState(initial?.groupId || initial?.memberId || '');
 const [permissions,setPermissions]=useState<Permission[]>(initial?.permissions || []);
 const [expiry,setExpiry]=useState(initial?.expiresAt?new Date(initial.expiresAt).toLocaleDateString('sv-SE'): '');
 const [reason,setReason]=useState(initial?.reason || '');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [requestId]=useState(()=>crypto.randomUUID());
 const allowed=permissionKeys.filter(p=>scope==='site'?globalPermissions.includes(p):!globalPermissions.includes(p) && (p!=='visits.manage' || scope==='church') && (p!=='groups.manage'||scope!=='member'));
 return <form className="space-y-4 border-y py-5" aria-label="編輯成員授權" onSubmit={async e=>{e.preventDefault();if(busy)return;
   if(!window.confirm(`確認${initial?'更新':'授予'}「${member.name}」的${data.roles.find(r=>r.id===roleId)?.name}職分與 ${permissions.length} 項權限？`))return;
   setBusy(true);setError('');try{await api(initial?'/grants/'+initial.id:'/grants',initial?'PUT':'POST',{
     userId:member.id,roleId,permissions,scope,church:data.church,groupId:scope==='group'?target:null,memberId:scope==='member'?target:null,
     expiresAt:expiry?new Date(expiry+'T23:59:59').toISOString():null,reason,...(initial?{version:initial.version}:{requestId})
   });await done();toast.success('職分與授權已儲存');close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <h3 className="font-semibold">{initial?'調整授權':'新增職分與授權'} · {member.name}</h3>
  <fieldset disabled={busy} className="min-w-0 space-y-4">
   <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm">職分<select aria-label="職分" className={selectClass} required disabled={!!initial} value={roleId} onChange={e=>{setRole(e.target.value);setPermissions([]);}}>{data.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label className="space-y-2 text-sm">管理範圍<select aria-label="管理範圍" className={selectClass} value={scope} onChange={e=>{setScope(e.target.value as AccessGrant['scope']);setTarget('');setPermissions([]);}}>{Object.entries(scopeLabels).filter(([k])=>k!=='site'||data.isSystemAdmin).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
   {scope==='site' && <p className="text-sm text-amber-700 dark:text-amber-300">影響全站公共內容，不限單一教會。</p>}
   {(scope==='group'||scope==='member') && <label className="block space-y-2 text-sm">指定對象<select aria-label="指定對象" required className={selectClass} value={target} onChange={e=>setTarget(e.target.value)}><option value="">請選擇</option>{(scope==='group'?data.groups:data.users).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
   <Button type="button" variant="outline" size="sm" disabled={!roleId} onClick={()=>setPermissions(data.roles.find(r=>r.id===roleId)?.permissions.filter(p=>allowed.includes(p)) || [])}>套用職分預設權限</Button>
   <PermissionChecks value={permissions} onChange={setPermissions} allowed={allowed}/>
   <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm">授權到期日（選填）<Input type="date" aria-label="授權到期日" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label><label className="block space-y-2 text-sm">異動原因<Input required maxLength={500} aria-label="異動原因" value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
   <p className="text-sm text-muted-foreground">{permissions.length===0?'只有職分標記，不新增管理權限。':'僅在所選範圍生效；個人未分享的筆記與禱告不開放。'}</p>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <div className="flex gap-2"><Button type="submit" disabled={!roleId}><Save className="mr-2 h-4 w-4"/>{busy?'儲存中…':'儲存授權'}</Button><Button type="button" variant="outline" onClick={close}>取消</Button></div>
  </fieldset>
 </form>;
}
function TemplateEditor({data,initial,done,close}:{data:Snapshot;initial?:AccessTemplate;done:()=>Promise<void>;close:()=>void}) {
 const[name,setName]=useState(initial?.name || '');const[permissions,setPermissions]=useState<Permission[]>(initial?.permissions || []);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 return <form className="space-y-4 border-y py-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api(initial?'/roles/'+initial.id:'/roles',initial?'PUT':'POST',{name,permissions,...(initial?{version:initial.version}:{church:data.church})});await done();close();toast.success('職分範本已儲存，既有授權未改動');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <fieldset disabled={busy} className="space-y-4"><label className="block space-y-2 text-sm">職分名稱<Input aria-label="職分名稱" required maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label>
  <PermissionChecks value={permissions} onChange={setPermissions} allowed={data.isSystemAdmin?permissionKeys:permissionKeys.filter(p=>!globalPermissions.includes(p))}/>
  <p className="text-sm text-muted-foreground">範本供下次授權使用，不會自動改動既有成員權限。</p>{error&&<p role="alert">{error}</p>}
  <div className="flex gap-2"><Button type="submit"><Save className="mr-2 h-4 w-4"/>儲存職分</Button><Button type="button" variant="outline" onClick={close}>取消</Button></div></fieldset>
 </form>;
}
export default function AccessControlPage(){
 const {user,loading}=useAuth();const {isAdmin,loading:roleLoading}=useUserRole();const client=useQueryClient();
 const [params]=useSearchParams();
 const [tab,setTab]=useState('members');const [search,setSearch]=useState('');const [memberId,setMember]=useState(params.get('member')||'');const [roleFilter,setRoleFilter]=useState('');
 const [editing,setEditing]=useState<AccessGrant|'new'|null>(null);const [template,setTemplate]=useState<AccessTemplate|'new'|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const q=useQuery<Snapshot>({queryKey:['access-control-admin',user?.id],enabled:!!user&&isAdmin,queryFn:()=>api(''),retry:false});
 const data=q.data; const selected=data?.users.find(m=>m.id===memberId);
 const done=async()=>{await q.refetch();await client.invalidateQueries({queryKey:['access-control-me']});await client.invalidateQueries({queryKey:['unified-members']});};
 async function act(work:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await work();await done();toast.success('設定已更新');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(loading||roleLoading)return <p className="p-6" role="status">確認權限中…</p>;
 if(!user||!isAdmin)return <main className="p-6"><p>限管理員與主任牧師使用。</p><Link to="/">返回首頁</Link></main>;
 const members=data?.users.filter(m=>(!search||`${m.name} ${m.email}`.toLowerCase().includes(search.toLowerCase()))&&(!roleFilter||data.grants.some(g=>g.userId===m.id&&g.roleId===roleFilter&&live(g)))) || [];
 return <div className="min-h-screen bg-background"><header className="border-b"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4"><Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="返回管理後台"><ArrowLeft className="h-5 w-5"/></Link></Button><ShieldCheck className="h-5 w-5 text-primary"/><h1 className="flex-1 text-xl font-semibold">角色與權限</h1><AppearanceControl/></div></header>
 <main className="mx-auto max-w-6xl space-y-5 px-4 py-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{churchDisplayName(data?.church)}</p><Button variant="ghost" size="icon" aria-label="重新載入權限" title="重新載入權限" onClick={()=>void done()}><RotateCcw className="h-4 w-4"/></Button></div>
 <div role="tablist" aria-label="權限管理分類" className="flex border-b">{[['members','成員授權'],['roles','職分範本'],['history','異動紀錄']].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={`min-h-11 flex-1 border-b-2 px-2 text-sm sm:flex-none sm:px-6 ${tab===key?'border-primary font-semibold text-primary':'border-transparent text-muted-foreground'}`} onClick={()=>{setTab(key);setEditing(null);setTemplate(null);}}>{label}</button>)}</div>
 {q.isPending&&<p role="status">載入中…</p>}{(error||q.isError)&&<p role="alert" className="text-sm text-destructive">{error||(q.error as Error)?.message}</p>}
 {data&&tab==='members'&&<div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]"><aside className="min-w-0 space-y-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" aria-label="搜尋成員" placeholder="搜尋姓名或 Email" value={search} onChange={e=>setSearch(e.target.value)}/></div><select className={selectClass} aria-label="篩選職分" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="">全部職分</option>{data.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><p className="text-xs text-muted-foreground">{members.length} 位成員</p><div className="max-h-64 overflow-y-auto divide-y md:max-h-[650px]">{members.map(m=><button key={m.id} className={`block min-h-14 w-full break-words px-3 py-3 text-left text-sm ${memberId===m.id?'bg-primary/10 text-primary':'hover:bg-muted'}`} onClick={()=>{setMember(m.id);setEditing(null);}}><span className="font-medium">{m.name}</span><span className="mt-1 block text-xs text-muted-foreground">{crmRoleLabels[m.role]}{data.grants.filter(g=>g.userId===m.id&&live(g)).map(g=>' · '+g.roleName).join('')}</span></button>)}</div></aside>
 <section className="min-w-0 space-y-5">{!selected?<p className="py-8 text-muted-foreground">選擇一位成員</p>:<><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selected.name}</h2><p className="break-all text-sm text-muted-foreground">{selected.email}</p></div><Button disabled={!data.roles.length||busy||!!editing} onClick={()=>setEditing('new')}><Plus className="mr-2 h-4 w-4"/>新增職分</Button></div>
 <details className="border-y py-3"><summary className="cursor-pointer text-sm font-medium">既有帳號角色：{crmRoleLabels[selected.role]}</summary><div className="mt-3 space-y-3"><p className="text-sm text-muted-foreground">此角色原有權限仍生效。要完全收回管理權，請一併檢查額外授權、小家職務與舊有授權。</p><select aria-label="既有帳號角色" className={selectClass} value={selected.role} disabled={busy||(!data.isSystemAdmin&&['admin','senior_pastor'].includes(selected.role))} onChange={e=>{const role=e.target.value;if(window.confirm(`將 ${selected.name} 的既有角色改為 ${crmRoleLabels[role as keyof typeof crmRoleLabels]}？`))void act(()=>api('/account-role/'+selected.id,'PUT',{role}));}}>{Object.entries(crmRoleLabels).filter(([k])=>k!=='leader'&&(data.isSystemAdmin||!['admin','senior_pastor'].includes(k)||k===selected.role)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div></details>
 {editing&&<GrantEditor key={editing==='new'?'new':editing.id} data={data} member={selected} initial={editing==='new'?undefined:editing} close={()=>setEditing(null)} done={done}/>}
 <div className="divide-y">{data.grants.filter(g=>g.userId===selected.id).map(g=><article key={g.id} className="space-y-3 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{g.roleName} <span className="text-xs font-normal text-muted-foreground">{live(g)?'生效中':g.active?'已到期':'已撤回'}</span></h3>{live(g)&&(data.isSystemAdmin||g.scope!=='site')&&<div className="flex gap-2"><Button size="icon" variant="ghost" aria-label={`編輯${g.roleName}授權`} title="編輯授權" disabled={busy} onClick={()=>setEditing(g)}><Pencil className="h-4 w-4"/></Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>{const reason=window.prompt(`撤回 ${g.roleName} 授權的原因（不影響其他授權）`);if(reason?.trim())void act(()=>api('/grants/'+g.id,'DELETE',{version:g.version,reason}));}}>撤回授權</Button></div>}</div><p className="text-sm text-muted-foreground">{scopeLabels[g.scope]} · {g.scope==='site'?'所有教會的公共內容':g.scopeName}{g.expiresAt&&` · ${new Date(g.expiresAt).toLocaleDateString()} 到期`}</p><ul className="grid gap-1 text-sm sm:grid-cols-2">{g.permissions.map(p=><li key={p}>{permissionLabels[p]}</li>)}</ul>{!g.permissions.length&&<p className="text-sm text-muted-foreground">職分標記，沒有額外管理權限</p>}</article>)}</div>
 {data.legacyScopes.filter(s=>s.userId===selected.id).map(s=><div key={s.id} className="space-y-2 border-t py-3 text-sm"><p>舊有授權 · {s.scopeName}</p><p className="text-muted-foreground">{[s.canManageMembers&&'會員管理',s.canManageCare&&'牧養關懷',s.canViewPersonal&&'個資欄位與已分享牧養資料'].filter(Boolean).join('、')}</p><Button variant="outline" size="sm" disabled={busy} onClick={()=>{if(window.confirm('撤回這筆舊有授權？其他角色和小家職務仍保留。'))void act(async()=>{const r=await fetch('/api/crm/scope-assignments/'+s.id,{method:'DELETE'});if(!r.ok)throw new Error('無法撤回舊有授權');});}}>撤回舊有授權</Button></div>)}
 {data.appointments.filter(g=>g.leaderId===selected.id||g.pastorId===selected.id).map(g=><p key={g.id} className="border-t py-3 text-sm">小家職務 · {g.name} <Link className="ml-2 underline" to="/groups?manage=1">前往小家管理</Link></p>)}
 </>}</section></div>}
 {data&&tab==='roles'&&<section className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={()=>setTemplate('new')}><Plus className="mr-2 h-4 w-4"/>新增職分</Button><Button variant="outline" disabled={busy} onClick={()=>void act(()=>api('/presets','POST',{church:data.church}))}>補齊預設職分</Button></div>{template&&<TemplateEditor key={template==='new'?'new':template.id} data={data} initial={template==='new'?undefined:template} done={done} close={()=>setTemplate(null)}/>}<div className="divide-y">{data.roles.map(r=><article key={r.id} className="flex items-center justify-between gap-3 py-4"><div><h2 className="font-semibold">{r.name}</h2><p className="mt-1 text-sm text-muted-foreground">{r.permissions.map(p=>permissionLabels[p]).join('、') || '預設不授予管理權限'}</p></div><Button variant="ghost" size="icon" aria-label={`編輯${r.name}範本`} title="編輯職分範本" disabled={!data.isSystemAdmin&&r.permissions.some(p=>globalPermissions.includes(p))} onClick={()=>setTemplate(r)}><Pencil className="h-4 w-4"/></Button></article>)}</div></section>}
 {data&&tab==='history'&&<section className="divide-y">{!data.history.length&&<p className="py-6 text-muted-foreground">尚無權限異動</p>}{data.history.map(h=><details key={h.id} className="py-4"><summary className="cursor-pointer text-sm"><span className="font-medium">{h.action}</span> · {h.actorName || '管理者'} · {new Date(h.createdAt).toLocaleString()}</summary><div className="mt-3 grid gap-4 border-l-2 pl-4 sm:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">變更前</h3><AuditValue value={h.before} data={data}/></div><div><h3 className="mb-2 text-sm font-semibold">變更後</h3><AuditValue value={h.after} data={data}/></div></div></details>)}</section>}
 </main></div>;
}
