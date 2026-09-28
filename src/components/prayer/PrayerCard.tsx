import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Trash2, User, Pin, Check, BookOpen, HandHeart, HeartHandshake, Sprout, AlertCircle, MoreHorizontal } from 'lucide-react';
import { REACTION_LABELS, isUrgentPrayer, isClosedPrayer, type PrayerReaction } from '@shared/prayerInteraction';
import { usePrayerReaction, useUrgentPrayer, useClosePrayer, type Prayer, useDeletePrayer, useToggleAmen, useTogglePinPrayer, useMarkPrayerAnswered, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { cn, vibrate } from '@/lib/utils';
import { PrayerComments } from './PrayerComments';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CATEGORY_COLORS: Record<string, string> = {
  thanksgiving: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  supplication: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300',
  praise: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  other: 'border-border bg-muted text-muted-foreground',
};

export const PrayerCard: React.FC<{ prayer: Prayer }> = ({ prayer }) => {
  const { isAdmin } = useUserRole();
  const deleteMutation = useDeletePrayer();
  const toggleAmenMutation = useToggleAmen();
  const togglePinMutation = useTogglePinPrayer();
  const markAnsweredMutation = useMarkPrayerAnswered();
  const reactionMutation = usePrayerReaction();
  const urgentMutation = useUrgentPrayer();
  const closeMutation = useClosePrayer();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const managementTrigger = useRef<HTMLButtonElement>(null);
  const closed = isClosedPrayer(prayer);
  const canDelete = prayer.isOwner || isAdmin;
  const managementBusy = deleteMutation.isPending || togglePinMutation.isPending || markAnsweredMutation.isPending || urgentMutation.isPending || closeMutation.isPending;

  return <article aria-label={`代禱：${prayer.content.split('\n')[0]}`} className="min-w-0 bg-card">
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            {prayer.authorAvatar && <AvatarImage src={prayer.authorAvatar} alt={prayer.authorName} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{prayer.isAnonymous ? <User className="h-4 w-4" /> : prayer.authorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0"><p className="break-words text-sm font-semibold">{prayer.authorName}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(prayer.createdAt), { addSuffix: true, locale: zhTW })}</p></div>
        </div>
        {canDelete && <DropdownMenu>
          <DropdownMenuTrigger asChild><Button ref={managementTrigger} variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="管理禱告" title="管理禱告"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {prayer.isOwner && <>
              {!closed && <>
                <DropdownMenuItem disabled={managementBusy} className="min-h-11 gap-2" onSelect={() => {
                  if (window.confirm('標記為蒙應允並移出公開牆？本人仍可查看紀錄。')) markAnsweredMutation.mutate({ prayerId: prayer.id, isAnswered: prayer.isAnswered });
                }}><Check className="h-4 w-4" />標記蒙應允</DropdownMenuItem>
                <DropdownMenuItem disabled={managementBusy} className="min-h-11 gap-2" onSelect={() => togglePinMutation.mutate({ prayerId: prayer.id, isPinned: prayer.isPinned })}><Pin className="h-4 w-4" />{prayer.isPinned ? '取消置頂' : '置頂'}</DropdownMenuItem>
                <DropdownMenuItem disabled={managementBusy} className="min-h-11 gap-2" onSelect={() => urgentMutation.mutate({ prayerId: prayer.id, isUrgent: !prayer.isUrgent })}><AlertCircle className="h-4 w-4" />{prayer.isUrgent ? '解除緊急' : '標記緊急'}</DropdownMenuItem>
              </>}
              <DropdownMenuItem disabled={managementBusy} className="min-h-11 gap-2" onSelect={() => {
                if (window.confirm(closed ? '重新公開此代禱與原有回應，邀請大家繼續守望？' : '結束這則代禱並移出公開牆？本人仍可查看紀錄。')) closeMutation.mutate({ prayerId: prayer.id, isClosed: !closed });
              }}><Check className="h-4 w-4" />{closed ? '重新公開' : '結束代禱'}</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>}
            <DropdownMenuItem disabled={managementBusy} className="min-h-11 gap-2 text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />刪除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className={CATEGORY_COLORS[prayer.category] || CATEGORY_COLORS.other}>{CATEGORY_LABELS[prayer.category]}</Badge>
        {isUrgentPrayer(prayer) && <Badge className="gap-1 bg-red-700 text-white"><AlertCircle className="h-3 w-3" />緊急代禱</Badge>}
        {prayer.isPinned && <Badge variant="outline" className="gap-1"><Pin className="h-3 w-3" />置頂</Badge>}
        <Badge variant="outline">{prayer.isAnswered ? '已蒙應允' : closed ? '已結束 · 僅本人可見' : '守望中'}</Badge>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{prayer.content}</p>
      {prayer.scriptureReference && <p className="flex items-start gap-2 text-sm text-primary"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" /><span className="[overflow-wrap:anywhere]">{prayer.scriptureReference}</span></p>}
    </div>
    <div className="space-y-2 border-t px-3 py-3 sm:px-4">
      {!closed && <div className="grid grid-cols-3 gap-1" role="group" aria-label="關懷回應">{(Object.keys(REACTION_LABELS) as PrayerReaction[]).map(kind => {
        const reaction = prayer.reactions?.find(r => r.kind === kind);
        const Icon = { heart: Heart, support: HeartHandshake, strength: Sprout }[kind];
        return <Button key={kind} variant={reaction?.selected ? 'secondary' : 'ghost'} size="sm" className="min-h-11 min-w-0 gap-1 px-1 text-xs sm:text-sm" aria-pressed={!!reaction?.selected} title={`${reaction?.selected ? '撤回' : '送出'}${REACTION_LABELS[kind]}`} disabled={reactionMutation.isPending} onClick={() => reactionMutation.mutate({ prayerId: prayer.id, kind, selected: !reaction?.selected })}><Icon className={cn('h-4 w-4', kind === 'heart' ? 'text-rose-600 dark:text-rose-300' : kind === 'support' ? 'text-teal-700 dark:text-teal-300' : 'text-green-700 dark:text-green-300', reaction?.selected && kind === 'heart' && 'fill-current')} />{REACTION_LABELS[kind]}<span className="tabular-nums">{reaction?.count || 0}</span></Button>;
      })}</div>}
      <div className="flex flex-wrap gap-2">
        {!closed && <Button variant="outline" className={cn('min-h-11 min-w-0 flex-1 gap-1.5 px-2', prayer.hasAmened && 'border-primary/30 bg-primary/10 text-primary disabled:opacity-100')} aria-pressed={prayer.hasAmened} disabled={toggleAmenMutation.isPending || prayer.hasAmened} onClick={() => { vibrate(50); toggleAmenMutation.mutate({ prayerId: prayer.id, hasAmened: prayer.hasAmened }); }}>
          {prayer.hasAmened ? <Check className="h-4 w-4" /> : <HandHeart className="h-4 w-4" />}{prayer.hasAmened ? '已為你禱告' : '為你禱告'}{prayer.amenCount > 0 && <span className="text-xs tabular-nums">{prayer.amenCount}</span>}
        </Button>}
        <PrayerComments prayerId={prayer.id} count={prayer.commentCount} anonymousOwner={prayer.isOwner && prayer.isAnonymous} readOnly={closed} />
      </div>
    </div>
    {canDelete && <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); managementTrigger.current?.focus(); }}>
        <AlertDialogHeader><AlertDialogTitle>確定要刪除這個禱告嗎？</AlertDialogTitle><AlertDialogDescription>此操作無法復原。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(prayer.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">刪除</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </article>;
};
