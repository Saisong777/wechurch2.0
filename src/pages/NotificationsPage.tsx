import { churchFetch as fetch } from '@/lib/churchFetch';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, HandHeart, HeartHandshake, MessageCircle, RefreshCw, Settings } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, useReadNotification } from '@/hooks/useNotifications';
import { NotificationEmailSettings } from '@/components/notifications/NotificationEmailSettings';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { user,loading } = useAuth(); const navigate = useNavigate();
  const [cursors,setCursors] = useState<Array<string | null>>([null]);
  const query = useNotifications(cursors[cursors.length-1]); const read = useReadNotification();
  return <div className="min-h-screen bg-background"><Header title="通知" backTo="/" />
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><h1 className="text-2xl font-semibold">通知</h1>{user && <p role="status" className="mt-1 text-muted-foreground">{query.isError ? '暫時無法取得未讀數' : `${query.data?.unreadCount || 0} 則未讀`}</p>}</div>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" title="更新通知" aria-label="更新通知" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-5 w-5" /></Button><a href="#email-settings" className="flex h-11 w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring" title="通知設定" aria-label="通知設定"><Settings className="h-5 w-5" /></a></div>
      </div>
      {loading ? <p role="status" className="py-8">正在載入…</p> : !user ? <div className="py-8"><p>登入後即可查看你的通知。</p><Button asChild className="mt-4"><Link to="/login?returnTo=/notifications">登入</Link></Button></div> : <>
        {!!query.data?.unreadCount && !query.isError && <div className="flex justify-end py-2"><Button variant="ghost" disabled={read.isPending} onClick={async() => { try { await read.mutateAsync({before:query.data!.snapshotAt}); toast.success('已全部標為已讀'); } catch { toast.error('尚未更新，請重試'); } }}><CheckCheck className="mr-2 h-4 w-4" />全部標為已讀</Button></div>}
        {query.isPending && <p role="status" className="py-8">正在載入通知…</p>}
        {query.isError && <div role="alert" className="py-8"><p>通知暫時無法載入。</p><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>重新載入通知</Button></div>}
        {!query.isPending && !query.isError && !query.data?.items.length && <div className="py-12 text-center"><Bell className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-4 font-medium">目前沒有新通知</p><Button asChild variant="outline" className="mt-4"><Link to="/walls">看看分享牆</Link></Button></div>}
        {!query.isError && <ol className="divide-y">{query.data?.items.map(item => {
          const Icon = item.kind.endsWith('comment') ? MessageCircle : item.kind === 'prayer_reaction' ? HeartHandshake : HandHeart;
          return <li key={item.id}><Link to={item.href} aria-label={`${item.title}${item.readAt ? '，已讀' : '，未讀'}`} className={`flex min-h-24 items-center gap-3 px-2 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.readAt ? '' : 'bg-primary/5'}`}
            onClick={async event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (read.isPending) return; try { await read.mutateAsync({id:item.id}); navigate(item.href); } catch(e) { toast.error((e as Error).message); void query.refetch(); } }}>
            <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1"><span className={`block leading-7 ${item.readAt ? '' : 'font-semibold'}`}>{item.title}</span><time dateTime={item.createdAt} className="mt-1 block text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></span>
            {!item.readAt && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link></li>;
        })}</ol>}
        {!query.isError && (cursors.length > 1 || query.data?.nextCursor) && <div className="flex items-center justify-center gap-3 py-5"><Button variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors(c => c.slice(0,-1))}>上一頁</Button><Button variant="outline" disabled={!query.data?.nextCursor || query.isFetching} onClick={() => setCursors(c => [...c,query.data!.nextCursor])}>下一頁</Button></div>}
        <NotificationEmailSettings />
      </>}
    </main>
  </div>;
}
