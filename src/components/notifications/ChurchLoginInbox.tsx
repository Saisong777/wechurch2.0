import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchContext, useChurchScopeKey } from '@/contexts/ChurchContext';
import { churchOnboardingRequest, loginInboxKey, loginSummaryKey, useChurchLoginSummary } from '@/hooks/useChurchOnboarding';
import type { ChurchArrival, ChurchLoginInbox as Inbox, ChurchLoginDayDetail } from '@shared/churchOnboarding';
import { churchDisplayName } from '@shared/churches';
import { Button } from '@/components/ui/button';

const arrivalReason: Record<ChurchArrival['reason'], string> = {
  first_login: '首次登入', initial_choice: '首次選定教會', church_changed: '教會歸屬已調整', needs_affiliation: '尚待確認教會',
};
const time = (value: string) => new Date(value).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});

function DayMembers({day, inboxScope}: {day: string; inboxScope: 'church' | 'unassigned'}) {
  const { user } = useAuth();
  const church = useChurchContext();
  const scope = useChurchScopeKey();
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1];
  const query = useQuery<ChurchLoginDayDetail>({queryKey: [loginInboxKey, 'day', day, user?.id, scope, inboxScope, cursor],
    queryFn: ({signal}) => churchOnboardingRequest(`${loginInboxKey}/days/${encodeURIComponent(day)}?scope=${inboxScope}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {signal}),
    retry: false, staleTime: 10000, refetchInterval: 30000, refetchIntervalInBackground: false});
  if (query.isPending) return <p role="status" className="pt-3 text-sm">正在載入當日登入名單…</p>;
  const expectedChurch = inboxScope === 'unassigned' ? null : church?.data?.selectedChurch;
  if (query.isError || query.data?.day !== day || query.data?.scope !== inboxScope || query.data?.scopeChurch !== expectedChurch) return <div role="alert" className="pt-3"><p className="text-sm">當日登入名單暫時無法確認。</p><Button variant="outline" className="mt-2" onClick={() => void query.refetch()}>重新載入當日名單</Button></div>;
  return <div className="mt-3 rounded-md bg-muted/40 px-3">
    {!query.data?.members.length && <p className="py-3 text-sm">當日沒有登入紀錄。</p>}
    <ul className="divide-y">{query.data?.members.map((member, index) => <li key={member.userId || `changed-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{member.name}</span><span className="text-muted-foreground">{member.loginCount} 次 · 最後登入 {time(member.lastLoginAt)}</span></li>)}</ul>
    {(cursors.length > 1 || query.data?.nextCursor) && <div className="flex flex-wrap gap-2 pb-3"><Button variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors(previous => previous.slice(0, -1))}>上一頁登入名單</Button><Button variant="outline" disabled={!query.data?.nextCursor || query.isFetching} onClick={() => setCursors(previous => [...previous, query.data!.nextCursor])}>下一頁登入名單</Button></div>}
  </div>;
}

function LoginDayRow({day, busy, markRead, inboxScope}: {day: Inbox['days'][number]; busy: boolean; markRead: () => void; inboxScope: 'church' | 'unassigned'}) {
  const [open, setOpen] = useState(false);
  return <li className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{day.day}{day.inProgress && <span className="ml-2 text-sm text-muted-foreground">持續更新中</span>}</p><p className="mt-1 text-sm">{day.uniqueMembers} 人 · {day.loginCount} 次登入</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="ghost" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>{open ? '收起登入名單' : '查看登入名單'}<span className="sr-only">：{day.day}</span></Button>{day.read ? <span className="text-sm text-muted-foreground">已查看</span> : !day.inProgress && <Button variant="outline" disabled={busy} onClick={markRead}>標記已查看<span className="sr-only">：{day.day}</span></Button>}</div></div>{open && <DayMembers day={day.day} inboxScope={inboxScope}/>}</li>;
}

