import { churchFetch as fetch } from '@/lib/churchFetch';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/queryClient';
import { mergeLocalDevotionalNotes, type LocalDevotionalNote } from '@/lib/localDevotionalNotes';

type NoteIdentity = Pick<LocalDevotionalNote, 'id' | 'verseReference' | 'updatedAt' | 'userId'>;

export function useDevotionalNotes<T extends NoteIdentity = LocalDevotionalNote>(userId?: string) {
  const [, refreshDrafts] = useState(0);
  useEffect(() => {
    const refresh = () => refreshDrafts(value => value + 1);
    window.addEventListener('wechurch:devotional-notes-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('wechurch:devotional-notes-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const query = useQuery<T[]>({
    queryKey: ['/api/devotional-notes', userId],
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/devotional-notes', { credentials: 'include', signal });
      if (!response.ok) throw new ApiError(response.status, '無法載入筆記');
      const notes = await response.json();
      if (!Array.isArray(notes) || notes.some(note => !note || typeof note.id !== 'string' || typeof note.verseReference !== 'string' || typeof note.updatedAt !== 'string')) throw new Error('筆記資料格式不正確');
      return notes as T[];
    },
  });
  // Failed refreshes must not replace cached server notes with an empty/local-only success.
  const data = mergeLocalDevotionalNotes(query.data || [], userId || '', query.isError);
  return { ...query, data };
}
