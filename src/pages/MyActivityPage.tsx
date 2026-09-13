import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { useSupportAccess } from '@/components/support/SupportPanel';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { supportStatusLabels, type SupportRequest } from '@shared/support';
import type { MentoringContract } from '@shared/mentoring';

function ActivitySource({ title, path, href, kind }: { title: string; path: string; href: string; kind: 'support' | 'mentor' }) {
  const { user } = useAuth();
  const query = useQuery<{ requests?:SupportRequest[]; contracts?:MentoringContract[]; hasMore:boolean }>({
    queryKey:['my-activity',user?.id,path],enabled:!!user,retry:false,staleTime:0,refetchInterval:30000,
    queryFn:async({signal})=>{const res=await fetch(path,{signal,credentials:'include'});if(!res.ok)throw new Error('暫時無法載入');return res.json();},
  });
  const items = kind === 'support' ? (query.data?.requests || []).map(r=>({id:r.id,title:r.title,detail:supportStatusLabels[r.status],href:`${href}?support=${r.id}`}))
    : (query.data?.contracts || []).filter(c=>c.status==='pending').map(c=>({id:c.id,title:c.courseName,detail:`${c.learnerName} · 等待接受`,href:`${href}?contract=${c.id}`}));
  return <section className="space-y-3 border-b pb-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><Link className="inline-flex min-h-11 items-center gap-2 text-sm text-primary" to={href}>查看全部<ArrowRight className="h-4 w-4" /></Link></div>
    {query.isError ? <div role="alert"><p>暫時無法確認這一類事項。</p><Button variant="outline" onClick={()=>query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />重新載入</Button></div> : query.isPending ? <p role="status">載入中…</p> : <>
      {!items.length ? <p className="text-sm text-muted-foreground">目前列表沒有待處理事項。</p> : <ul className="divide-y">{items.map(item=><li key={item.id}><Link to={item.href} className="flex min-h-14 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div><ArrowRight className="h-4 w-4 shrink-0" /></Link></li>)}</ul>}
      {query.data?.hasMore && <p className="text-sm text-muted-foreground">還有其他事項，請進入完整列表。</p>}
    </>}
  </section>;
}

export default function MyActivityPage() {
  const { user,loading }=useAuth(); const access=useSupportAccess(); const flags=useFeatureToggles();
  return <><Header variant="compact" title="待回應" backTo="/" /><main className="mx-auto max-w-3xl space-y-5 px-4 py-6 [overflow-wrap:anywhere]">
    <h1 className="text-xl font-semibold">待回應</h1>
    {loading ? <p role="status">確認登入中…</p> : !user ? <Button asChild><Link to="/login?returnTo=%2Fme%2Factivity">登入後繼續</Link></Button> : <>
      <ActivitySource title="我的求助與陪伴" path="/api/support/requests?mode=personal&filter=waiting" href="/support" kind="support" />
      {access.isError && <p role="alert">同工權限暫時無法確認，請至同工工作區重試。</p>}
      {access.data?.canWork && <ActivitySource title="交給我的事項" path="/api/support/requests?mode=work&filter=active" href="/work" kind="support" />}
      {flags.isFeatureEnabled('pastoral_beta') && <ActivitySource title="陪伴邀請" path="/api/mentoring/contracts?mode=mentor" href="/work/mentoring" kind="mentor" />}
      <nav aria-label="其他待辦" className="flex flex-wrap gap-5 text-sm text-primary"><Link className="min-h-11 py-3" to="/groups">小組分享與關懷</Link><Link className="min-h-11 py-3" to="/care">我的關懷清單</Link><Link className="min-h-11 py-3" to="/me/sharing">我的分享</Link></nav>
    </>}
  </main></>;
}
