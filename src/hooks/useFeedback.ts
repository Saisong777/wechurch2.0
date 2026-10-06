import { useChurchScopeKey } from '@/contexts/ChurchContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { FeedbackRecord } from '@shared/feedback';

export type FeedbackCategory = 'bug' | 'suggestion' | 'question' | 'other';
export type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'done';
export type FeedbackPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type FeedbackItem = FeedbackRecord;
export const categoryLabels = { bug: '操作問題', suggestion: '改善建議', question: '使用疑問', other: '其他' };
export const statusLabels = { new: '已收到', reviewing: '處理中', planned: '已排入計畫', done: '已完成' };
export const priorityLabels = { P0: 'P0・立即處理', P1: 'P1・優先處理', P2: 'P2・正常安排', P3: 'P3・後續評估' };
export function useFeedbackItems(admin: boolean, userId?: string, filters = '') {
  const scope = useChurchScopeKey();
  const url = admin ? `/api/admin/feedback${filters}` : `/api/feedback/me${filters}`;
  return useQuery<{ items: FeedbackItem[]; hasMore?: boolean }>({ queryKey: [url, userId, scope], enabled: !!userId,
    queryFn: async () => (await apiRequest('GET', url)).json(), staleTime: 0 });
}
