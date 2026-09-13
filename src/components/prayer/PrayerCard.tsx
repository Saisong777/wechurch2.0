import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Trash2, User, Pin, PartyPopper, Check, BookOpen, CalendarCheck2, HandHeart, HeartHandshake, Sprout, AlertCircle } from 'lucide-react';
import { REACTION_LABELS, isUrgentPrayer, isClosedPrayer, type PrayerReaction } from '@shared/prayerInteraction';
import { usePrayerReaction, useUrgentPrayer, useClosePrayer } from '@/hooks/usePrayerWall';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Prayer, useDeletePrayer, useToggleAmen, useTogglePinPrayer, useMarkPrayerAnswered, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { useUserRole } from '@/hooks/useUserRole';
import { cn, vibrate } from '@/lib/utils';
import { PrayerComments } from './PrayerComments';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PrayerCardProps {
  prayer: Prayer;
}

const CATEGORY_COLORS: Record<string, string> = {
  thanksgiving: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  supplication: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300',
  praise: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  other: 'border-border bg-muted text-muted-foreground',
};

export const PrayerCard: React.FC<PrayerCardProps> = ({ prayer }) => {
  const { isAdmin } = useUserRole();
  const deleteMutation = useDeletePrayer();
  const toggleAmenMutation = useToggleAmen();
  const togglePinMutation = useTogglePinPrayer();
  const markAnsweredMutation = useMarkPrayerAnswered();
  const reactionMutation = usePrayerReaction();
  const urgentMutation = useUrgentPrayer();
  const closeMutation = useClosePrayer();
  const closed = isClosedPrayer(prayer);

  const canDelete = prayer.isOwner || isAdmin;
  const canPin = prayer.isOwner && !closed;
  const canMarkAnswered = prayer.isOwner && !closed;

  const handleToggleAmen = () => {
    vibrate(50);
    toggleAmenMutation.mutate({
      prayerId: prayer.id,
      hasAmened: prayer.hasAmened,
    });
  };

  const handleTogglePin = () => {
    togglePinMutation.mutate({
      prayerId: prayer.id,
      isPinned: prayer.isPinned,
    });
  };

  const handleMarkAnswered = () => {
    if (!window.confirm('標記為蒙應允並移出公開牆？本人仍可查看紀錄。')) return;
    markAnsweredMutation.mutate({
      prayerId: prayer.id,
      isAnswered: prayer.isAnswered,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(prayer.id);
  };

  const timeAgo = formatDistanceToNow(new Date(prayer.createdAt), {
    addSuffix: true,
    locale: zhTW,
  });

  return (
    <article
      aria-label={`代禱：${prayer.content.split('\n')[0]}`}
      className={cn(
        'bg-card transition-colors hover:bg-muted/20',
        prayer.isAnswered && 'bg-emerald-50/30 dark:bg-emerald-950/10'
      )}
    >
      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[11rem_minmax(16rem,1fr)_8.5rem_13rem] lg:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 ring-2 ring-background">
              {prayer.authorAvatar ? (
                <AvatarImage src={prayer.authorAvatar} alt={prayer.authorName} />
              ) : null}
              <AvatarFallback
                className={cn(
                  'text-xs',
                  prayer.isAnonymous
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {prayer.isAnonymous ? <User className="h-4 w-4" /> : prayer.authorName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-semibold', prayer.isAnonymous && 'italic text-muted-foreground')}>
                {prayer.authorName}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarCheck2 className="h-3.5 w-3.5" />
                {timeAgo}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isUrgentPrayer(prayer) && <Badge className="gap-1 bg-red-700 text-white"><AlertCircle className="h-3 w-3" />緊急代禱</Badge>}
            <Badge variant="outline" className={cn('rounded-full border px-2 py-0.5 text-xs', CATEGORY_COLORS[prayer.category] || CATEGORY_COLORS.other)}>
              {CATEGORY_LABELS[prayer.category]}
            </Badge>
            {prayer.isPinned && (
              <Badge variant="outline" className="gap-1 rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                <Pin className="h-3 w-3 fill-current" />
                置頂
              </Badge>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {prayer.content}
          </p>
          {prayer.scriptureReference && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-1.5">
              <BookOpen className="h-4 w-4 flex-shrink-0 text-primary" />
              <p className="truncate text-sm font-medium text-primary">{prayer.scriptureReference}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-center">
          {prayer.isAnswered ? (
            <Badge className="gap-1 rounded-full bg-emerald-500 text-white">
              <PartyPopper className="h-3 w-3" />
              已蒙應允
            </Badge>
          ) : closed ? <Badge variant="outline">已結束 · 僅本人可見</Badge> : (
            <Badge variant="outline" className="rounded-full">
              守望中
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end lg:grid lg:grid-cols-2">
          {!closed && <Button
            variant={prayer.hasAmened ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleAmen}
            disabled={toggleAmenMutation.isPending || prayer.hasAmened}
            className={cn(
              'h-9 rounded-lg gap-1.5',
              prayer.hasAmened && 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600'
            )}
          >
            <HandHeart className="h-4 w-4" />
            {prayer.hasAmened ? '已代禱' : '阿門'}
            {prayer.amenCount > 0 && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-bold', prayer.hasAmened ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>
                {prayer.amenCount}
              </span>
            )}
          </Button>}

          {canMarkAnswered && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg gap-1.5"
                    onClick={handleMarkAnswered}
                    disabled={markAnsweredMutation.isPending}
                  >
                    <Check className={cn('h-4 w-4', prayer.isAnswered && 'text-emerald-600')} />
                    {prayer.isAnswered ? '恢復' : '應允'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {prayer.isAnswered ? '取消應允標記' : '標記為已蒙應允'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {canPin && (
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-9 rounded-lg gap-1.5', prayer.isPinned ? 'text-amber-600' : 'text-muted-foreground')}
              onClick={handleTogglePin}
              disabled={togglePinMutation.isPending}
            >
              <Pin className={cn('h-4 w-4', prayer.isPinned && 'fill-current')} />
              {prayer.isPinned ? '取消' : '置頂'}
            </Button>
          )}

          {prayer.isOwner && !closed && <Button variant="ghost" size="sm" className="h-9 gap-1.5" aria-pressed={!!prayer.isUrgent} disabled={urgentMutation.isPending} onClick={()=>urgentMutation.mutate({prayerId:prayer.id,isUrgent:!prayer.isUrgent})}><AlertCircle className="h-4 w-4" />{prayer.isUrgent?'解除緊急':'標記緊急'}</Button>}
          {prayer.isOwner && <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={closeMutation.isPending} onClick={()=>{if(window.confirm(closed?'重新公開此代禱與原有回應，邀請大家繼續守望？':'結束這則代禱並移出公開牆？本人仍可查看紀錄。'))closeMutation.mutate({prayerId:prayer.id,isClosed:!closed});}}><Check className="h-4 w-4" />{closed?'重新公開':'結束代禱'}</Button>}

          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 rounded-lg gap-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  刪除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要刪除這個禱告嗎？</AlertDialogTitle>
                  <AlertDialogDescription>此操作無法復原。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    刪除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="border-t bg-muted/10 px-3 py-2 sm:px-4">
        {!closed && <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="關懷回應">{(Object.keys(REACTION_LABELS) as PrayerReaction[]).map(kind=>{
          const reaction=prayer.reactions?.find(r=>r.kind===kind);
          const Icon={heart:Heart,support:HeartHandshake,strength:Sprout}[kind];
          return <Button key={kind} variant={reaction?.selected?'secondary':'ghost'} size="sm" className="min-w-20 gap-1.5" aria-pressed={!!reaction?.selected} title={`${reaction?.selected?'撤回':'送出'}${REACTION_LABELS[kind]}`} disabled={reactionMutation.isPending} onClick={()=>reactionMutation.mutate({prayerId:prayer.id,kind,selected:!reaction?.selected})}><Icon className={cn('h-4 w-4',kind==='heart'?'text-rose-600':kind==='support'?'text-teal-700':'text-green-700',reaction?.selected && kind==='heart' && 'fill-current')} />{REACTION_LABELS[kind]}<span className="inline-block w-4 tabular-nums">{reaction?.count || 0}</span></Button>;
        })}</div>}
        <PrayerComments prayerId={prayer.id} count={prayer.commentCount} anonymousOwner={prayer.isOwner && prayer.isAnonymous} readOnly={closed} />
      </div>
    </article>
  );
};
