import { CrmOperationalPanel } from '@/components/admin/CrmOperationalPanel';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
Activity,
AlertCircle,
ArrowLeft,
Bell,
BellOff,
BookOpen,
CalendarDays,
ChevronLeft,
ChevronRight,
Church,
ClipboardList,
Clock,
Copy,
Crown,
FlaskConical,
HeartHandshake,
Home,
MessageCircle,
MoreHorizontal,
Plus,
RefreshCw,
Search,
Shield,
Star,
Target,
UserCheck,
UserPlus,
Users,
X
} from 'lucide-react';
import { lazy,Suspense,useDeferredValue,useEffect,useMemo,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { CRMBulkActions } from '@/components/admin/CRMBulkActions';
import { IncompleteMembersPanel } from '@/components/admin/IncompleteMembersPanel';
import { LinkUserDialog } from '@/components/admin/LinkUserDialog';
import { UnifiedMemberTable } from '@/components/admin/UnifiedMemberTable';
import { AuthForm } from '@/components/auth/AuthForm';
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card,CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuSub,
DropdownMenuSubContent,
DropdownMenuSubTrigger,
DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Input } from '@/components/ui/input';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { PotentialMember,UnifiedMember,useUnifiedMembers } from '@/hooks/useUnifiedMembers';
import { AppRole,useUserRole } from '@/hooks/useUserRole';
import { filterCrmMembers,getMemberPage,type CrmBatchAction } from '@/lib/crm-members';

const LineIntegrationPanel = lazy(() => import('@/components/admin/LineIntegrationPanel').then(module => ({ default: module.LineIntegrationPanel })));
const PastoralFrameworkPanel = lazy(() => import('@/components/admin/PastoralFrameworkPanel').then(module => ({ default: module.PastoralFrameworkPanel })));
const PastoralJourneyPanel = lazy(() => import('@/components/admin/PastoralJourneyPanel').then(module => ({ default: module.PastoralJourneyPanel })));

type WorkspaceTab = 'overview' | 'journey' | 'prayers' | 'groups' | 'gatherings' | 'framework' | 'line' | 'care' | 'members';
type MemberTab = 'all' | 'registered' | 'potential' | 'incomplete';
type StatusFilter = 'all' | 'pending' | 'member' | 'declined';


interface ChurchOption {
  id: string;
  name: string;
}

interface CrmGroupOption {
  id: string;
  name: string;
  church: string;
  leaderUserId: string | null;
  leaderName: string | null;
  memberCount: number;
}

const roleLabels: Record<AppRole, string> = {
  admin: '系統管理員',
  senior_pastor: '主任牧師',
  pastor: '牧師',
  minister: '傳道人',
  group_leader: '小組長',
  leader: '小組長',
  future_leader: '儲備領袖',
  member: '會友',
};

const statusLabels: Record<PotentialMember['status'], string> = {
  pending: '待跟進',
  member: '已轉換',
  declined: '已婉拒',
};


