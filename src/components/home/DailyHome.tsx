import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Gamepad2, HandHeart, Heart, LockKeyhole, PenLine, Plus, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface DailyHomeProps {
  date: string;
  scripture: { reference: string; preview: string; href: string };
  readingState?: 'ready' | 'loading' | 'error' | 'unpublished';
  note?: { syncStatus?: 'pending' | 'blocked' | 'synced' };
  notesLoading: boolean;
  onOpenNote: () => void;
  signedIn: boolean;
  prayersLoading: boolean;
  prayersError: boolean;
  onRetryPrayers: () => void;
  prayerCount: number;
  prayer?: { title?: string; prayer?: string };
  careLoading: boolean;
  careUnavailable?: boolean;
  care?: { name: string; need: string; nextAction: string };
  showTools: boolean;
  showAdmin: boolean;
}

const quietLink = 'inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function DailyHome({
  date, scripture, readingState = 'ready', note, notesLoading, onOpenNote, signedIn,
  prayersLoading, prayersError, onRetryPrayers, prayerCount, prayer,
  careLoading, careUnavailable, care, showTools, showAdmin,
}: DailyHomeProps) {
  const hasDraft = note?.syncStatus === 'pending' || note?.syncStatus === 'blocked';

  return (
    <div className="mx-auto max-w-3xl pb-6 [overflow-wrap:anywhere]" data-testid="daily-home">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-5 text-sm text-muted-foreground">
        <p>愛神・愛人・門徒生活</p>
        <p>{date}</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-6"><Link to="/groups" className={quietLink}><Users className="h-4 w-4" />我的小組<ArrowRight className="h-4 w-4" /></Link><Link to="/walls" className={quietLink}>分享牆<ArrowRight className="h-4 w-4" /></Link>{signedIn && <Link to="/me/activity" className={quietLink}>待回應<ArrowRight className="h-4 w-4" /></Link>}</div>

      <section aria-labelledby="daily-devotion-title" className="border-b border-border pb-6">
        <h2 id="daily-devotion-title" className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
          今日靈修
        </h2>
        {readingState !== 'ready' ? <div className="mt-3 space-y-2"><p role="status" className="text-sm text-muted-foreground">{readingState === 'loading' ? '正在載入教會課表…' : readingState === 'error' ? '暫時無法載入教會課表' : '今天的靈修尚未發佈'}</p><Link to={scripture.href} className={quietLink}>查看每日靈修<ArrowRight className="h-4 w-4" /></Link></div> : <>
        <p className="mt-3 text-sm font-medium text-primary">{scripture.reference}</p>
        <p className="mt-2 max-w-2xl whitespace-pre-line text-base leading-7 text-foreground" data-testid="daily-scripture-preview">
          {scripture.preview}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button asChild className="min-h-11 gap-2 rounded-md" data-testid="start-daily-devotion">
            <Link to={scripture.href}>
              {note ? '繼續今日靈修' : '開始今日靈修'}
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </Button>
          {notesLoading ? <Skeleton className="h-5 w-24" aria-label="載入筆記狀態" /> : (
            <button type="button" onClick={onOpenNote} className={quietLink}>
              <PenLine aria-hidden="true" className="h-4 w-4 shrink-0" />
              {hasDraft ? '開啟草稿' : note ? '編輯筆記' : '寫筆記'}
            </button>
          )}
          <Link to="/learn/my-notes" className={quietLink}>回看筆記</Link>
        </div>
        {hasDraft && <p role="status" className="mt-2 text-sm text-amber-800">此裝置草稿，尚未同步</p>}
        </>}
      </section>

      <section aria-labelledby="daily-prayer-title" className="border-b border-border py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="daily-prayer-title" className="flex items-center gap-2 text-xl font-semibold">
            <Heart aria-hidden="true" className="h-5 w-5 shrink-0 text-secondary" />
            我的禱告
          </h2>
          <Button asChild variant="outline" className="min-h-11 gap-2 rounded-md">
            <Link to="/grace-record"><Plus aria-hidden="true" className="h-4 w-4 shrink-0" />新增禱告</Link>
          </Button>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />僅自己可見
        </p>
        {!signedIn ? (
          <Link to="/login" className={`${quietLink} mt-2`}>登入查看我的禱告<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        ) : prayersError ? (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-4">
            <p className="text-sm text-muted-foreground">暫時無法載入禱告</p>
            <button type="button" onClick={onRetryPrayers} className={quietLink}>重新載入</button>
          </div>
        ) : prayersLoading ? (
          <div role="status" aria-label="正在載入禱告" className="mt-3 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /></div>
        ) : prayer ? (
          <Link to="/grace-record" className="mt-3 block rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="line-clamp-1 font-medium">{prayer.title || '今天的禱告'}</p>
            {prayer.prayer && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{prayer.prayer}</p>}
            <span className="mt-2 inline-flex min-h-8 items-center gap-2 text-sm text-secondary">{prayerCount} 筆正在等候<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></span>
          </Link>
        ) : <p className="mt-3 text-sm text-muted-foreground">目前沒有正在等候的禱告。</p>}
        <div className="mt-2 flex flex-wrap gap-x-5">
          <Link to="/grace-record" className={quietLink}>禱告與恩典紀錄</Link>
        </div>
      </section>

      <section aria-labelledby="daily-care-title" className="border-b border-border py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="daily-care-title" className="flex items-center gap-2 text-xl font-semibold">
            <HandHeart aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
            今天關心誰
          </h2>
          <Link to="/care" className={quietLink}>{care ? '關懷清單' : '加入關心的人'}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
        {careLoading ? (
          <Skeleton className="mt-3 h-5 w-1/2" aria-label="正在載入關懷" />
        ) : careUnavailable ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">暫時無法確認關懷資料，請至關懷清單查看。</p>
        ) : care ? (
          <div className="mt-2">
            <p className="font-medium">{care.name}</p>
            {care.need && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{care.need}</p>}
            {care.nextAction && <p className="mt-2 line-clamp-2 text-sm leading-6">{care.nextAction}</p>}
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">{signedIn ? '還沒有待關心的對象。' : '登入查看你的關懷清單。'}</p>}
      </section>

      {(showTools || showAdmin) && (
        <nav aria-label="其他入口" className="flex flex-wrap items-center gap-x-6 pt-3">
          {showTools && <Link to="/play" className={quietLink} data-testid="link-module-action-tools-module"><Gamepad2 aria-hidden="true" className="h-4 w-4" />工具</Link>}
          {showAdmin && <Link to="/admin" className={quietLink} data-testid="link-module-action-host-module"><Settings aria-hidden="true" className="h-4 w-4" />主持與管理</Link>}
        </nav>
      )}
    </div>
  );
}
