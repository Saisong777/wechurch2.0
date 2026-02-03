import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';

export interface PrayerComment {
  id: string;
  prayer_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  is_owner: boolean;
}

export const usePrayerComments = (prayerId: string) => {
  return useQuery({
    queryKey: ['/api/prayers', prayerId, 'comments'],
    enabled: !!prayerId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ prayerId, content }: { prayerId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      await apiRequest('POST', `/api/prayers/${prayerId}/comments`, { content: content.trim() });
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
