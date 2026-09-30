import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LocalDevotionalNote } from '@/lib/localDevotionalNotes';
import { parseCategories, parseNotes } from '@/types/spiritual-fitness';

export function NoteConflictReview({ note, owner, busy, onRebase }: {
  note: LocalDevotionalNote; owner: string; busy: boolean;
  onRebase: (cloud: LocalDevotionalNote) => void;
}) {
  const [cloud, setCloud] = useState<LocalDevotionalNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!note.syncStatus || note.syncStatus === 'synced' || note.id.startsWith('local-devotional-')) return null;
  async function compare() {
    setLoading(true); setError(''); setCloud(null);
    try {
      const response = await fetch(`/api/devotional-notes/${encodeURIComponent(note.id)}`, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('無法取得雲端筆記，請確認登入及連線後重試。');
      const data = await response.json();
      if (data.id !== note.id || data.userId !== owner || !Number.isInteger(data.version) || data.version < 1) throw new Error('無法確認筆記版本，原稿仍保留。');
      setCloud(data);
    } catch (err) { setError(err instanceof Error ? err.message : '讀取失敗，請重試'); }
    finally { setLoading(false); }
  }
  return <section className="space-y-3 border-y py-3 text-sm" aria-label="筆記版本確認">
    <p>這份筆記尚未同步。你的輸入保留在下方。</p>
    <Button type="button" variant="outline" disabled={busy || loading} onClick={compare}>{loading ? '正在讀取…' : '查看雲端版本'}</Button>
    {error && <p role="alert">{error}</p>}
    {cloud && <>
      <h3 className="font-semibold">雲端版本 {cloud.version}</h3>
      <div className="max-h-64 overflow-auto whitespace-pre-wrap break-words leading-7">{[cloud.titlePhrase,cloud.heartbeatVerse,cloud.observation,Object.values(parseNotes(cloud.coreInsightNote || null,parseCategories(cloud.coreInsightCategory || null))).join('\n'),cloud.scholarsNote,cloud.actionPlan,cloud.coolDownNote].filter(Boolean).join('\n\n')}</div>
      <p>請先將要保留的雲端內容合併到下方。確認後再次儲存，才會更新雲端。</p>
      <Button type="button" variant="outline" disabled={busy || loading} onClick={() => {
        if (!window.confirm('已對照並合併內容？下一次儲存會以目前輸入更新這個雲端版本。')) return;
        onRebase(cloud); setCloud(null);
      }}>已合併，保留目前輸入</Button>
    </>}
  </section>;
}
