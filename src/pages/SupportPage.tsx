import { Link, useLocation } from 'react-router-dom';
import { SupportPanel, SupportDestinations, useSupportAccess } from '@/components/support/SupportPanel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';

export default function SupportPage() {
  const work = useLocation().pathname === '/work';
  const { user } = useAuth();
  const access = useSupportAccess();
  return <><Header variant="compact" backTo="/me" /><main className="mx-auto min-h-[70vh] max-w-3xl space-y-6 px-4 py-6 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{work ? '同工工作區' : '尋求陪伴'}</h1>{(work || access.data?.canWork) && <Button asChild variant="outline"><Link to={work ? '/support' : '/work'}>{work ? '我的求助' : '交給我的事項'}</Link></Button>}</div>
    <SupportPanel key={`${user?.id}:${work}`} mode={work ? 'work' : 'personal'} />
    {work && access.data?.canWork && <div className="flex flex-wrap gap-3 border-t pt-4"><Button asChild variant="outline"><Link to="/groups">我的小組</Link></Button><Button asChild variant="outline"><Link to="/work/mentoring">門訓陪伴</Link></Button><Button asChild variant="outline"><Link to="/admin/crm">牧養與管理</Link></Button>{access.data.canConfigure && <Button asChild variant="outline"><Link to="/work/settings">陪伴窗口設定</Link></Button>}</div>}
  </main></>;
}
export function SupportSettingsPage() { return <><Header variant="compact" backTo="/work" /><main className="mx-auto max-w-3xl space-y-5 px-4 py-6"><Button asChild variant="outline"><Link to="/work">返回同工工作區</Link></Button><SupportDestinations /></main></>; }
