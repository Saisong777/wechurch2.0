import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Trash2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Prayer, useDeletePrayer, useToggleAmen } from '@/hooks/usePrayerWall';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
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

export const PrayerCard: React.FC<PrayerCardProps> = ({ prayer }) => {
  const { isAdmin } = useUserRole();
  const deleteMutation = useDeletePrayer();
  const toggleAmenMutation = useToggleAmen();

  const canDelete = prayer.is_owner || isAdmin;

  const handleToggleAmen = () => {
    toggleAmenMutation.mutate({
      prayerId: prayer.id,
      hasAmened: prayer.has_amened,
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
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {prayer.author_avatar ? (
                <AvatarImage src={prayer.author_avatar} alt={prayer.author_name} />
              ) : null}
              <AvatarFallback className={cn(
                prayer.is_anonymous 
                  ? "bg-muted text-muted-foreground" 
                  : "bg-primary/10 text-primary"
              )}>
                {prayer.is_anonymous ? (
                  <User className="h-5 w-5" />
                ) : (
                  prayer.author_name.charAt(0).toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className={cn(
                "font-medium text-sm",
                prayer.is_anonymous && "text-muted-foreground italic"
              )}>
                {prayer.author_name}
              </p>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </div>

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
                  <AlertDialogDescription>
                    此操作無法復原。
                  </AlertDialogDescription>
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

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4">
          {prayer.content}
        </p>

        {/* Footer - Amen Button */}
        <div className="flex items-center justify-end">
          <Button
            variant={prayer.has_amened ? "default" : "outline"}
            size="sm"
            onClick={handleToggleAmen}
            disabled={toggleAmenMutation.isPending}
            className={cn(
              "gap-2 transition-all",
              prayer.has_amened && "bg-rose-500 hover:bg-rose-600 text-white border-rose-500"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-all",
                prayer.has_amened && "fill-current"
              )}
            />
            <span>阿門</span>
            {prayer.amen_count > 0 && (
              <span className="bg-background/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {prayer.amen_count}
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
