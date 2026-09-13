import { apiRequest, ApiError } from './queryClient';
import { LocalDevotionalNote, removeLocalDevotionalNote, upsertLocalDevotionalNote } from './localDevotionalNotes';

export type NoteSaveResult = { note: LocalDevotionalNote; status: 'synced' | 'pending' | 'blocked' };

export async function saveDevotionalNote(userId: string, input: LocalDevotionalNote): Promise<NoteSaveResult> {
  if (!userId || (input.userId && input.userId !== userId)) throw new Error('請重新登入後再儲存');
  const draft: LocalDevotionalNote = {
    ...input, userId, syncStatus: 'pending',
    clientMutationId: input.clientMutationId || crypto.randomUUID(),
  };
  // Save a recoverable, account-scoped draft before attempting a network write.
  upsertLocalDevotionalNote(draft, userId);
  const { id, userId: _owner, syncStatus: _status, createdAt: _created, updatedAt: _updated, ...payload } = draft;
  try {
    const response = id.startsWith('local-devotional-')
      ? await apiRequest('POST', '/api/devotional-notes', payload)
      : await apiRequest('PATCH', `/api/devotional-notes/${encodeURIComponent(id)}`, payload);
    const saved = await response.json();
    if (!saved?.id || saved.userId !== userId) throw new Error('Invalid save confirmation');
    const note: LocalDevotionalNote = { ...draft, ...saved, syncStatus: 'synced' };
    upsertLocalDevotionalNote(note, userId);
    if (id !== note.id) removeLocalDevotionalNote(id, userId);
    return { note, status: 'synced' };
  } catch (error) {
    const status = error instanceof ApiError && error.status >= 400 && error.status < 500 ? 'blocked' : 'pending';
    const note: LocalDevotionalNote = { ...draft, syncStatus: status };
    upsertLocalDevotionalNote(note, userId);
    return { note, status };
  }
}

export function noteSaveMessage(status: NoteSaveResult['status']) {
  if (status === 'synced') return '已同步儲存';
  if (status === 'blocked') return '尚未同步，請確認登入、權限或其他裝置的修改；草稿保留在此裝置';
  return '草稿已存於此裝置，尚未同步；連線恢復後請再按儲存';
}