function InboxContent({scope}: {scope: 'church' | 'unassigned'}) {
  const { user } = useAuth();
  const church = useChurchContext();
  const scopeKey = useChurchScopeKey();
  const client = useQueryClient();
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [message, setMessage] = useState('');
  const cursor = cursors[cursors.length - 1];
  const query = useQuery<Inbox>({queryKey: [loginInboxKey, user?.id, scopeKey, scope, cursor], enabled: !!user,
    queryFn: ({signal}) => churchOnboardingRequest(`${loginInboxKey}?scope=${scope}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {signal}),
    retry: false, staleTime: 10000, refetchInterval: 30000, refetchIntervalInBackground: false});
  const action = useMutation({mutationFn: (input: {arrival: ChurchArrival} | {day: string}) => {
    const path = 'arrival' in input ? `/${input.arrival.id}/handle` : '/days/read';
    return churchOnboardingRequest(`${loginInboxKey}${path}?scope=${scope}`, {
      method: 'arrival' in input ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify('arrival' in input ? {version: input.arrival.version} : {day: input.day, scope}),
    });
  }, onSuccess: async () => {
    setMessage('');
    await client.invalidateQueries({queryKey: [loginInboxKey]});
    await client.invalidateQueries({queryKey: [loginSummaryKey]});
  }, onError: async error => {
    setMessage((error as Error).message);
    // A completed mutation can belong to an unmounted church scope. Refetch only
    // active observers so its old query key never receives the current scope.
    await client.invalidateQueries({queryKey: [loginInboxKey], refetchType: 'active'});
    await client.invalidateQueries({queryKey: [loginSummaryKey], refetchType: 'active'});
  }});
  if (query.isPending) return <p role="status" className="py-4">正在載入登入彙整…</p>;
  const expectedChurch = scope === 'unassigned' ? null : church?.data?.selectedChurch;
  if (query.isError || !query.data?.canManage || query.data.scope !== scope || query.data.scopeChurch !== expectedChurch) return <div role="alert" className="space-y-2 py-4"><p>登入彙整暫時無法確認，請重新檢查管理權限。</p><Button variant="outline" onClick={() => void query.refetch()}>重新載入登入彙整</Button></div>;
  const data = query.data;
  return <div className="space-y-5 py-4">
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <section aria-labelledby="church-arrivals-title">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="church-arrivals-title" className="font-semibold">待關懷名單</h3><Button variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>更新名單</Button></div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{scope === 'unassigned' ? '這裡包含尚待確認歸屬，以及已確認目前沒有教會的帳號。請尊重本人選擇，確認意願後再協助歸屬。' : '新登入或新加入教會的人會保留在這裡，直到管理者確認已關懷。'} 標記由同範圍同工共用。</p>
      {!data.arrivals.length && <p className="py-4 text-sm">目前沒有待處理的人員。</p>}
      <ul className="divide-y">{data.arrivals.map(arrival => <li key={arrival.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1"><p className="font-medium">{arrival.name || '未填姓名'}</p><p className="mt-1 text-sm text-muted-foreground">{arrival.email || '未提供帳號信箱'}</p><p className="mt-1 text-sm text-muted-foreground">{arrival.choiceNone ? '已確認目前沒有教會' : arrivalReason[arrival.reason]} · {arrival.church ? churchDisplayName(arrival.church) : arrival.choiceNone ? '目前沒有教會' : '教會歸屬待確認'}</p><time className="mt-1 block text-sm text-muted-foreground" dateTime={arrival.createdAt}>{time(arrival.createdAt)}</time></div>
        <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({arrival})}>標記已關懷<span className="sr-only">：{arrival.name || '未填姓名'}</span></Button>
      </li>)}</ul>
      {(cursors.length > 1 || data.nextCursor) && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors(previous => previous.slice(0, -1))}>上一頁人員</Button><Button variant="outline" disabled={!data.nextCursor || query.isFetching} onClick={() => setCursors(previous => [...previous, data.nextCursor])}>下一頁人員</Button></div>}
      {scope === 'unassigned' && <Link to="/admin" className="mt-3 inline-flex min-h-11 items-center text-sm underline">到管理台協助確認教會</Link>}
    </section>
    <section aria-labelledby="church-login-days-title" className="border-t pt-4"><h3 id="church-login-days-title" className="font-semibold">每日登入彙整</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">依登入當時的教會歸屬，以台北日期計算，重複登入合併為同一人。首次選定教會會另列待關懷；今天的登入會持續更新，已結束的日期可標記已查看。</p>
      {!data.days.length && <p className="py-4 text-sm">目前沒有登入彙整紀錄。</p>}
      <ul className="divide-y">{data.days.map(day => <LoginDayRow key={day.day} day={day} inboxScope={scope} busy={action.isPending} markRead={() => action.mutate({day: day.day})} />)}</ul>
    </section>
  </div>;
}

export function ChurchLoginInbox() {
  const summary = useChurchLoginSummary();
  const church = useChurchContext();
  const [scope, setScope] = useState<'church' | 'unassigned'>('church');
  const selected = church?.data?.selectedChurch;
  const active = selected ? scope : 'unassigned';
  if (summary.isError) return <section className="border-b py-4" role="alert"><p>管理者登入通知暫時無法確認。</p><Button className="mt-2" variant="outline" onClick={() => void summary.refetch()}>重新確認管理通知</Button></section>;
  if (!summary.data?.canManage) return null;
  return <section className="border-b py-4 [overflow-wrap:anywhere]" aria-labelledby="church-login-inbox-title">
    <h2 id="church-login-inbox-title" className="text-lg font-semibold">登入與新成員通知</h2>
    <p className="mt-1 text-sm text-muted-foreground">{summary.data.total} 項待關懷或未查看的每日彙整</p>
    {church?.data?.isSystemAdmin && selected && <label className="mt-3 block space-y-1 text-sm">通知範圍<select aria-label="登入通知範圍" className="min-h-11 w-full rounded-md border bg-background px-3" value={scope} onChange={event => setScope(event.target.value as 'church' | 'unassigned')}><option value="church">{churchDisplayName(selected)}</option><option value="unassigned">沒有教會／歸屬待確認</option></select></label>}
    <InboxContent key={`${church?.identity || ''}:${active}`} scope={active} />
  </section>;
}
