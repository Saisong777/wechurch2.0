import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchContext } from '@/contexts/ChurchContext';
import { useChooseInitialChurch, useChurchOnboarding } from '@/hooks/useChurchOnboarding';
import { Button } from '@/components/ui/button';

export function FirstChurchChoice() {
  const { user, refreshAuth } = useAuth();
  const church = useChurchContext();
  const status = useChurchOnboarding();
  const choose = useChooseInitialChurch();
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{churchId: string; requestId: string} | null>(null);
  const actor = useRef(user?.id); actor.current = user?.id;
  if (!user || church?.loading || (status.isPending && !status.isError)) return null;
  if (status.isError) return <section className="mx-auto max-w-2xl px-4 py-3" role="alert"><p>教會選擇狀態暫時無法確認。</p><Button variant="outline" className="mt-2" onClick={() => void status.refetch()}>重新確認選擇資格</Button></section>;
  const data = status.data;
  if (!data || data.reason === 'assigned') return null;
  if (!data.canChoose) return <section className="mx-auto max-w-2xl px-4 py-4"><h2 className="font-semibold">請管理者協助確認教會</h2><p className="mt-1 text-sm leading-6">你的帳號已有教會歸屬紀錄，變更需要管理者協助。個人筆記與聖經仍可使用。</p></section>;
  const name = data.choices.find(option => option.id === selected)?.name;
  const submit = async () => {
    if (!name || choose.isPending) return;
    const submittingActor = user.id;
    if (attempt.current?.churchId !== selected) attempt.current = {churchId: selected, requestId: crypto.randomUUID()};
    setMessage('');
    try {
      await choose.mutateAsync(attempt.current);
      if (actor.current !== submittingActor) return;
      await refreshAuth();
      if (actor.current !== submittingActor) return;
      await church?.refreshChurch();
      setConfirming(false);
    } catch (error) {
      if (actor.current !== submittingActor) return;
      setMessage((error as Error).message);
      await status.refetch();
    }
  };
  return <section aria-labelledby="initial-church-title" className="mx-auto my-3 max-w-2xl space-y-3 rounded-lg border border-primary/30 bg-background p-4 [overflow-wrap:anywhere]">
    <h2 id="initial-church-title" className="text-lg font-semibold">選擇你的教會</h2>
    <p className="text-sm leading-6">首次可以自行選擇一次。確認後，如需變更教會，請由管理者協助調整。</p>
    <label className="block space-y-1 text-sm">所屬教會<select aria-label="首次選擇所屬教會" className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3" value={selected} disabled={choose.isPending || confirming} onChange={event => {setSelected(event.target.value); setMessage('');}}>
      <option value="" disabled>請選擇所屬教會</option>{data.choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></label>
    {confirming ? <div className="space-y-3"><p role="status">確認加入「{name}」？之後需要管理者才能變更。</p><div className="flex flex-wrap gap-2"><Button disabled={choose.isPending} onClick={() => void submit()}>{choose.isPending ? '正在確認…' : '確認教會'}</Button><Button variant="outline" disabled={choose.isPending} onClick={() => setConfirming(false)}>返回選擇</Button></div></div> : <Button disabled={!name || choose.isPending} onClick={() => setConfirming(true)}>繼續確認</Button>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </section>;
}
