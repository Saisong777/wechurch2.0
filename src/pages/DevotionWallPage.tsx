import { Link } from 'react-router-dom';
import { BookOpen,RefreshCw,Undo2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Button } from '@/components/ui/button';
import { PublicWallTabs } from '@/components/prayer/PublicWallTabs';
import { useDevotionWall,useWithdrawDevotionShare } from '@/hooks/useDevotionWall';
import { useAuth } from '@/contexts/AuthContext';

export default function DevotionWallPage() {
  const {user}=useAuth();const wall=useDevotionWall();const withdraw=useWithdrawDevotionShare();
  return <FeatureGate featureKeys={['we_share','we_learn']} title="靈修牆維護中" description="請稍後再試"><div className="min-h-screen bg-background"><Header title="分享牆" backTo="/" /><main className="container mx-auto px-3 py-6 sm:px-6">
    <PublicWallTabs /><section className="mx-auto max-w-3xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 text-teal-700" />今日靈修牆</h1><p className="mt-2 text-sm text-muted-foreground">{!wall.expired && wall.data?.day} · 台灣時間每日 00:00 換日</p><p className="mt-1 text-sm text-muted-foreground">全站登入成員可見；換日後公開分享移除，個人筆記仍保留。</p></div><Button variant="outline" size="icon" aria-label="更新靈修牆" title="更新靈修牆" disabled={wall.isFetching} onClick={()=>wall.refetch()}><RefreshCw className={`h-4 w-4 ${wall.isFetching?'animate-spin':''}`} /></Button></header>
      {!user ? <p>請先<Link to="/login" className="ml-1 underline">登入</Link>，查看今日分享。</p> : <>
        <Button asChild variant="outline"><Link to="/learn/my-notes"><BookOpen className="mr-2 h-4 w-4" />從我的筆記選擇分享</Link></Button>
        {wall.isPending && <p role="status">正在載入今日分享…</p>}
        {wall.isError && <p role="alert" className="text-sm text-destructive">無法載入今日靈修，請重新整理。舊分享不會繼續公開顯示。</p>}
        {wall.expired && <p role="status" className="text-sm">已經換日，正在確認今天的分享。</p>}
        {!wall.isPending && !wall.isError && !wall.expired && !wall.posts.length && <div className="border-y py-10 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-teal-700" /><h2 className="font-medium">今天還沒有靈修分享</h2><Button asChild variant="link" className="mt-2"><Link to="/learn/church-reading">讀今天的經文</Link></Button></div>}
        <div className="space-y-4">{wall.posts.map(post=><article key={post.id} aria-label={`靈修分享：${post.title}`} className="rounded-lg border bg-card p-4 sm:p-5 [overflow-wrap:anywhere]">
          <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-medium">{post.authorName}</span><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit'}).format(new Date(post.createdAt))}</span></div>
          <h2 className="text-lg font-semibold">{post.title}</h2><p className="mt-1 text-sm text-teal-700">{post.reference}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{post.body}</p>
          {post.isOwner && <div className="mt-4 flex justify-end border-t pt-3"><Button variant="ghost" size="sm" className="gap-2" disabled={withdraw.isPending} onClick={()=>{if(window.confirm('撤回這篇公開分享？個人筆記不受影響。'))withdraw.mutate(post.id);}}><Undo2 className="h-4 w-4" />撤回分享</Button></div>}
        </article>)}</div>
      </>}
    </section></main></div></FeatureGate>;
}
