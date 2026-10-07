import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchContext } from '@/contexts/ChurchContext';
import { useChooseInitialChurch, useChurchOnboarding } from '@/hooks/useChurchOnboarding';
import { Button } from '@/components/ui/button';

// A UI-only value; the API and stored affiliation use an explicit null.
const NO_CHURCH = '__choice_none';
export function FirstChurchChoice() {
  const { user, loading, refreshAuth, signOut } = useAuth();
  const church = useChurchContext();
  const status = useChurchOnboarding();
  const choose = useChooseInitialChurch();
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{churchId: string | null; requestId: string} | null>(null);
  const actor = useRef(user?.id); actor.current = user?.id;
  const logout = user && <Button variant="ghost" className="mt-3" disabled={choose.isPending} onClick={() => void signOut()}>登出</Button>;
  if (loading || church?.loading || user && !church?.error && status.isPending && !status.isError) return <section role="status" className="mx-auto max-w-2xl px-4 py-4"><p>正在確認教會選擇…</p>{logout}</section>;
  if (!user) return null;
  if (church?.error) return <section className="mx-auto max-w-2xl px-4 py-4" role="alert"><p>教會資料暫時無法確認。</p><Button variant="outline" className="mt-2" onClick={() => void church.refreshChurch()}>重新載入教會資料</Button>{logout}</section>;
  if (status.isError || !status.data) return <section className="mx-auto max-w-2xl px-4 py-4" role="alert"><p>教會選擇狀態暫時無法確認。</p><Button variant="outline" className="mt-2" onClick={() => void status.refetch()}>重新確認選擇資格</Button>{logout}</section>;
  const data = status.data;
  if (data.reason === 'assigned' || data.reason === 'no_church') return null;
  if (!data.canChoose) return <section className="mx-auto max-w-2xl px-4 py-4"><h2 className="font-semibold">請管理者協助確認教會</h2><p className="mt-1 text-sm leading-6">你的帳號已有教會歸屬紀錄，變更需要管理者協助。個人筆記與聖經仍可使用。</p></section>;
  const none = selected === NO_CHURCH;
  const name = none ? '目前沒有教會' : data.choices.find(option => option.id === selected)?.name;
  const submit = async () => {
    if (!name || choose.isPending) return;
    const submittingActor = user.id;
    const churchId = none ? null : selected;
    if (!attempt.current || attempt.current.churchId !== churchId) attempt.current = {churchId, requestId: crypto.randomUUID()};
    setMessage('');
    try {
      await choose.mutateAsync(attempt.current);
      if (actor.current !== submittingActor) return;
      const refreshedActor = await refreshAuth();
      if (actor.current !== submittingActor || refreshedActor?.id !== submittingActor) return;
      await church?.refreshChurch();
      setConfirming(false);
    } catch (error) {
      if (actor.current !== submittingActor) return;
      setMessage((error as Error).message);
      const recovered = await status.refetch();
      // The server may have committed the choice before its response was lost.
      // Only a verified completed choice can refresh the authenticated scope.
      if (!recovered.isError && recovered.data && ['assigned','no_church'].includes(recovered.data.reason) && actor.current === submittingActor) {
        const refreshedActor = await refreshAuth();
        if (actor.current !== submittingActor || refreshedActor?.id !== submittingActor) return;
        await church?.refreshChurch();
        setConfirming(false);
        setMessage('');
      }
    }
  };
  return <section aria-labelledby="initial-church-title" className="mx-auto my-3 max-w-2xl space-y-4 rounded-lg border border-primary/30 bg-background p-5 [overflow-wrap:anywhere]">
    <p className="text-sm text-muted-foreground">首次登入 · 確認教會歸屬</p>
    <h1 id="initial-church-title" className="text-xl font-semibold">選擇你的教會</h1>
    <p className="text-sm leading-6">請先確認你所屬的教會，讓分享牆、小家與讀經課表顯示正確的內容。若你目前沒有教會，也可以選擇下方的「目前沒有教會」。</p>
    <label className="block space-y-2 text-sm">所屬教會<select aria-label="首次選擇所屬教會" className="min-h-12 w-full min-w-0 rounded-md border border-input bg-background px-3" value={selected} disabled={choose.isPending || confirming} onChange={event => {setSelected(event.target.value); setMessage('');}}>
      <option value="" disabled>請選擇所屬教會或目前沒有教會</option>{data.choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}<option value={NO_CHURCH}>目前沒有教會</option>
    </select></label>
    {confirming ? <div className="space-y-3"><p role="status">{none?'確認「目前沒有教會」？你可以使用個人筆記與聖經，日後加入教會請由管理者協助。':`確認加入「${name}」？之後需要管理者才能變更。`}</p><div className="flex flex-wrap gap-2"><Button disabled={choose.isPending} onClick={() => void submit()}>{choose.isPending ? '正在確認…' : '確認教會'}</Button><Button variant="outline" disabled={choose.isPending} onClick={() => setConfirming(false)}>返回選擇</Button></div></div> : <Button disabled={!name || choose.isPending} onClick={() => setConfirming(true)}>繼續確認</Button>}
    <p className="text-sm leading-6 text-muted-foreground">首次可以自行選擇一次。確認後，如需變更教會，請由管理者協助調整。</p>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    {logout}
  </section>;
}
