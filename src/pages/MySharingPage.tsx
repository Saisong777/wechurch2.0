import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { PrayerDeliveries, usePrayerSharing } from '@/components/prayer/PersonalPrayerSharing';
import { useDevotionWall, useWithdrawDevotionShare } from '@/hooks/useDevotionWall';

export default function MySharingPage() {
  const {user,loading}=useAuth(); const prayers=usePrayerSharing(); const wall=useDevotionWall(false,true); const withdraw=useWithdrawDevotionShare();
  return <><Header title="我的分享" variant="compact" backTo="/me" /><main className="mx-auto max-w-3xl space-y-6 px-4 py-6 [overflow-wrap:anywhere]">
    <h1 className="text-xl font-semibold">我的分享</h1>
    {loading ? <p role="status">確認登入中…</p> : !user ? <Button asChild><Link to="/login?returnTo=%2Fme%2Fsharing">登入後繼續</Link></Button> : <>
      <section className="space-y-3 border-b pb-5"><h2 className="text-lg font-semibold">已分享的個人禱告</h2>
        {prayers.isError ? <div role="alert"><p>無法載入分享紀錄。</p><Button variant="outline" onClick={()=>prayers.refetch()}>重新載入</Button></div> : prayers.isPending ? <p role="status">載入中…</p> : !prayers.data?.length ? <p className="text-sm text-muted-foreground">目前沒有分享中的個人禱告。</p> : <ul className="divide-y">{prayers.data.map(item=><li className="space-y-2 py-4" key={`${item.prayerId}:${item.destination}`}><p className="font-medium line-clamp-2">{item.content?.split('\n')[0] || '已分享的代禱'}</p><details><summary className="min-h-11 cursor-pointer py-3 text-sm">查看分享內容</summary><p className="whitespace-pre-wrap leading-7">{item.content || '目前無法顯示內容，請進入分享對象確認。'}</p></details><PrayerDeliveries items={[item]} busy={prayers.withdraw.isPending} onWithdraw={share=>prayers.withdraw.mutate(share)} /></li>)}</ul>}
        <Link to="/grace-record" className="inline-flex min-h-11 items-center text-sm text-primary">查看私人原稿</Link>
      </section>
      <section className="space-y-3 border-b pb-5"><h2 className="text-lg font-semibold">今日公開靈修分享</h2>
        {wall.isError ? <div role="alert"><p>無法載入今日分享。</p><Button variant="outline" onClick={()=>wall.refetch()}>重新載入</Button></div> : wall.isPending ? <p role="status">載入中…</p> : !wall.posts.length ? <p className="text-sm text-muted-foreground">目前沒有今日公開分享。</p> : <ul className="divide-y">{wall.posts.map(post=><li key={post.id} className="space-y-2 py-4"><p className="font-medium">{post.title}</p><p className="text-sm text-muted-foreground">全站登入成員可見 · {post.anonymous?'匿名':'具名'}</p><details><summary className="min-h-11 cursor-pointer py-3 text-sm">查看分享內容</summary><p className="whitespace-pre-wrap leading-7">{post.body}</p></details><Button variant="outline" disabled={withdraw.isPending} onClick={()=>{if(window.confirm('撤回這則公開分享？私人筆記仍保留。'))withdraw.mutate(post.id);}}><Undo2 className="mr-2 h-4 w-4" />撤回分享</Button></li>)}</ul>}
      </section>
      <Link to="/groups" className="inline-flex min-h-11 items-center text-sm text-primary">查看小組內的筆記與代禱</Link>
    </>}
  </main></>;
}
