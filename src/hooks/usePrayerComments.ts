import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';

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

export const usePrayerComments = (prayerId: string) => {
  const { user } = useAuth();
  const userId = user ? ((user as any).legacyUserId || user.id) : undefined;

  return useQuery<PrayerComment[]>({
    queryKey: ['/api/prayers', prayerId, 'comments'],
    queryFn: async () => {
      const url = userId 
        ? `/api/prayers/${prayerId}/comments?userId=${userId}`
        : `/api/prayers/${prayerId}/comments`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
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
      const userId = (user as any).legacyUserId || user.id;
      await apiRequest('POST', `/api/prayers/${prayerId}/comments`, { 
        userId,
        content: content.trim() 
      });
    },
    onSuccess: (_, { prayerId }) => {
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
      await apiRequest('DELETE', `/api/prayers/${prayerId}/comments/${commentId}`);
      return prayerId;
    },
    onSuccess: (prayerId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prayers', prayerId, 'comments'] });
      toast.success('留言已刪除');
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast.error('刪除失敗');
    },
  });
};
