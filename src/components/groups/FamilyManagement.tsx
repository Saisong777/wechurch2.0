import { churchFetch as fetch } from '@/lib/churchFetch';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { familyBase, familyRequest as request, useFamilyQuery, familySelectClass as selectClass } from '@/lib/familyApi';
import { familyAudiences, familyStatuses, matchingStatuses, type FamilyRequest, type ManagedFamily } from '@shared/family';
import type { GroupMember } from '@shared/lifeGroup';
import { toast } from 'sonner';
import { groupLeaderNames } from '@/lib/groupLeaders';
import { churchDisplayName } from '@shared/churches';

type Management = { groups: ManagedFamily[]; requests: FamilyRequest[]; churches: { id: string; name: string }[] };
export function FamilyManagement({ initialGroup = null }: { initialGroup?: string | null }) {
  const q = useFamilyQuery<Management>('/management');
  const [editing, setEditing] = useState<string | null>(initialGroup), [name, setName] = useState(''), [church, setChurch] = useState('');
  const [audience, setAudience] = useState('unspecified'), [listed, setListed] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const client = useQueryClient();
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); await client.invalidateQueries({ queryKey: [familyBase] }); await client.invalidateQueries({ queryKey: ['crm-groups'] }); await client.invalidateQueries({ queryKey: ['access-control-admin'] }); await client.invalidateQueries({ queryKey: ['access-control-me'] }); await client.invalidateQueries({ queryKey: ['unified-members'] }); toast.success('小家資料已更新'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (q.isError) return <div role="alert"><p>{q.error.message}</p><Button variant="outline" onClick={() => void q.refetch()}>重新載入</Button></div>;
  if (!q.data) return <p role="status">載入小家管理…</p>;
  const data = q.data;
  const selected = data.groups.find(g => g.id === editing);
  return <section className="space-y-6 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">小家管理</h2><Button asChild variant="outline"><Link to="/groups">我的小家<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <section className="space-y-3 border-b pb-4"><h3 className="font-semibold">待審核加入 · {data.groups.reduce((sum, g) => sum + (g.pendingRequestCount || 0), 0)}</h3>{data.groups.filter(g => (g.pendingRequestCount || 0) > 0).map(g => <Button key={g.id} variant="outline" onClick={() => setEditing(g.id)}>{g.name} · {g.pendingRequestCount} 位申請人<ArrowRight className="ml-2 h-4 w-4" /></Button>)}</section>
    {selected && <FamilyEditor key={`${selected.id}:${selected.version}`} group={selected} groups={data.groups} busy={busy} act={act} close={() => setEditing(null)} />}
    <section className="space-y-4"><h3 className="font-semibold">等待安排 <span className="text-muted-foreground">{data.requests.length}</span></h3>{!data.requests.length && <p className="text-sm text-muted-foreground">目前沒有你負責範圍內的待安排申請。</p>}{data.requests.map(r => <MatchingReview key={`${r.id}:${r.version}`} item={r} groups={data.groups} busy={busy} act={act} />)}</section>
    {!!data.churches.length && <details className="border-y py-4"><summary className="cursor-pointer font-medium">開啟新小家</summary><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void act(async () => { await request('/management', 'POST', { name, church: church || data.churches[0].id, audience, listed }); setName(''); }); }}><label className="min-w-0 space-y-2 text-sm">小家名稱<Input required value={name} maxLength={160} onChange={e => setName(e.target.value)} /></label><label className="min-w-0 space-y-2 text-sm">所屬教會<select className={selectClass} value={church || data.churches[0].id} onChange={e => setChurch(e.target.value)}>{data.churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="space-y-2 text-sm">小家類型<select className={selectClass} value={audience} onChange={e => setAudience(e.target.value)}>{Object.entries(familyAudiences).map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={listed} onChange={e => setListed(e.target.checked)} />公開簡介，開放申請加入</label><Button className="w-fit" disabled={busy || !name.trim()}><Plus className="mr-2 h-4 w-4" />建立小家</Button></form></details>}
    <ul className="divide-y">{data.groups.map(g => <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-medium">{g.name}</h3><p className="text-sm text-muted-foreground">{churchDisplayName(g.church)} · {familyStatuses[g.status]} · {g.memberCount} 位成員{g.listed && ' · 開放申請'}</p><p className="text-sm text-muted-foreground">小家長：{groupLeaderNames(g)}</p>{!g.leaderId&&!g.coLeaderId&&g.status!=='archived'&&<p className="text-sm text-muted-foreground">尚未綁定小家長帳號；填寫姓名後仍須指派已加入的成員。</p>}</div><Button variant={editing === g.id ? 'secondary' : 'outline'} onClick={() => setEditing(editing === g.id ? null : g.id)}>設定與成員異動</Button></li>)}</ul>
    {!data.groups.length && <p className="text-muted-foreground">目前沒有可管理的小家。</p>}
  </section>;
}
type Act = (work: () => Promise<unknown>) => Promise<void>;
function MatchingReview({ item, groups, busy, act }: { item: FamilyRequest; groups: ManagedFamily[]; busy: boolean; act: Act }) {
  const [groupId, setGroupId] = useState(''), [message, setMessage] = useState('');
  const update = (status: 'contacting' | 'matched' | 'cancelled') => act(() => request(`/management/matching/${item.id}`, 'PATCH', { version: item.version, status, groupId: groupId || null, message }));
  return <article className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{item.name || '新朋友'}</h4><span className="text-sm text-muted-foreground">{matchingStatuses[item.status]}</span></div><p className="text-sm">{churchDisplayName(item.church)} · {item.availability} · {item.region || '未指定地區'}</p><p className="text-sm">聯繫：{item.contact}</p>{item.ownerName && <p className="text-sm">承接同工：{item.ownerName}</p>}
    <label className="block space-y-2 text-sm">回覆申請人<Input maxLength={500} value={message} onChange={e => setMessage(e.target.value)} /></label>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void update('contacting')}>{item.ownerName ? '接手聯繫並更新' : '由我聯繫'}</Button><select aria-label={`為 ${item.name || '新朋友'} 安排小家`} className={`${selectClass} sm:max-w-64`} value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">選擇小家</option>{groups.filter(g => g.status === 'active' && g.church === item.church).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><Button disabled={busy || !groupId} onClick={() => void update('matched')}>送交小家長確認</Button><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm('確認取消此安排？')) void update('cancelled'); }}>取消安排</Button></div>
  </article>;
}
function FamilyEditor({ group, groups, busy, act, close }: { group: ManagedFamily; groups: ManagedFamily[]; busy: boolean; act: Act; close: () => void }) {
  const q = useFamilyQuery<{ members: GroupMember[]; requests: { id: string; name: string; message?: string; createdAt?: string }[]; canChangeLeader: boolean; history: { action: string; name: string; actorName: string; reason: string; targetName: string; createdAt: string }[] }>(`/management/${group.id}`);
  const [form, setForm] = useState({ version: group.version, name: group.name, description: group.description, meeting: group.meeting, audience: group.audience || 'unspecified', announcement: group.announcement, listed: group.listed, status: group.status, leaderId: group.leaderId, coLeaderId: group.coLeaderId ?? null });
  const [member, setMember] = useState(''), [target, setTarget] = useState(''), [reason, setReason] = useState('');
  const actions: Record<string,string> = { created: '開啟小家', joined: '加入', declined: '未通過申請', left: '自行退出', removed: '移出', transferred_in: '轉入', transferred_out: '轉出', leader_changed: '小家長交接', leaders_changed: '共同小家長交接', settings: '更新設定' };
  const duplicateLeaders = !!form.leaderId && form.leaderId === form.coLeaderId;
  const leadershipChanged = form.leaderId !== group.leaderId || form.coLeaderId !== (group.coLeaderId ?? null);
  const selectedLeaderNames = [form.leaderId,form.coLeaderId].filter(Boolean).map(id => q.data?.members.find(member => member.id === id)?.name || (id === group.leaderId ? group.leaderName : group.coLeaderName) || '已指派帳號').join('、') || '尚未指派';
  const save = () => {
    if (duplicateLeaders || (leadershipChanged && !q.data?.canChangeLeader)) return;
    if (leadershipChanged && !window.confirm(`確認更新 ${group.name} 的小家長？\n原本：${groupLeaderNames(group)}\n更新為：${selectedLeaderNames}\n兩位小家長有相同的小家管理權；不再負責的人仍是小家成員，額外授權不會自動撤回。`)) return;
    void act(() => request(`/management/${group.id}`, 'PATCH', form));
  };
  return <section className="space-y-5 border-t pt-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{group.name}</h3><Button variant="ghost" size="icon" aria-label="關閉小家設定" title="關閉小家設定" onClick={close}><X className="h-4 w-4" /></Button></div>
    {!!q.data?.requests.length && <section aria-label="待審核加入" className="space-y-3"><h4 className="font-semibold">加入申請</h4>{q.data.requests.map(r => <div key={r.id} className="space-y-3 border-b py-3"><p className="font-medium">{r.name}</p>{r.createdAt && <p className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString('zh-TW')}</p>}{r.message && <p className="whitespace-pre-wrap">{r.message}</p>}<div className="flex flex-wrap gap-2">{[true,false].map(approve => <Button key={String(approve)} disabled={busy || group.status !== 'active'} variant={approve ? 'default' : 'outline'} onClick={() => void act(() => request(`/management/${group.id}/requests/${r.id}`, 'POST', { approve }))}>{approve ? '同意加入' : '婉拒'}</Button>)}</div></div>)}</section>}
    <form onSubmit={e => { e.preventDefault(); save(); }}><fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">小家名稱<Input required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="space-y-2 text-sm">小家類型<select className={selectClass} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as typeof form.audience })}>{Object.entries(familyAudiences).map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label className="space-y-2 text-sm">聚會時間與地區（公開簡介）<Input maxLength={200} value={form.meeting} onChange={e => setForm({ ...form, meeting: e.target.value })} /></label>
      <label className="space-y-2 text-sm sm:col-span-2">小家簡介（公開）<Textarea maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label className="space-y-2 text-sm sm:col-span-2">置頂公告（僅小家成員可見）<Textarea rows={3} maxLength={2000} value={form.announcement} onChange={e => setForm({ ...form, announcement: e.target.value })} /></label>
      <label className="space-y-2 text-sm">狀態<select className={selectClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as typeof form.status })}>{Object.entries(familyStatuses).map(([v,label]) => <option key={v} value={v} disabled={v==='archived'&&!q.data?.canChangeLeader}>{label}</option>)}</select></label>
      {q.data?.canChangeLeader && <>
        <label className="space-y-2 text-sm">小家長（一）<select className={selectClass} value={form.leaderId || ''} onChange={e => setForm({ ...form, leaderId: e.target.value || null })}><option value="">尚未指派</option>{q.data.members.filter(m => m.id !== form.coLeaderId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="space-y-2 text-sm">小家長（二）<select className={selectClass} value={form.coLeaderId || ''} onChange={e => setForm({ ...form, coLeaderId: e.target.value || null })}><option value="">尚未指派</option>{q.data.members.filter(m => m.id !== form.leaderId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">最多可由兩位不同成員共同負責，兩位具有相同的小家管理權。此處只列出已加入的帳號；尚未登入的負責人，請先確認身分並加入小家，再指派。</p>
        {leadershipChanged && <p role="status" className="text-sm leading-6 text-primary sm:col-span-2">儲存後，小家長將更新為：{selectedLeaderNames}。撤下的小家長仍保留成員身分；其他角色與額外授權不會自動改變。</p>}
        {duplicateLeaders && <p role="alert" className="text-sm text-destructive sm:col-span-2">請選擇兩位不同成員。</p>}
      </>}
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.listed} onChange={e => setForm({ ...form, listed: e.target.checked })} />在小家名單開放申請（仍須確認加入）</label>
      <Button className="w-fit" type="submit" disabled={duplicateLeaders || (leadershipChanged && !q.data?.canChangeLeader)}><Save className="mr-2 h-4 w-4" />儲存小家設定</Button>
    </fieldset></form>
    {q.isError && <div role="alert"><p>{q.error.message}</p><Button variant="outline" onClick={() => void q.refetch()}>重試成員資料</Button></div>}
    {q.data && <><div className="flex flex-wrap items-center gap-3 border-t pt-4"><h4 className="font-semibold">成員與申請</h4></div>
      <ul className="divide-y text-sm">{q.data.members.map(m => <li key={m.id} className="py-2">{m.name}{m.id === group.leaderId || m.id === group.coLeaderId ? ' · 小家長' : m.manager ? ' · 負責同工' : ''}</li>)}</ul>
      <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); if (window.confirm(target ? '確認轉家？原小家的內容不會搬移，原小家權限將立即解除。' : '確認退出小家？帳號與私人筆記會保留。')) void act(async () => { await request(`/management/${group.id}/move`, 'POST', { userId: member, targetGroupId: target || null, reason }); setMember(''); setReason(''); }); }}>
        <h4 className="font-semibold">轉家或退出</h4><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm">異動成員<select required className={selectClass} value={member} onChange={e => setMember(e.target.value)}><option value="">選擇成員</option>{q.data.members.filter(m => !m.manager).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="space-y-2 text-sm">異動方式<select className={selectClass} value={target} onChange={e => setTarget(e.target.value)}><option value="">退出目前小家</option>{groups.filter(g => g.id !== group.id && g.status === 'active' && g.church === group.church).map(g => <option key={g.id} value={g.id}>轉至 {g.name}</option>)}</select></label></div>
        <label className="block space-y-2 text-sm">異動原因（限管理同工）<Input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><Button disabled={busy || !member || !reason.trim()} variant="outline">確認異動</Button>
      </form><details className="border-t pt-4"><summary className="cursor-pointer font-medium">異動紀錄</summary><ul className="mt-3 divide-y text-sm">{q.data.history.map((e,i) => <li key={i} className="space-y-1 py-3"><p>{actions[e.action] || e.action} · {e.name || group.name}{e.targetName && ` · ${e.targetName}`}</p><p className="text-muted-foreground">{e.actorName} · {new Date(e.createdAt).toLocaleString('zh-TW')}</p>{e.reason && <p>{familyStatuses[e.reason as keyof typeof familyStatuses] || e.reason}</p>}</li>)}</ul></details></>}
  </section>;
}
