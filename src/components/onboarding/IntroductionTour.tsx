import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TOUR_KEY, introductionEvent, guideSteps } from '@/lib/introduction';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const dismissedInMemory = new Set<string>();
function hasDismissed(key: string) { try { return dismissedInMemory.has(key) || localStorage.getItem(key) === 'done'; } catch { return dismissedInMemory.has(key); } }
export function IntroductionTour() {
  const { loading, user } = useAuth();
  const { pathname, search, hash } = useLocation();
  const completionKey = `${TOUR_KEY}:${user?.id || 'guest'}`;
  const [open, setOpen] = useState(false); const [step, setStep] = useState(0);
  const finish = () => { dismissedInMemory.add(completionKey); try { localStorage.setItem(completionKey, 'done'); } catch { /* Still dismiss for this app session. */ } setOpen(false); };
  useEffect(() => {
    // Never interrupt an editing, login, invitation, or deep-link flow.
    if (pathname !== '/' || search || hash) { setOpen(false); return; }
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && (active.matches('input, textarea, select') || active.isContentEditable);
    if (!loading && !editing && !document.querySelector('[role="dialog"]') && !hasDismissed(completionKey)) { setStep(0); setOpen(true); }
  }, [loading, pathname, search, hash, completionKey]);
  useEffect(() => { const reopen = () => { setStep(0); setOpen(true); }; window.addEventListener(introductionEvent, reopen); return () => window.removeEventListener(introductionEvent, reopen); }, []);
  const current = guideSteps[step]; const Icon = current.icon;
  return <Dialog open={open} onOpenChange={next => { if (!next) finish(); }}><DialogContent className="w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-xl p-5 sm:p-6 motion-reduce:animate-none" onEscapeKeyDown={finish}>
    <DialogHeader><p className="text-sm text-primary">WeChurch 快速導覽 · {step + 1} / {guideSteps.length}</p><Icon className="h-9 w-9 text-primary" aria-hidden="true" /><DialogTitle className="text-xl leading-8">{step === 0 && user ? '歡迎回來，一起看看 WeChurch' : current.title}</DialogTitle><DialogDescription className="pt-2 text-base leading-7">{step === 0 && user ? '你已登入。讀經記錄、私人筆記與小家會跟隨你的帳號保存。接下來快速認識日常功能，也可以略過，之後從「使用說明」重新開始。' : current.text}</DialogDescription></DialogHeader>
    {(step !== 0 || !user) && <Button asChild variant="outline" className="min-h-11 whitespace-normal" onClick={finish}><Link to={current.href}>{current.link}</Link></Button>}
    <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button variant="ghost" onClick={finish}>略過導覽</Button><div className="flex gap-2"><Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>上一步</Button><Button onClick={() => { if (step === guideSteps.length - 1) finish(); else setStep(s => s + 1); }}>{step === guideSteps.length - 1 ? '開始使用' : '下一步'}</Button></div></div>
  </DialogContent></Dialog>;
}