const StatTile = ({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: typeof Users;
  tone: string;
}) => (
  <div className="min-w-0 border-l pl-3 first:border-l-0 first:pl-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{helper}</p>
        </div>
        <div className={`hidden rounded-md p-2 sm:block ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
  </div>
);

const CRMPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role: currentRole, isLeader, isAdmin, isSystemAdmin, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('members');
  const [memberTab, setMemberTab] = useState<MemberTab>('all');

  const [status, setStatus] = useState<StatusFilter>('all');
  const [role, setRole] = useState<AppRole | 'all'>('all');
  const [selectedChurch, setSelectedChurch] = useState<string>('all');
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{ userId: string; newRole: AppRole } | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupChurch, setNewGroupChurch] = useState('');
  const [groupActionBusy, setGroupActionBusy] = useState(false);
  const [churchScopeInitialized, setChurchScopeInitialized] = useState(false);

  const {
    data: rawMembers,
    allMembers,
    isError,
    error,
    dataUpdatedAt,
    isLoading,
    isRefetching,
    stats,
    statsLoading,
    updateRole,
    updatePotentialMember,
    deleteMember,
    bulkAction,
    forceRefetch,
  } = useUnifiedMembers({ tab: memberTab, status, role, church: selectedChurch, enabled: isLeader && churchScopeInitialized });

  useEffect(() => {
    if (authLoading || roleLoading || churchScopeInitialized || !user || !currentRole) return;
    if (currentRole === 'admin') {
      setSelectedChurch('all');
      setChurchScopeInitialized(true);
      return;
    }
    if (user.church) {
      setSelectedChurch(user.church);
    }
    setChurchScopeInitialized(true);
  }, [authLoading, churchScopeInitialized, currentRole, roleLoading, user]);

  useEffect(() => {
    if (!isLeader || !churchScopeInitialized) return;
    const fetchChurches = async () => {
      try {
        const response = await fetch('/api/churches');
        if (!response.ok) return;
        const data = await response.json();
        setChurches(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching churches:', error);
      }
    };

    fetchChurches();
  }, [isLeader, churchScopeInitialized]);

  const churchOptionsForActions = useMemo(
    () => churches.filter((church) => church.id !== '__unassigned'),
    [churches]
  );

  useEffect(() => {
    if (selectedChurch !== 'all') {
      setNewGroupChurch(selectedChurch);
      return;
    }
    if (!newGroupChurch && churchOptionsForActions.length > 0) {
      setNewGroupChurch(churchOptionsForActions[0].id);
    }
  }, [churchOptionsForActions, newGroupChurch, selectedChurch]);

  const { data: crmGroups = [], isFetching: groupsLoading, isError: groupsError, refetch: fetchCrmGroups } = useQuery<CrmGroupOption[]>({
    queryKey: ['crm-groups', user?.id, currentRole, selectedChurch],
    enabled: isLeader && churchScopeInitialized,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const groupQuery = selectedChurch !== 'all' ? `?${new URLSearchParams({ church: selectedChurch }).toString()}` : '';
      const response = await fetch(`/api/crm/groups${groupQuery}`, { signal });
      if (!response.ok) throw new Error('無法載入小組');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('小組資料格式異常');
      return data;
    },
  });

  useEffect(() => {
    if (!isLeader || !churchScopeInitialized) return;
    const controller = new AbortController();
    setActiveSessionId(null);
    const fetchActiveSession = async () => {
      try {
        const sessionQuery = selectedChurch !== 'all' ? `?${new URLSearchParams({ church: selectedChurch }).toString()}` : '';
        const response = await fetch(`/api/sessions${sessionQuery}`, { signal: controller.signal });
        if (!response.ok) return;
        const sessions = await response.json();
        const waitingSession = sessions.find((session: { status: string }) => session.status === 'waiting');
        if (waitingSession) setActiveSessionId(waitingSession.id);
      } catch (error) {
        console.error('Error fetching active session:', error);
      }
    };

    fetchActiveSession();
    return () => controller.abort();
  }, [selectedChurch, isLeader, churchScopeInitialized]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [memberTab, status, role, search, selectedChurch, pageSize]);

  const members = useMemo(() => {
    return filterCrmMembers(rawMembers, { tab: 'all', search: deferredSearch });
  }, [rawMembers, deferredSearch]);
  const memberPage = getMemberPage(members, page, pageSize);
  const pageMembers = memberPage.rows;
  const hasFilters = !!search.trim() || status !== 'all' || role !== 'all';
  const resetFilters = () => { setSearch(''); setStatus('all'); setRole('all'); };
  const changeMemberTab = (value: string) => {
    setMemberTab(value as MemberTab);
    setStatus('all');
    setRole('all');
  };
  const changePage = (next: number) => { setSelectedIds(new Set()); setPage(next); };
  const writesPending = bulkAction.isPending || updateRole.isPending || updatePotentialMember.isPending || deleteMember.isPending || groupActionBusy;
  useEffect(() => {
    const visibleIds = new Set(getMemberPage(members, page, pageSize).rows.filter(m => m.type === 'potential').map(m => m.id));
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => visibleIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [members, page, pageSize]);
  const currentChurchName = selectedChurch === 'all'
    ? '全部教會'
    : churches.find((church) => church.id === selectedChurch)?.name || selectedChurch;


  const handleToggleSelect = (id: string) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
    } else {
      nextSelected.add(id);
    }
    setSelectedIds(nextSelected);
  };

  const handleToggleSelectAll = () => {
    const selectableIds = pageMembers.filter((member) => member.type === 'potential').map((member) => member.id);
    const allSelected = selectableIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  };

  const handleBatch = async (action: CrmBatchAction) => {
    if (writesPending || isError) return;
    const ids = pageMembers.filter(member => member.type === 'potential' && selectedIds.has(member.id)).map(member => member.id);
    if (!ids.length) return;
    const result = await bulkAction.mutateAsync({ ids, action });
    setSelectedIds(new Set(result.failed));
  };
  const handleBulkUpdateStatus = (newStatus: PotentialMember['status']) => {
    void handleBatch({ type: 'update', updates: { status: newStatus } });
  };

  const handleBulkUpdateSubscription = (newSubscribed: boolean) => {
    void handleBatch({ type: 'update', updates: { subscribed: newSubscribed } });
  };

  const handleBulkDelete = () => {
    if (isAdmin) void handleBatch({ type: 'delete' });
  };

  const handleUpdateRole = (userId: string, newRole: AppRole) => {
    setRoleChange({ userId, newRole });
  };

  const handleUpdateStatus = (id: string, newStatus: PotentialMember['status']) => {
    updatePotentialMember.mutate({ id, updates: { status: newStatus } });
  };

  const handleToggleSubscription = (id: string, newSubscribed: boolean) => {
    updatePotentialMember.mutate({ id, updates: { subscribed: newSubscribed } });
  };

  const handleUpdateChurch = async (member: UnifiedMember, church: string) => {
    try {
      if (member.type === 'registered' && member.userId) {
        const response = await fetch(`/api/users/${member.userId}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: member.name || member.email,
            church,
          }),
        });
        if (!response.ok) throw new Error('Failed to update church');
        toast.success('所屬教會已更新');
        forceRefetch();
        return;
      }

      if (member.potentialMemberId) {
        updatePotentialMember.mutate({ id: member.potentialMemberId, updates: { church } });
      }
    } catch (error) {
      toast.error('更新教會失敗');
      console.error('Error updating member church:', error);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name || !newGroupChurch) {
      toast.info('請輸入小組名稱並選擇教會');
      return;
    }

    try {
      setGroupActionBusy(true);
      const response = await fetch('/api/crm/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, church: newGroupChurch }),
      });
      if (!response.ok) throw new Error('Failed to create group');
      setNewGroupName('');
      toast.success('小組已建立');
      await fetchCrmGroups();
    } catch (error) {
      toast.error('建立小組失敗');
      console.error('Error creating group:', error);
    } finally {
      setGroupActionBusy(false);
    }
  };

  const handleAssignGroup = async (member: UnifiedMember, groupId: string) => {
    try {
      setGroupActionBusy(true);
      const response = await fetch(`/api/crm/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.userId,
          potentialMemberId: member.potentialMemberId,
          memberEmail: member.email || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to assign group');
      toast.success(`已將 ${member.name} 分到小組`);
      await fetchCrmGroups();
    } catch (error) {
      toast.error('分組失敗');
      console.error('Error assigning group:', error);
    } finally {
      setGroupActionBusy(false);
    }
  };


  const handleLinkUser = (id: string) => {
    setSelectedMemberId(id);
    setLinkDialogOpen(true);
  };

  const handleLinkConfirm = (_potentialMemberId: string, _userId: string) => {
    toast.info('手動連結用戶功能尚未串接後端');
  };

  const handleDeleteClick = (id: string) => {
    if (!isAdmin) return;
    setMemberToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      deleteMember.mutate(memberToDelete);
      setMemberToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleCopyEmails = async () => {
    const emails = [...new Set(members
      .filter((member) => member.subscribed && member.email)
      .map((member) => member.email))];

    if (!emails.length) {
      toast.info('沒有可複製的 Email');
      return;
    }

    try {
      await navigator.clipboard.writeText(emails.join(', '));
      toast.success(`已複製 ${emails.length} 個 Email`);
    } catch { toast.error('無法複製 Email，請確認瀏覽器的剪貼簿權限'); }
  };


  const handleCopyMemberEmail = async (member: UnifiedMember) => {
    if (!member.email) return;
    try { await navigator.clipboard.writeText(member.email); toast.success('已複製 Email'); }
    catch { toast.error('無法複製 Email，請確認剪貼簿權限'); }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-md p-4 pt-8">
          <AuthForm onSuccess={() => {}} />
        </div>
      </div>
    );
  }

  if (!isLeader) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">權限不足</h2>
            <p className="mb-4 text-muted-foreground">只有領袖或管理員可以訪問教會 CRM</p>
            <Button onClick={() => navigate('/')}>返回首頁</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} aria-label="返回管理後台">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Church className="h-5 w-5 text-primary" />
                <h1 className="truncate text-lg font-semibold">教會 CRM</h1>
                {currentRole && (
                  <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                    {roleLabels[currentRole]}
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{currentChurchName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedChurch} onValueChange={setSelectedChurch} disabled={writesPending}>
              <SelectTrigger aria-label="選擇教會" className="hidden w-[170px] sm:flex">
                <SelectValue placeholder="選擇教會" />
              </SelectTrigger>
              <SelectContent>
                {isSystemAdmin && <SelectItem value="all">全部教會</SelectItem>}
                {churches.map((church) => (
                  <SelectItem key={church.id} value={church.id}>
                    {church.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" aria-label="複製名單 Email" title="複製目前篩選名單的 Email" onClick={handleCopyEmails} disabled={isLoading || isError || !members.length} className="h-10 w-10 gap-2 p-0 sm:w-auto sm:px-3">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">複製名單</span>
            </Button>
            <Button variant="outline" size="icon" title="重新整理會員" aria-label="重新整理會員" onClick={() => void forceRefetch()} disabled={isRefetching || writesPending}>
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-4 px-4 py-4">
        <section className="sm:hidden">
          <Select value={selectedChurch} onValueChange={setSelectedChurch} disabled={writesPending}>
            <SelectTrigger aria-label="選擇教會">
              <SelectValue placeholder="選擇教會" />
            </SelectTrigger>
            <SelectContent>
              {isSystemAdmin && <SelectItem value="all">全部教會</SelectItem>}
              {churches.map((church) => (
                <SelectItem key={church.id} value={church.id}>
                  {church.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section aria-label="會員摘要" className="grid grid-cols-2 gap-x-4 gap-y-3 border-b py-3 sm:grid-cols-4">
          {statsLoading ? (
            [...Array(4)].map((_, index) => <Skeleton key={index} className="h-16 rounded-md" />)
          ) : (
            <>
              <StatTile
                title="總人數"
                value={stats?.totalCount ?? '—'}
                helper={`本週新增 ${stats?.newThisWeek ?? 0} 人`}
                icon={Users}
                tone="bg-sky-50 text-sky-700"
              />
              <StatTile
                title="已註冊"
                value={stats?.registeredCount ?? '—'}
                helper="已建立帳戶"
                icon={Home}
                tone="bg-emerald-50 text-emerald-700"
              />
              <StatTile
                title="潛在會員"
                value={stats?.unlinkedCount ?? '—'}
                helper="尚未連結帳戶"
                icon={CalendarDays}
                tone="bg-orange-50 text-orange-700"
              />
              <StatTile
                title="待跟進"
                value={stats?.pendingCount ?? '—'}
                helper="待跟進的潛在會員"
                icon={HeartHandshake}
                tone="bg-rose-50 text-rose-700"
              />
            </>
          )}
        </section>

        {isError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1">{error?.message}{dataUpdatedAt ? '。目前顯示上次載入的資料。' : ''}</p>
            <Button variant="outline" size="sm" onClick={() => void forceRefetch()} disabled={isRefetching}>重試</Button>
          </div>
        )}

        <Tabs value={workspaceTab} onValueChange={(value) => { if (!writesPending) setWorkspaceTab(value as WorkspaceTab); }} className="space-y-4">
          <div className="pb-1">
            <div className="sm:hidden">
              <Select value={workspaceTab} onValueChange={value => setWorkspaceTab(value as WorkspaceTab)} disabled={writesPending}>
                <SelectTrigger aria-label="CRM 工作區"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="members">會員</SelectItem>
                  <SelectItem value="care">關懷</SelectItem>
                  <SelectItem value="groups">小組</SelectItem>
                  <SelectItem value="overview">總覽</SelectItem>
                  <SelectItem value="journey">個人/門訓</SelectItem>
                  <SelectItem value="prayers">代求</SelectItem>
                  <SelectItem value="gatherings">聚會</SelectItem>
                  <SelectItem value="framework">框架</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TabsList aria-label="CRM 工作區" className="hidden h-auto w-full gap-1 p-1 sm:flex sm:flex-wrap sm:justify-start">
              <TabsTrigger value="members" className="gap-2">
                <UserCheck className="h-4 w-4" />
                會員
              </TabsTrigger>
              <TabsTrigger value="care" className="gap-2">
                <HeartHandshake className="h-4 w-4" />
                關懷
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <Users className="h-4 w-4" />
                小組
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-2">
                <Activity className="h-4 w-4" />
                總覽
              </TabsTrigger>
              <TabsTrigger value="journey" className="gap-2">
                <BookOpen className="h-4 w-4" />
                個人/門訓
              </TabsTrigger>
              <TabsTrigger value="prayers" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                代求
              </TabsTrigger>
              <TabsTrigger value="gatherings" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                聚會
              </TabsTrigger>
              <TabsTrigger value="framework" className="gap-2">
                <Target className="h-4 w-4" />
                框架
              </TabsTrigger>
              <TabsTrigger value="line" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                LINE
              </TabsTrigger>
            </TabsList>
          </div>


          <TabsContent value="overview"><CrmOperationalPanel view="overview" groups={crmGroups} loading={groupsLoading} error={groupsError} retry={() => void fetchCrmGroups()} manageMembers={() => setWorkspaceTab("members")} /></TabsContent>

          <TabsContent value="journey"><FeatureGate featureKey="pastoral_beta" title="門訓尚未開放" description="目前仍在驗收"><Suspense fallback={<Skeleton className="h-40" />}><PastoralJourneyPanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} /></Suspense></FeatureGate></TabsContent>

          <TabsContent value="prayers"><CrmOperationalPanel view="prayers" groups={crmGroups} loading={groupsLoading} error={groupsError} retry={() => void fetchCrmGroups()} manageMembers={() => setWorkspaceTab("members")} /></TabsContent>

          <TabsContent value="groups"><CrmOperationalPanel view="groups" groups={crmGroups} loading={groupsLoading} error={groupsError} retry={() => void fetchCrmGroups()} manageMembers={() => setWorkspaceTab("members")} /></TabsContent>

          <TabsContent value="gatherings"><CrmOperationalPanel view="gatherings" groups={crmGroups} loading={groupsLoading} error={groupsError} retry={() => void fetchCrmGroups()} manageMembers={() => setWorkspaceTab("members")} /></TabsContent>

          <TabsContent value="framework" className="space-y-5">
            <FeatureGate featureKey="framework_beta" title="牧養框架 beta 測試中" description="牧養框架目前只開放給 beta 同工">
              <Suspense fallback={<Skeleton className="h-40" />}><PastoralFrameworkPanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} /></Suspense>
            </FeatureGate>
          </TabsContent>

          <TabsContent value="line" className="space-y-5">
            <FeatureGate featureKey="line_login_beta" title="LINE beta 測試中" description="LINE 登入目前只開放給 beta 同工">
              <Suspense fallback={<Skeleton className="h-40" />}><LineIntegrationPanel /></Suspense>
            </FeatureGate>
          </TabsContent>

          <TabsContent value="care"><CrmOperationalPanel view="care" groups={crmGroups} loading={groupsLoading} error={groupsError} retry={() => void fetchCrmGroups()} manageMembers={() => setWorkspaceTab("members")} /></TabsContent>

          <TabsContent value="members" className="space-y-5">
            <fieldset disabled={writesPending} className="min-w-0 space-y-4 disabled:opacity-70" aria-busy={writesPending}>
              <div>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <Tabs value={memberTab} onValueChange={changeMemberTab}>
                    <TabsList className="grid h-auto w-full grid-cols-4 sm:flex [&_svg]:hidden sm:[&_svg]:block [&_button]:px-2 sm:[&_button]:px-3">
                      <TabsTrigger value="all" className="gap-2">
                        <Users className="h-4 w-4" />
                        全部
                      </TabsTrigger>
                      <TabsTrigger value="registered" className="gap-2">
                        <UserCheck className="h-4 w-4" />
                        已註冊
                      </TabsTrigger>
                      <TabsTrigger value="potential" className="gap-2">
                        <Clock className="h-4 w-4" />
                        潛在會員
                      </TabsTrigger>
                      <TabsTrigger value="incomplete" className="gap-2">
                        <AlertCircle className="h-4 w-4" />
                        待完善
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                </div>
              </div>
              <div className="space-y-4">
                {groupsError && <p role="alert" className="text-sm text-destructive">無法載入小組。<Button variant="link" onClick={() => void fetchCrmGroups()}>重試小組資料</Button></p>}
                {memberTab !== 'incomplete' && (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-md lg:flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      aria-label="搜尋會員"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜尋姓名、Email、角色或狀態"
                      className="pl-9 pr-10"
                    />
                    {search && <Button variant="ghost" size="icon" className="absolute right-0 top-0" title="清除搜尋" aria-label="清除搜尋" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(memberTab === 'all' || memberTab === 'registered') && isAdmin && (
                      <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                        <SelectTrigger aria-label="篩選角色" className="w-[140px]">
                          <SelectValue placeholder="角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部角色</SelectItem>
                          <SelectItem value="admin">系統管理員</SelectItem>
                          <SelectItem value="senior_pastor">主任牧師</SelectItem>
                          <SelectItem value="pastor">牧師</SelectItem>
                          <SelectItem value="minister">傳道人</SelectItem>
                          <SelectItem value="group_leader">小組長</SelectItem>
                          <SelectItem value="future_leader">儲備領袖</SelectItem>
                          <SelectItem value="member">成員</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {(memberTab === 'all' || memberTab === 'potential') && (
                      <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                        <SelectTrigger aria-label="篩選狀態" className="w-[140px]">
                          <SelectValue placeholder="狀態" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部狀態</SelectItem>
                          <SelectItem value="pending">待跟進</SelectItem>
                          <SelectItem value="member">已轉換</SelectItem>
                          <SelectItem value="declined">已婉拒</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters}><X className="mr-1 h-4 w-4" />清除篩選</Button>}
                  </div>
                </div>
                )}

                {isAdmin && (
                  <details className="border-y py-3">
                    <summary className="cursor-pointer text-sm font-medium">建立小組</summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[200px_1fr] lg:items-center">
                    <Select value={newGroupChurch} onValueChange={setNewGroupChurch}>
                      <SelectTrigger aria-label="小組所屬教會">
                        <SelectValue placeholder="小組教會" />
                      </SelectTrigger>
                      <SelectContent>
                        {churchOptionsForActions.map((church) => (
                          <SelectItem key={church.id} value={church.id}>
                            {church.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input
                        value={newGroupName}
                        aria-label="新增小組名稱"
                        onChange={(event) => setNewGroupName(event.target.value)}
                        placeholder="新增小組名稱"
                        className="min-w-0"
                      />
                      <Button onClick={handleCreateGroup} disabled={groupActionBusy || !newGroupName.trim()} className="shrink-0 gap-2">
                        <Plus className="h-4 w-4" />
                        建立
                      </Button>
                    </div>
                    </div>
                  </details>
                )}

                {selectedIds.size > 0 && (
                  <CRMBulkActions
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onBulkUpdateStatus={handleBulkUpdateStatus}
                    onBulkUpdateSubscription={handleBulkUpdateSubscription}
                    onBulkDelete={handleBulkDelete}
                    isUpdating={writesPending || isError}
                    canDelete={isAdmin}
                  />
                )}

                {memberTab === 'incomplete' ? (
                  <IncompleteMembersPanel key={selectedChurch} church={selectedChurch} />
                ) : isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, index) => (
                      <Skeleton key={index} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : isError && !dataUpdatedAt ? null : members.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>{hasFilters ? '找不到符合條件的會員' : '目前沒有會員資料'}</p>
                    {hasFilters && <Button variant="outline" className="mt-3" onClick={resetFilters}>清除篩選</Button>}
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {pageMembers.map((member) => {
                      return (
                        <Card key={member.id} className={selectedIds.has(member.id) ? 'ring-2 ring-primary' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {member.type === 'potential' && <Checkbox checked={selectedIds.has(member.id)} onCheckedChange={() => handleToggleSelect(member.id)} aria-label={`選取 ${member.name}`} />}
                                  <Badge variant={member.type === 'registered' ? 'default' : 'secondary'}>
                                    {member.type === 'registered' ? '會員' : '潛在'}
                                  </Badge>
                                </div>
                                <h3 className="mt-2 truncate font-semibold">{member.name}</h3>
                                <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {member.role ? roleLabels[member.role] : statusLabels[member.status]} ・ 出席 {member.sessionsCount} 次
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label={`${member.name} 的操作`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem disabled={!member.email} onClick={() => void handleCopyMemberEmail(member)}><Copy className="mr-2 h-4 w-4" />複製 Email</DropdownMenuItem>
                                  {member.type === 'potential' && (
                                    <>
                                      <DropdownMenuLabel>潛在會員</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(member.potentialMemberId!, 'member')}>
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        標記已轉換
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(member.potentialMemberId!, 'pending')}>
                                        <Clock className="mr-2 h-4 w-4" />
                                        標記待跟進
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(member.potentialMemberId!, 'declined')}>
                                        <AlertCircle className="mr-2 h-4 w-4" />
                                        標記已婉拒
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem disabled onClick={() => handleLinkUser(member.potentialMemberId!)}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        手動連結用戶（尚未開放）
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {member.potentialMemberId && (
                                    <DropdownMenuItem
                                      onClick={() => handleToggleSubscription(member.potentialMemberId!, !member.subscribed)}
                                    >
                                      {member.subscribed ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
                                      {member.subscribed ? '取消訂閱' : '啟用訂閱'}
                                    </DropdownMenuItem>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          <Users className="mr-2 h-4 w-4" />
                                          分到小組
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                                          {groupsLoading ? (
                                            <DropdownMenuItem disabled>讀取小組中</DropdownMenuItem>
                                          ) : crmGroups.length === 0 ? (
                                            <DropdownMenuItem disabled>尚無小組</DropdownMenuItem>
                                          ) : (
                                            crmGroups.map((group) => (
                                              <DropdownMenuItem key={group.id} onClick={() => handleAssignGroup(member, group.id)}>
                                                {group.name}
                                                <span className="ml-2 text-xs text-muted-foreground">{group.church}</span>
                                              </DropdownMenuItem>
                                            ))
                                          )}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          <Church className="mr-2 h-4 w-4" />
                                          調整教會
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          {churchOptionsForActions.map((church) => (
                                            <DropdownMenuItem key={church.id} onClick={() => handleUpdateChurch(member, church.id)}>
                                              {church.name}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    </>
                                  )}
                                  {member.type === 'registered' && member.userId && isAdmin && (
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger><Shield className="mr-2 h-4 w-4" />變更角色</DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'admin')}>
                                        <Shield className="mr-2 h-4 w-4" />
                                        系統管理員
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'senior_pastor')}>
                                        <Crown className="mr-2 h-4 w-4" />
                                        主任牧師
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'pastor')}>
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        牧師
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'minister')}>
                                        <Star className="mr-2 h-4 w-4" />
                                        傳道人
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'group_leader')}>
                                        <Crown className="mr-2 h-4 w-4" />
                                        小組長
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'future_leader')}>
                                        <Star className="mr-2 h-4 w-4" />
                                        儲備領袖
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId!, 'member')}><Users className="mr-2 h-4 w-4" />會友</DropdownMenuItem>
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )}
                                  {member.type === 'potential' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteClick(member.potentialMemberId!)}
                                        disabled={!isAdmin}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        刪除
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <UnifiedMemberTable
                    members={pageMembers}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onUpdateRole={handleUpdateRole}
                    onUpdateStatus={handleUpdateStatus}
                    onToggleSubscription={handleToggleSubscription}
                    onAssignGroup={handleAssignGroup}
                    onUpdateChurch={handleUpdateChurch}
                    onLinkUser={handleLinkUser}
                    onDelete={handleDeleteClick}
                    onCopyEmail={handleCopyMemberEmail}
                    isAdmin={isAdmin}
                    groups={crmGroups}
                    churches={churchOptionsForActions}
                    groupsLoading={groupsLoading}
                  />
                )}

                {memberTab !== 'incomplete' && members.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                    <p role="status" className="tabular-nums text-muted-foreground">
                      {((memberPage.page - 1) * pageSize) + 1}–{Math.min(memberPage.page * pageSize, members.length)} / {members.length} 人
                    </p>
                    <div className="flex items-center gap-2">
                      <Select value={String(pageSize)} onValueChange={value => setPageSize(Number(value))}>
                        <SelectTrigger aria-label="每頁人數" className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{[25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size} 人/頁</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" title="上一頁" aria-label="上一頁" disabled={memberPage.page === 1} onClick={() => changePage(memberPage.page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="min-w-12 text-center tabular-nums">{memberPage.page}/{memberPage.pageCount}</span>
                      <Button variant="outline" size="icon" title="下一頁" aria-label="下一頁" disabled={memberPage.page === memberPage.pageCount} onClick={() => changePage(memberPage.page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
                {!!dataUpdatedAt && <p className="text-xs text-muted-foreground">{isRefetching ? '更新中…' : `更新於 ${format(new Date(dataUpdatedAt), 'HH:mm')}`}</p>}
              </div>
            </fieldset>
          </TabsContent>
        </Tabs>
      </main>

      <LinkUserDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        memberId={selectedMemberId}
        onLink={handleLinkConfirm}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除？</AlertDialogTitle>
            <AlertDialogDescription>將永久刪除「{allMembers.find(member => member.potentialMemberId === memberToDelete)?.name || '這位潛在會員'}」的潛在會員資料，無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!roleChange} onOpenChange={open => { if (!open) setRoleChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認變更角色？</AlertDialogTitle>
            <AlertDialogDescription>
              將「{allMembers.find(member => member.userId === roleChange?.userId)?.name}」設為「{roleChange && roleLabels[roleChange.newRole]}」，這會影響此人的資料存取與管理權限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (roleChange) updateRole.mutate(roleChange); setRoleChange(null); }}>確認變更</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CRMPage;
