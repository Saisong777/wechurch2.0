import { LeaderDashboard } from '@/components/pastoral/LeaderDashboard';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportPanel } from '@/components/support/SupportPanel';

export interface OperationalGroup {
  id: string;
  name: string;
  church: string;
  leaderName: string | null;
  memberCount: number;
}

export function CrmOperationalPanel({ view, groups, loading, error, retry, manageMembers }: {
  view: 'overview' | 'groups' | 'care' | 'prayers' | 'gatherings';
  groups: OperationalGroup[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  manageMembers: () => void;
}) {
  if (view === 'care') return <SupportPanel mode="work" />;
  if (view === 'prayers') return <section className="space-y-4"><h2 className="text-xl font-semibold">共同代禱</h2><Button asChild variant="outline"><Link to="/prayer-wall">前往禱告牆<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></section>;
  if (view === 'gatherings') return <section className="space-y-4"><h2 className="text-xl font-semibold">聚會出席</h2><p className="text-sm text-muted-foreground">在牧養概況選擇負責的小家，建立聚會並記錄出席。</p><Button asChild><Link to="/work">開啟牧養概況<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></section>;
  if (view === 'overview') return <LeaderDashboard />;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">小家管理</h2><Button variant="outline" onClick={manageMembers}>管理成員與小家</Button></div>
    {loading ? <Skeleton className="h-24" /> : error ? <div role="alert" className="flex items-center gap-3"><p>無法載入小家。</p><Button variant="outline" onClick={retry}>重試</Button></div> : groups.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有可管理的小家。</p> : <ul className="divide-y border-y">
      {groups.map(group => <li key={group.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 [overflow-wrap:anywhere]"><h3 className="font-medium">{group.name}</h3><p className="text-sm text-muted-foreground">{group.church} · {group.leaderName || '尚未指派組長'}</p></div><span className="text-sm tabular-nums">{group.memberCount} 位成員</span></li>)}
    </ul>}
  </section>;
}
