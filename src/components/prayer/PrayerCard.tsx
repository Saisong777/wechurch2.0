import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Trash2, User, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Prayer, useDeletePrayer, useToggleAmen, useTogglePinPrayer, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
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
  thanksgiving: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  supplication: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  praise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  other: 'bg-muted text-muted-foreground',
};

export const PrayerCard: React.FC<PrayerCardProps> = ({ prayer }) => {
  const { isAdmin } = useUserRole();
  const deleteMutation = useDeletePrayer();
  const toggleAmenMutation = useToggleAmen();
  const togglePinMutation = useTogglePinPrayer();

  const canDelete = prayer.is_owner || isAdmin;
  const canPin = prayer.is_owner;

  const handleToggleAmen = () => {
    toggleAmenMutation.mutate({
      prayerId: prayer.id,
      hasAmened: prayer.has_amened,
    });
  };

  const handleTogglePin = () => {
    togglePinMutation.mutate({
      prayerId: prayer.id,
      isPinned: prayer.is_pinned,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(prayer.id);
  };

  const timeAgo = formatDistanceToNow(new Date(prayer.created_at), {
    addSuffix: true,
    locale: zhTW,
  });

  return (
    <Card className={cn(
      "transition-all hover:shadow-md overflow-hidden",
      prayer.is_pinned && "ring-2 ring-amber-400 dark:ring-amber-500"
    )}>
      <CardContent className="p-0">
        {/* Category Banner with Pin indicator */}
        <div className={cn('px-4 py-2 flex items-center justify-between', CATEGORY_COLORS[prayer.category] || CATEGORY_COLORS.other)}>
          <span className="text-xs font-medium">{CATEGORY_LABELS[prayer.category]}</span>
          {prayer.is_pinned && (
            <span className="flex items-center gap-1 text-xs font-medium">
              <Pin className="h-3 w-3" />
              置頂
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                {prayer.author_avatar ? (
                  <AvatarImage src={prayer.author_avatar} alt={prayer.author_name} />
                ) : null}
                <AvatarFallback
                  className={cn(
                    prayer.is_anonymous
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {prayer.is_anonymous ? (
                    <User className="h-5 w-5" />
                  ) : (
                    prayer.author_name.charAt(0).toUpperCase()
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <p
                  className={cn(
                    'font-medium text-sm',
                    prayer.is_anonymous && 'text-muted-foreground italic'
                  )}
                >
                  {prayer.author_name}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Pin Button */}
              {canPin && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          prayer.is_pinned 
                            ? "text-amber-500 hover:text-amber-600" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={handleTogglePin}
                        disabled={togglePinMutation.isPending}
                      >
                        <Pin className={cn("h-4 w-4", prayer.is_pinned && "fill-current")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {prayer.is_pinned ? '取消置頂' : '置頂禱告'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Delete Button */}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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

          {/* Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{prayer.content}</p>

          {/* Footer - Amen Button and Comments Toggle */}
          <div className="flex items-center justify-between pt-2">
            {/* Comments Toggle - Left Side */}
            <PrayerComments prayerId={prayer.id} />

            {/* Amen Button - Right Side */}
            <Button
              variant={prayer.has_amened ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleAmen}
              disabled={toggleAmenMutation.isPending}
              className={cn(
                'gap-2 transition-all',
                prayer.has_amened &&
                  'bg-rose-500 hover:bg-rose-600 text-white border-rose-500'
              )}
            >
              <Heart
                className={cn('h-4 w-4 transition-all', prayer.has_amened && 'fill-current')}
              />
              <span>阿門</span>
              {prayer.amen_count > 0 && (
                <span className="bg-background/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                  {prayer.amen_count}
                </span>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
