import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { usePrayerComments, useCreateComment, useDeleteComment } from '@/hooks/usePrayerComments';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface PrayerCommentsProps {
  prayerId: string;
}

export const PrayerComments: React.FC<PrayerCommentsProps> = ({ prayerId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const { data: comments, isLoading } = usePrayerComments(prayerId);
  const createMutation = useCreateComment();
  const deleteMutation = useDeleteComment();
  const { isAdmin } = useUserRole();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await createMutation.mutateAsync({ prayerId, content: newComment.trim() });
    setNewComment('');
  };

  const handleDelete = (commentId: string) => {
    deleteMutation.mutate({ commentId, prayerId });
  };

  const commentCount = comments?.length || 0;

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="h-4 w-4" />
        <span>留言</span>
        {commentCount > 0 && (
          <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs font-medium">
            {commentCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          留言 ({commentCount})
        </h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsExpanded(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 group">
              <Avatar className="h-8 w-8 flex-shrink-0">
                {comment.authorAvatar && (
                  <AvatarImage src={comment.authorAvatar} alt={comment.authorName} />
                )}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {comment.authorName?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{comment.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </span>
                  {(comment.isOwner || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-foreground break-words">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          還沒有留言，成為第一個留言的人吧！
        </p>
      )}

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="寫下你的鼓勵..."
          maxLength={200}
          className="flex-1 h-9"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9"
          disabled={!newComment.trim() || createMutation.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
