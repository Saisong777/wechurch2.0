import { churchFetch as fetch } from '@/lib/churchFetch';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HandHeart, KeyRound, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { familyBase, familyRequest as request, useFamilyQuery, familySelectClass } from '@/lib/familyApi';
import { familyAudiences, matchingStatuses, type FamilyDirectoryEntry, type FamilyRequest } from '@shared/family';
import { toast } from 'sonner';
import { groupLeaderNames } from '@/lib/groupLeaders';
import { churchDisplayName } from '@shared/churches';

export function FamilyJoinPanel({ token, setToken, join, joining }: { token: string; setToken: (s: string) => void; join: () => void; joining: boolean }) {
  const [mode, setMode] = useState<'matching' | 'directory' | 'invite'>(token ? 'invite' : 'directory');
  const [audience, setAudience] = useState('all'), [applying, setApplying] = useState<string | null>(null), [message, setMessage] = useState('');
  const [church, setChurch] = useState(''), [search, setSearch] = useState(''), [availability, setAvailability] = useState(''), [region, setRegion] = useState(''), [contact, setContact] = useState(''), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const q = useFamilyQuery<{ churches: { id: string; name: string }[]; selectedChurch: string; groups: FamilyDirectoryEntry[] }>(`/directory?church=${encodeURIComponent(church)}`);
  const matching = useFamilyQuery<FamilyRequest[]>('/matching');
  const client = useQueryClient();
  const selected = church || q.data?.selectedChurch || (q.data?.churches.length === 1 ? q.data.churches[0].id : '');
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); await client.invalidateQueries({ queryKey: [familyBase] }); toast.success('已更新申請'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const activeRequest = matching.data?.some(r => ['pending','contacting'].includes(r.status));
  return <section className="mt-6 space-y-5 border-t pt-6">
    <h2 className="text-xl font-semibold">尋找小家</h2>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{([['directory','瀏覽小家',Search],['matching','請同工幫我找',HandHeart],['invite','我有邀請碼',KeyRound]] as const).map(([value,label,Icon]) => <Button key={value} variant={mode === value ? 'secondary' : 'outline'} aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); }}><Icon className="mr-2 h-4 w-4" />{label}</Button>)}</div>
    {(q.isError || matching.isError) && <div role="alert"><p>申請資料載入失敗。</p><Button variant="outline" onClick={() => { void q.refetch(); void matching.refetch(); }}>重新載入</Button></div>}
    {mode !== 'invite' && q.data && (q.data.churches.length === 1 ? <p className="text-sm text-muted-foreground">{q.data.churches[0].name}</p> : <label className="block max-w-sm space-y-2 text-sm">教會<select aria-label="選擇教會" className={familySelectClass} value={selected} onChange={e => setChurch(e.target.value)}><option value="">請選擇教會</option>{q.data.churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
    {mode === 'matching' && <form className="max-w-xl space-y-4" onSubmit={e => { e.preventDefault(); void act(async () => { await request('/matching', 'POST', { church: selected, availability, region, contact, consent }); setContact(''); setConsent(false); }); }}><fieldset disabled={busy || !!activeRequest} className="space-y-4">
      <label className="block space-y-2 text-sm">方便聚會的時間<Input required maxLength={200} value={availability} onChange={e => setAvailability(e.target.value)} placeholder="例如週五晚上、週日下午" /></label>
      <label className="block space-y-2 text-sm">地區或線上需求（選填）<Input maxLength={200} value={region} onChange={e => setRegion(e.target.value)} /></label>
      <label className="block space-y-2 text-sm">方便聯繫的方式<Input required maxLength={200} value={contact} onChange={e => setContact(e.target.value)} placeholder="電子郵件、電話或 LINE ID" /></label>
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />同意讓負責安排小家的牧養同工使用上述資料聯繫我。</label>
      <Button disabled={!selected || !consent || !availability.trim() || !contact.trim() || q.isError || q.isPending}><Send className="mr-2 h-4 w-4" />請同工協助安排</Button>
    </fieldset></form>}
    {mode === 'directory' && <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="搜尋小家名稱" placeholder="搜尋小家名稱" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="小家類型" className={familySelectClass} value={audience} onChange={e => setAudience(e.target.value)}><option value="all">所有類型</option>{Object.entries(familyAudiences).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {q.isPending && <p role="status">載入開放申請的小家…</p>}
      {!q.isPending && !q.isError && !q.data?.groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()) && (audience === 'all' || (g.audience || 'unspecified') === audience)).length && <p className="py-4 text-sm text-muted-foreground">目前沒有符合條件的小家。可以改選類型，或請同工幫你安排。</p>}
      {q.data?.groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()) && (audience === 'all' || (g.audience || 'unspecified') === audience)).map(g => <article key={g.id} className="space-y-3 border-b py-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{g.name}</h3><span className="text-sm text-muted-foreground">{familyAudiences[g.audience || 'unspecified']}</span></div>
        <p className="text-sm text-muted-foreground">小家長：{groupLeaderNames(g)}</p>
        {g.description && <p className="whitespace-pre-wrap text-sm">{g.description}</p>}{g.meeting && <p className="text-sm text-muted-foreground">{g.meeting}</p>}
        {g.membershipStatus === 'approved' ? <Button asChild variant="outline"><Link to={`/groups/${g.id}`}>進入我的小家</Link></Button> : g.membershipStatus === 'pending' ? <div className="flex flex-wrap items-center gap-3"><span role="status">等待小家長審核</span><Button disabled={busy} variant="ghost" onClick={() => { if (window.confirm('撤回這次加入申請？')) void act(() => request(`/directory/${g.id}/join`, 'DELETE')); }}>撤回申請</Button></div> : applying === g.id ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { await request(`/directory/${g.id}/join`, 'POST', { message }); setApplying(null); setMessage(''); }); }}>
          <label className="block space-y-2 text-sm">想對小家長說的話（選填）<Textarea maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} placeholder="例如期待、方便參加的時間" /></label>
          <p className="text-sm text-muted-foreground">姓名與留言將交給此小家的負責同工審核。</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy}><Send className="h-4 w-4" />送出加入申請</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setApplying(null); setMessage(''); }}>取消</Button></div>
        </form> : <div className="flex flex-wrap items-center gap-3">{g.membershipStatus === 'rejected' && <p className="text-sm text-muted-foreground">申請未通過，可聯繫小家長或重新申請。</p>}<Button disabled={busy} variant="outline" onClick={() => { setApplying(g.id); setMessage(''); }}>{g.membershipStatus === 'rejected' ? '重新申請' : '申請加入'}</Button></div>}
      </article>)}
    </div>}
    {mode === 'invite' && <form className="max-w-xl space-y-3" onSubmit={e => { e.preventDefault(); join(); }}><label className="block space-y-2 text-sm">小家邀請碼<Input value={token} maxLength={48} required autoComplete="off" autoCapitalize="characters" onChange={e => setToken(e.target.value.trim())} /></label><Button disabled={joining || !token}>送出加入申請</Button></form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!!matching.data?.length && <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">我的安排進度</h3>{matching.data.map(r => <div key={r.id} className="space-y-2 border-b pb-3 text-sm"><p>{churchDisplayName(r.church)} · {matchingStatuses[r.status]}{r.groupName && ` · ${r.groupName}`}</p>{r.ownerName && <p>聯繫同工：{r.ownerName}</p>}{r.message && <p className="whitespace-pre-wrap">{r.message}</p>}{r.status === 'matched' && <p>等候小家長確認加入。</p>}{['pending','contacting'].includes(r.status) && <Button disabled={busy} size="sm" variant="outline" onClick={() => { if (window.confirm('取消這次安排申請？')) void act(() => request(`/matching/${r.id}`, 'DELETE')); }}>取消申請</Button>}</div>)}</section>}
  </section>;
}
