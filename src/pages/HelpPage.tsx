import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { guideSteps, openIntroduction } from '@/lib/introduction';
import { useAuth } from '@/contexts/AuthContext';

// Source: the live app's routes and features. Maintain alongside their changes.
export default function HelpPage() {
  const { user } = useAuth();
  return <div className="min-h-screen bg-background"><Header title="使用說明" backTo="/" /><main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 [overflow-wrap:anywhere]">
    <div className="border-b pb-6"><p className="text-sm font-medium text-primary">WeChurch 使用指南</p><h1 className="mt-2 text-2xl font-semibold">一起讀經，也一起同行</h1><p className="mt-3 leading-7 text-muted-foreground">從每日靈修開始，把領受記下來，與小家分享生命。在手機點右上角「選單」，可找到日常功能、使用說明與意見反饋。</p><div className="mt-4 flex flex-wrap gap-3"><Button onClick={openIntroduction}>重新看快速導覽</Button>{!user && <Button asChild variant="outline"><Link to="/login?returnTo=%2Fhelp">使用 Google 帳號登入</Link></Button>}</div></div>
    <ol className="divide-y">{guideSteps.map((step, index) => <li key={step.title} className="py-6"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">{index + 1}</span><div className="min-w-0"><h2 className="text-lg font-semibold">{step.title}</h2><p className="mt-2 leading-7 text-muted-foreground">{step.text}</p><Button asChild variant="link" className="mt-2 h-auto p-0"><Link to={step.href}>{step.link} →</Link></Button></div></div></li>)}</ol>
    <section className="border-t py-6"><h2 className="text-lg font-semibold">找不到記錄或無法登入？</h2><p className="mt-2 leading-7 text-muted-foreground">先確認使用原本的 Google 帳號。若畫面載入失敗，先檢查網路並重新載入；仍有問題，可從「意見反饋」告訴我們操作步驟與看到的訊息。請勿提供密碼、驗證碼或他人的私人內容。</p><Button asChild variant="outline" className="mt-4"><Link to="/feedback">送出意見反饋</Link></Button></section>
  </main></div>;
}
