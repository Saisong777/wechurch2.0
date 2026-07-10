import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';

const LOCAL_COMMENTS_STORAGE_KEY = 'wechurch_local_prayer_comments_v1';

export interface PrayerComment {
  id: string;
  prayerId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  isOwner: boolean;
}

function getUserId(user: any) {
  return user?.legacyUserId || user?.id || 'local-user';
}

function getUserName(user: any) {
  return user?.user_metadata?.display_name || user?.email?.split('@')[0] || '我';
}

function loadLocalComments(): PrayerComment[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalComments(comments: PrayerComment[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_COMMENTS_STORAGE_KEY, JSON.stringify(comments));
}

function createLocalComment(prayerId: string, content: string, user: any): PrayerComment {
  return {
    id: `local-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    prayerId,
    userId: getUserId(user),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    authorName: getUserName(user),
    authorAvatar: user?.user_metadata?.avatar_url || null,
    isOwner: true,
  };
}

function upsertLocalComment(comment: PrayerComment) {
  const current = loadLocalComments();
  saveLocalComments([comment, ...current.filter((item) => item.id !== comment.id)]);
}

function deleteLocalComment(commentId: string) {
  saveLocalComments(loadLocalComments().filter((comment) => comment.id !== commentId));
}

export const usePrayerComments = (prayerId: string) => {
  const { user } = useAuth();
  const userId = user ? getUserId(user) : undefined;

  return useQuery<PrayerComment[]>({
    queryKey: ['/api/prayers', prayerId, 'comments'],
    queryFn: async () => {
      const url = userId 
        ? `/api/prayers/${prayerId}/comments?userId=${userId}`
        : `/api/prayers/${prayerId}/comments`;
      const localComments = loadLocalComments()
        .filter((comment) => comment.prayerId === prayerId)
        .map((comment) => ({
          ...comment,
          isOwner: comment.userId === userId,
        }));

      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return localComments;

        const remoteComments = (await response.json()) as PrayerComment[];
        return [
          ...remoteComments,
          ...localComments.filter((localComment) => !remoteComments.some((remoteComment) => remoteComment.id === localComment.id)),
        ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } catch {
        return localComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    },
    enabled: !!prayerId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, content }: { prayerId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      const userId = getUserId(user);
      const trimmedContent = content.trim();
      const localComment = createLocalComment(prayerId, trimmedContent, user);

      try {
        if (prayerId.startsWith('local-prayer-')) throw new Error('Local prayer comment');
        const response = await apiRequest('POST', `/api/prayers/${prayerId}/comments`, {
          userId,
          content: trimmedContent,
        });
        const created = await response.json();
        return {
          ...localComment,
          ...created,
          authorName: created.authorName || localComment.authorName,
          authorAvatar: created.authorAvatar || localComment.authorAvatar,
          isOwner: true,
        } as PrayerComment;
      } catch (error) {
        upsertLocalComment(localComment);
        return localComment;
      }
    },
    onSuccess: (comment, { prayerId }) => {
      upsertLocalComment(comment);
      queryClient.setQueryData<PrayerComment[]>(['/api/prayers', prayerId, 'comments'], (current = []) => [
        ...current.filter((item) => item.id !== comment.id),
        comment,
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      queryClient.invalidateQueries({ queryKey: ['/api/prayers', prayerId, 'comments'] });
      toast.success('留言已發布');
    },
    onError: (error) => {
      console.error('Error creating comment:', error);
      toast.error('留言失敗');
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, prayerId }: { commentId: string; prayerId: string }) => {
      deleteLocalComment(commentId);
      if (commentId.startsWith('local-comment-')) {
        return prayerId;
      }
      try {
        await apiRequest('DELETE', `/api/prayers/${prayerId}/comments/${commentId}`);
      } catch {
        // Keep the local copy removed so the user's list does not resurrect stale comments.
      }
      return prayerId;
    },
    onSuccess: (prayerId, { commentId }) => {
      queryClient.setQueryData<PrayerComment[]>(['/api/prayers', prayerId, 'comments'], (current = []) =>
        current.filter((comment) => comment.id !== commentId)
      );
      queryClient.invalidateQueries({ queryKey: ['/api/prayers', prayerId, 'comments'] });
      toast.success('留言已刪除');
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast.error('刪除失敗');
    },
  });
};
