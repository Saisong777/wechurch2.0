import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

export function RestoreParticipantAccess({ participantId, name }: { participantId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return <>
    <Button size="icon" variant="ghost" title={`恢復 ${name} 的舊紀錄身份`} aria-label={`恢復 ${name} 的舊紀錄身份`} onClick={() => setOpen(true)}><KeyRound className="h-4 w-4" /></Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent><DialogHeader><DialogTitle>恢復 {name} 的舊紀錄</DialogTitle><DialogDescription>綁定後，這個登入帳號將可以查看此人的舊查經筆記。已有綁定的紀錄不會被覆蓋。</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={async event => {
          event.preventDefault(); setBusy(true);
          try {
            await apiRequest('POST', `/api/admin/participants/${participantId}/restore-access`, { email, reason, confirmed });
            toast.success('已恢復，請對方登入後查看筆記'); setOpen(false); setEmail(''); setReason(''); setConfirmed(false);
          } catch (error) { toast.error(error instanceof Error ? error.message : '恢復失敗'); }
          finally { setBusy(false); }
        }}>
          <Label htmlFor={`restore-email-${participantId}`}>對方的登入帳號</Label>
          <Input id={`restore-email-${participantId}`} type="email" required value={email} onChange={event => setEmail(event.target.value)} />
          <Label htmlFor={`restore-reason-${participantId}`}>身份確認依據</Label>
          <Input id={`restore-reason-${participantId}`} required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我已與本人確認，這是本人使用的登入帳號</label>
          <Button type="submit" disabled={busy || !confirmed}><KeyRound className="mr-2 h-4 w-4" />恢復身份</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
