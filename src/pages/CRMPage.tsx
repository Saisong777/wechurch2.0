import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, subDays } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Church,
  ClipboardList,
  Clock,
  Copy,
  Crown,
  FlaskConical,
  Globe2,
  HeartHandshake,
  Home,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Siren,
  Sparkles,
  Star,
  Target,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { AuthForm } from '@/components/auth/AuthForm';
import { CRMBulkActions } from '@/components/admin/CRMBulkActions';
import { FacilityBookingPanel } from '@/components/admin/FacilityBookingPanel';
import { IncompleteMembersPanel } from '@/components/admin/IncompleteMembersPanel';
import { LinkUserDialog } from '@/components/admin/LinkUserDialog';
import { LineIntegrationPanel } from '@/components/admin/LineIntegrationPanel';
import { PastoralFrameworkPanel } from '@/components/admin/PastoralFrameworkPanel';
import { PastoralJourneyPanel } from '@/components/admin/PastoralJourneyPanel';
import { ServingSchedulePanel } from '@/components/admin/ServingSchedulePanel';
import { UnifiedMemberTable } from '@/components/admin/UnifiedMemberTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole, useUserRole } from '@/hooks/useUserRole';
import { PotentialMember, UnifiedMember, useUnifiedMembers } from '@/hooks/useUnifiedMembers';
import { useIsMobile } from '@/hooks/use-mobile';

type WorkspaceTab = 'overview' | 'journey' | 'prayers' | 'groups' | 'gatherings' | 'serving' | 'facilities' | 'framework' | 'line' | 'care' | 'members';
type MemberTab = 'all' | 'registered' | 'potential' | 'incomplete';
type StatusFilter = 'all' | 'pending' | 'member' | 'declined';

type CareStage = 'new' | 'follow-up' | 'active' | 'at-risk' | 'inactive';
type PastoralTaskFilter = 'all' | 'urgent' | 'follow-up' | 'newcomer' | 'growth';

interface CareProfile {
  stage: CareStage;
  label: string;
  tone: string;
  priority: number;
  action: string;
  note: string;
}

interface SmallGroup {
  id: string;
  name: string;
  leader: string;
  members: UnifiedMember[];
  meetingTime: string;
  location: string;
  health: number;
  focus: string;
}

interface Gathering {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  expected: number;
  checkedIn: number;
  owner: string;
  room: string;
  status: '報名中' | '本週' | '已完成';
}

interface PrayerCategory {
  id: string;
  label: string;
  description: string;
  count: number;
  owner: string;
  urgency: '日常' | '本週' | '緊急';
  tone: string;
  icon: typeof Users;
}

interface JourneyStage {
  title: string;
  description: string;
  count: number;
  completion: number;
  tone: string;
}

interface PastoralTask {
  id: string;
  lane: Exclude<PastoralTaskFilter, 'all'>;
  member: UnifiedMember;
  profile: CareProfile;
  label: string;
  dueLabel: string;
  owner: string;
  reason: string;
  tone: string;
}

interface MeetingAgendaItem {
  id: PastoralTaskFilter | 'groups' | 'journey' | 'prayers';
  title: string;
  owner: string;
  count: number;
  detail: string;
  action: string;
  icon: typeof Users;
  tone: string;
}

interface RoleWorkflow {
  title: string;
  scope: string;
  metric: string;
  actions: string[];
  icon: typeof Users;
  tone: string;
}

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

const careProfiles: Record<CareStage, CareProfile> = {
  new: {
    stage: 'new',
    label: '新朋友',
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
    priority: 2,
    action: '安排歡迎訊息',
    note: '首次接觸，需要建立關係。',
  },
  'follow-up': {
    stage: 'follow-up',
    label: '需跟進',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    priority: 1,
    action: '48 小時內關懷',
    note: '近期有出席，但尚未穩定連結。',
  },
  active: {
    stage: 'active',
    label: '穩定委身',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    priority: 4,
    action: '邀請參與服事',
    note: '出席穩定，可進一步陪伴成長。',
  },
  'at-risk': {
    stage: 'at-risk',
    label: '流失風險',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    priority: 0,
    action: '小組長主動聯絡',
    note: '一段時間未出現，需要溫柔關心。',
  },
  inactive: {
    stage: 'inactive',
    label: '暫停互動',
    tone: 'bg-slate-50 text-slate-600 border-slate-200',
    priority: 5,
    action: '保留低頻關懷',
    note: '目前互動較少，避免過度打擾。',
  },
};

const getLastActivity = (member: UnifiedMember) => {
  const value = member.lastSessionAt || member.firstJoinedAt || member.createdAt;
  return value ? new Date(value) : null;
};

const getCareProfile = (member: UnifiedMember): CareProfile => {
  const lastActivity = getLastActivity(member);
  const isNew = member.firstJoinedAt
    ? isAfter(new Date(member.firstJoinedAt), subDays(new Date(), 14))
    : false;

  if (member.status === 'declined') return careProfiles.inactive;
  if (!member.subscribed) return careProfiles['at-risk'];
  if (!lastActivity || !isAfter(lastActivity, subDays(new Date(), 45))) return careProfiles['at-risk'];
  if (isNew || member.sessionsCount <= 1) return careProfiles.new;
  if (member.sessionsCount < 4) return careProfiles['follow-up'];
  return careProfiles.active;
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  return format(new Date(value), 'MM/dd EEE', { locale: zhTW });
};

const formatShortDate = (value: Date) => format(value, 'MM/dd EEE', { locale: zhTW });

const buildPastoralTask = (member: UnifiedMember, profile: CareProfile): PastoralTask | null => {
  const lastActivity = getLastActivity(member);

  if (profile.stage === 'inactive') return null;

  if (profile.stage === 'at-risk') {
    return {
      id: `urgent-${member.id}`,
      lane: 'urgent',
      member,
      profile,
      label: '優先關懷',
      dueLabel: '今天',
      owner: '小組長 / 牧養同工',
      reason: !member.subscribed
        ? '未訂閱，需要確認是否仍願意被關懷'
        : `最後活動 ${lastActivity ? formatDate(lastActivity.toISOString()) : '待確認'}`,
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (profile.stage === 'follow-up') {
    return {
      id: `follow-${member.id}`,
      lane: 'follow-up',
      member,
      profile,
      label: '48 小時跟進',
      dueLabel: '48 小時內',
      owner: '關懷同工',
      reason: `出席 ${member.sessionsCount} 次，尚未形成穩定連結`,
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (profile.stage === 'new') {
    return {
      id: `new-${member.id}`,
      lane: 'newcomer',
      member,
      profile,
      label: '新朋友融入',
      dueLabel: '本週',
      owner: '歡迎同工',
      reason: `首次接觸 ${formatDate(member.firstJoinedAt)}`,
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }

  return {
    id: `growth-${member.id}`,
    lane: 'growth',
    member,
    profile,
    label: '門訓成長',
    dueLabel: '本月',
    owner: '牧師 / 門訓同工',
    reason: `已出席 ${member.sessionsCount} 次，可評估服事或門訓邀請`,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const buildGroups = (members: UnifiedMember[]): SmallGroup[] => {
  const leaders = members.filter((member) => ['leader', 'group_leader', 'minister', 'pastor', 'senior_pastor', 'admin'].includes(member.role || ''));
  const pool = members.filter((member) => member.status !== 'declined');
  const groupNames = ['恩典小組', '信望愛小組', '生命樹小組', '晨光小組'];

  return groupNames.map((name, index) => {
    const groupMembers = pool.filter((_, memberIndex) => memberIndex % groupNames.length === index);
    const stableCount = groupMembers.filter((member) => getCareProfile(member).stage === 'active').length;
    const health = groupMembers.length > 0 ? Math.round((stableCount / groupMembers.length) * 100) : 0;

    return {
      id: `group-${index + 1}`,
      name,
      leader: leaders[index % Math.max(leaders.length, 1)]?.name || '待指派',
      members: groupMembers,
      meetingTime: ['週三 19:30', '週五 20:00', '週六 10:00', '主日 13:30'][index],
      location: ['教會 201 室', '線上 Zoom', '副堂', '家庭聚會點'][index],
      health,
      focus: ['新朋友融入', '穩定讀經', '門徒陪伴', '服事動員'][index],
    };
  });
};

const buildGatherings = (members: UnifiedMember[]): Gathering[] => {
  const activeMembers = members.filter((member) => member.status !== 'declined').length;
  const now = new Date();

  return [
    {
      id: 'sunday-service',
      title: '主日崇拜',
      type: '崇拜',
      date: formatShortDate(now),
      time: '10:00',
      expected: Math.max(activeMembers, 24),
      checkedIn: Math.max(Math.round(activeMembers * 0.72), 12),
      owner: '招待團隊',
      room: '主堂',
      status: '本週',
    },
    {
      id: 'cell-night',
      title: '小組聚會',
      type: '小組',
      date: formatShortDate(subDays(now, -3)),
      time: '19:30',
      expected: Math.max(Math.round(activeMembers * 0.58), 16),
      checkedIn: Math.max(Math.round(activeMembers * 0.44), 10),
      owner: '小組長團隊',
      room: '各小組場地',
      status: '報名中',
    },
    {
      id: 'prayer-meeting',
      title: '禱告會',
      type: '禱告',
      date: formatShortDate(subDays(now, -5)),
      time: '20:00',
      expected: Math.max(Math.round(activeMembers * 0.36), 10),
      checkedIn: Math.max(Math.round(activeMembers * 0.25), 6),
      owner: '牧養團隊',
      room: '副堂',
      status: '報名中',
    },
  ];
};

const buildPrayerCategories = (members: UnifiedMember[], groups: SmallGroup[]): PrayerCategory[] => {
  const activeCount = members.filter((member) => getCareProfile(member).stage === 'active').length;
  const followUpCount = members.filter((member) => getCareProfile(member).stage === 'follow-up').length;
  const atRiskCount = members.filter((member) => getCareProfile(member).stage === 'at-risk').length;
  const pendingCount = members.filter((member) => member.status === 'pending').length;
  const leaderCount = members.filter((member) => ['leader', 'group_leader', 'minister', 'pastor', 'senior_pastor', 'admin'].includes(member.role || '')).length;

  return [
    {
      id: 'church',
      label: '教會',
      description: '主日、同工、牧養決策與教會整體需要',
      count: Math.max(groups.filter((group) => group.members.length > 0).length + leaderCount, 1),
      owner: '牧養團隊',
      urgency: '本週',
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Church,
    },
    {
      id: 'community',
      label: '社區',
      description: '鄰里、家庭、職場、校園與外展接觸點',
      count: Math.max(followUpCount, 2),
      owner: '小組長',
      urgency: '日常',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Home,
    },
    {
      id: 'nation',
      label: '國家',
      description: '公共議題、城市需要與國家守望',
      count: Math.max(Math.round(members.length * 0.08), 1),
      owner: '禱告同工',
      urgency: '日常',
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Landmark,
    },
    {
      id: 'kingdom',
      label: '國度',
      description: '宣教、跨文化、植堂與普世教會連結',
      count: Math.max(Math.round(activeCount * 0.18), 1),
      owner: '宣教同工',
      urgency: '本週',
      tone: 'bg-violet-50 text-violet-700 border-violet-200',
      icon: Globe2,
    },
    {
      id: 'urgent',
      label: '緊急事項',
      description: '疾病、危機、突發需要與立即支援',
      count: atRiskCount,
      owner: '值班同工',
      urgency: '緊急',
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: Siren,
    },
    {
      id: 'care-targets',
      label: '關懷對象',
      description: '新朋友、流失風險、待跟進與需陪伴的人',
      count: pendingCount + atRiskCount,
      owner: '關懷同工',
      urgency: pendingCount + atRiskCount > 0 ? '本週' : '日常',
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: HeartHandshake,
    },
  ];
};

const buildJourneyStages = (members: UnifiedMember[]): JourneyStage[] => {
  const total = Math.max(members.length, 1);
  const newcomers = members.filter((member) => getCareProfile(member).stage === 'new').length;
  const rooted = members.filter((member) => member.sessionsCount >= 2).length;
  const loveGod = members.filter((member) => member.sessionsCount >= 4).length;
  const lovePeople = members.filter((member) => getCareProfile(member).stage === 'active').length;
  const leaders = members.filter((member) => ['leader', 'group_leader', 'minister', 'pastor', 'senior_pastor', 'future_leader', 'admin'].includes(member.role || '')).length;

  return [
    {
      title: '連結與歡迎',
      description: '新朋友、慕道友、第一次留下資料的人',
      count: newcomers,
      completion: Math.round((newcomers / total) * 100),
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      title: '扎根與穩定',
      description: '開始固定參與查經、崇拜或小組',
      count: rooted,
      completion: Math.round((rooted / total) * 100),
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      title: '愛神操練',
      description: '每日靈修、應讀查經、個人禱告進度',
      count: loveGod,
      completion: Math.round((loveGod / total) * 100),
      tone: 'bg-orange-50 text-orange-700',
    },
    {
      title: '愛人實踐',
      description: '代求、關懷、服事與社區行動',
      count: lovePeople,
      completion: Math.round((lovePeople / total) * 100),
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      title: '門徒與領袖',
      description: '愛的旅程門訓、小組長、儲備領袖',
      count: leaders,
      completion: Math.round((leaders / total) * 100),
      tone: 'bg-indigo-50 text-indigo-700',
    },
  ];
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
  <Card className="border bg-card/95 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const CRMPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role: currentRole, isLeader, isAdmin, isSystemAdmin, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [memberTab, setMemberTab] = useState<MemberTab>('all');
  const [taskFilter, setTaskFilter] = useState<PastoralTaskFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [role, setRole] = useState<AppRole | 'all'>('all');
  const [selectedChurch, setSelectedChurch] = useState<string>('all');
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [search, setSearch] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [crmGroups, setCrmGroups] = useState<CrmGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupChurch, setNewGroupChurch] = useState('');
  const [groupActionBusy, setGroupActionBusy] = useState(false);
  const [churchScopeInitialized, setChurchScopeInitialized] = useState(false);

  const {
    data: rawMembers,
    isLoading,
    isRefetching,
    stats,
    statsLoading,
    updateRole,
    updatePotentialMember,
    deleteMember,
    forceRefetch,
  } = useUnifiedMembers({ tab: memberTab, status, role, church: selectedChurch });

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
  }, []);

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

  const fetchCrmGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const groupQuery = selectedChurch !== 'all' ? `?${new URLSearchParams({ church: selectedChurch }).toString()}` : '';
      const response = await fetch(`/api/crm/groups${groupQuery}`);
      if (!response.ok) return;
      const data = await response.json();
      setCrmGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching CRM groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, [selectedChurch]);

  useEffect(() => {
    fetchCrmGroups();
  }, [fetchCrmGroups]);

  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const sessionQuery = selectedChurch !== 'all' ? `?${new URLSearchParams({ church: selectedChurch }).toString()}` : '';
        const response = await fetch(`/api/sessions${sessionQuery}`);
        if (!response.ok) return;
        const sessions = await response.json();
        const waitingSession = sessions.find((session: { status: string }) => session.status === 'waiting');
        if (waitingSession) setActiveSessionId(waitingSession.id);
      } catch (error) {
        console.error('Error fetching active session:', error);
      }
    };

    fetchActiveSession();
  }, [selectedChurch]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [memberTab, status, role]);

  const members = useMemo(() => {
    const list = rawMembers || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((member) =>
      [member.name, member.email, member.gender || '', member.church || '', member.role || '', member.status]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [rawMembers, search]);

  const allMembers = useMemo(() => rawMembers ?? [], [rawMembers]);
  const currentChurchName = selectedChurch === 'all'
    ? '全部教會'
    : churches.find((church) => church.id === selectedChurch)?.name || selectedChurch;
  const groups = useMemo(() => buildGroups(allMembers), [allMembers]);
  const gatherings = useMemo(() => buildGatherings(allMembers), [allMembers]);
  const prayerCategories = useMemo(() => buildPrayerCategories(allMembers, groups), [allMembers, groups]);
  const journeyStages = useMemo(() => buildJourneyStages(allMembers), [allMembers]);
  const careQueue = useMemo(() => {
    return [...allMembers]
      .map((member) => ({ member, profile: getCareProfile(member) }))
      .sort((a, b) => a.profile.priority - b.profile.priority || b.member.sessionsCount - a.member.sessionsCount);
  }, [allMembers]);
  const pastoralTasks = useMemo(
    () => careQueue
      .map(({ member, profile }) => buildPastoralTask(member, profile))
      .filter((task): task is PastoralTask => Boolean(task)),
    [careQueue]
  );
  const visiblePastoralTasks = useMemo(
    () => taskFilter === 'all'
      ? pastoralTasks
      : pastoralTasks.filter((task) => task.lane === taskFilter),
    [pastoralTasks, taskFilter]
  );
  const taskCounts = useMemo(
    () => ({
      all: pastoralTasks.length,
      urgent: pastoralTasks.filter((task) => task.lane === 'urgent').length,
      'follow-up': pastoralTasks.filter((task) => task.lane === 'follow-up').length,
      newcomer: pastoralTasks.filter((task) => task.lane === 'newcomer').length,
      growth: pastoralTasks.filter((task) => task.lane === 'growth').length,
    }),
    [pastoralTasks]
  );

  const overview = useMemo(() => {
    const activeCount = allMembers.filter((member) => getCareProfile(member).stage === 'active').length;
    const atRiskCount = allMembers.filter((member) => getCareProfile(member).stage === 'at-risk').length;
    const newCount = allMembers.filter((member) => getCareProfile(member).stage === 'new').length;
    const subscribedCount = allMembers.filter((member) => member.subscribed).length;
    const engagement = allMembers.length > 0 ? Math.round((subscribedCount / allMembers.length) * 100) : 0;
    const attendanceRate =
      gatherings.length > 0
        ? Math.round(
            (gatherings.reduce((sum, item) => sum + item.checkedIn, 0) /
              gatherings.reduce((sum, item) => sum + item.expected, 0)) *
              100
          )
        : 0;

    return { activeCount, atRiskCount, newCount, subscribedCount, engagement, attendanceRate };
  }, [allMembers, gatherings]);
  const groupCoverage = useMemo(() => {
    if (allMembers.length === 0) return 0;
    const assigned = groups.reduce((sum, group) => sum + group.members.length, 0);
    return Math.min(100, Math.round((assigned / allMembers.length) * 100));
  }, [allMembers.length, groups]);
  const meetingHealthScore = useMemo(() => {
    if (allMembers.length === 0) return 100;
    const openCareLoad = taskCounts.urgent + taskCounts['follow-up'];
    return Math.max(0, Math.round(100 - (openCareLoad / allMembers.length) * 100));
  }, [allMembers.length, taskCounts]);
  const meetingAgenda = useMemo<MeetingAgendaItem[]>(
    () => [
      {
        id: 'urgent',
        title: '先處理流失風險',
        owner: '小組長 / 牧養同工',
        count: taskCounts.urgent,
        detail: '今天需要主動聯絡的對象',
        action: '打開名單',
        icon: Siren,
        tone: 'border-rose-200 bg-rose-50 text-rose-700',
      },
      {
        id: 'newcomer',
        title: '新朋友融入',
        owner: '歡迎同工',
        count: taskCounts.newcomer,
        detail: '本週要歡迎、連結、安排小組',
        action: '安排跟進',
        icon: UserPlus,
        tone: 'border-sky-200 bg-sky-50 text-sky-700',
      },
      {
        id: 'groups',
        title: '小組覆蓋檢查',
        owner: '區牧 / 小組長',
        count: groups.filter((group) => group.members.length > 0).length,
        detail: `${groupCoverage}% 會友已在小組節奏內`,
        action: '查看小組',
        icon: Users,
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      },
      {
        id: 'journey',
        title: '門訓推進',
        owner: '牧師 / 門訓同工',
        count: taskCounts.growth,
        detail: '可邀請進入愛的旅程或服事',
        action: '看門訓',
        icon: Target,
        tone: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      },
      {
        id: 'prayers',
        title: '代求守望',
        owner: '禱告同工',
        count: prayerCategories.reduce((sum, item) => sum + item.count, 0),
        detail: '教會、社區、國家、國度與緊急需要',
        action: '看代求',
        icon: ClipboardList,
        tone: 'border-violet-200 bg-violet-50 text-violet-700',
      },
    ],
    [groupCoverage, groups, prayerCategories, taskCounts]
  );
  const roleWorkflows = useMemo<RoleWorkflow[]>(
    () => [
      {
        title: '主任牧師',
        scope: '全教會視角',
        metric: `${taskCounts.all} 件待分辨任務`,
        actions: ['確認本週牧養優先序', '指派牧師與傳道人範圍', '追蹤小組覆蓋與門訓推進'],
        icon: Crown,
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      {
        title: '牧師 / 傳道人',
        scope: '被指派的小組與名單',
        metric: `${taskCounts.urgent + taskCounts['follow-up']} 件關懷壓力`,
        actions: ['跟進高風險名單', '協助小組長處理複雜個案', '將可成長者接入門訓'],
        icon: HeartHandshake,
        tone: 'border-rose-200 bg-rose-50 text-rose-700',
      },
      {
        title: '小組長',
        scope: '自己的小組',
        metric: `${taskCounts.newcomer} 位新朋友待融入`,
        actions: ['確認出席與近況', '安排新朋友進小組', '回報需要牧者介入的人'],
        icon: Home,
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      },
    ],
    [taskCounts]
  );

  const integrationModules = useMemo(
    () => [
      {
        title: '愛神',
        description: '每日靈修、應讀查經、個人禱告進度會回流到 CRM，讓牧者看見屬靈操練節奏。',
        value: `${journeyStages[2]?.completion ?? 0}%`,
        helper: '愛神操練完成度',
        icon: BookOpen,
        tone: 'bg-orange-50 text-orange-700',
      },
      {
        title: '愛人',
        description: '代求、關懷、服事、社區行動形成愛人儀錶板，幫助小組長知道下一步。',
        value: overview.activeCount,
        helper: '穩定委身者',
        icon: HeartHandshake,
        tone: 'bg-rose-50 text-rose-700',
      },
      {
        title: '小組',
        description: '小組成員、出席、查經參與和關懷任務集中呈現，避免資料散在不同地方。',
        value: groups.length,
        helper: '可管理小組',
        icon: Users,
        tone: 'bg-emerald-50 text-emerald-700',
      },
      {
        title: '愛的旅程',
        description: '把新朋友、扎根、操練、服事、領袖培育串成可追蹤的門訓路徑。',
        value: journeyStages[journeyStages.length - 1]?.count ?? 0,
        helper: '門徒/領袖階段',
        icon: Target,
        tone: 'bg-indigo-50 text-indigo-700',
      },
    ],
    [groups.length, journeyStages, overview.activeCount]
  );

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
    const selectableIds = members.filter((member) => member.type === 'potential').map((member) => member.id);
    const allSelected = selectableIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  };

  const handleBulkUpdateStatus = (_newStatus: PotentialMember['status']) => {
    toast.info('批量更新狀態功能尚未串接後端');
    setSelectedIds(new Set());
  };

  const handleBulkUpdateSubscription = (_newSubscribed: boolean) => {
    toast.info('批量更新訂閱功能尚未串接後端');
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    toast.info('批量刪除功能尚未串接後端');
    setSelectedIds(new Set());
  };

  const handleUpdateRole = (userId: string, newRole: AppRole) => {
    updateRole.mutate({ userId, newRole });
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

  const handleOpenTaskMember = (task: PastoralTask) => {
    setWorkspaceTab('members');
    setMemberTab(task.member.type === 'registered' ? 'registered' : 'potential');
    setStatus('all');
    setRole('all');
    setSearch(task.member.email || task.member.name);
  };

  const handleOpenTaskLane = (filter: PastoralTaskFilter) => {
    setTaskFilter(filter);
    setWorkspaceTab('care');
  };

  const handleOpenAgenda = (item: MeetingAgendaItem) => {
    if (item.id === 'groups') {
      setWorkspaceTab('groups');
      return;
    }
    if (item.id === 'journey') {
      setWorkspaceTab('journey');
      return;
    }
    if (item.id === 'prayers') {
      setWorkspaceTab('prayers');
      return;
    }
    handleOpenTaskLane(item.id);
  };

  const handleCopyMemberEmail = async (member: UnifiedMember) => {
    if (!member.email) {
      toast.info('這位會員沒有 Email');
      return;
    }
    await navigator.clipboard.writeText(member.email);
    toast.success(`已複製 ${member.name} 的 Email`);
  };

  const handleCareRecordPlaceholder = () => {
    toast.info('下一步會把關懷紀錄串接成可追蹤的任務完成狀態');
  };

  const handleLinkUser = (id: string) => {
    setSelectedMemberId(id);
    setLinkDialogOpen(true);
  };

  const handleLinkConfirm = (_potentialMemberId: string, _userId: string) => {
    toast.info('手動連結用戶功能尚未串接後端');
  };

  const handleDeleteClick = (id: string) => {
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

  const handleCopyEmails = () => {
    const emails = members
      .filter((member) => member.subscribed && member.email)
      .map((member) => member.email)
      .join(', ');

    if (!emails) {
      toast.info('沒有可複製的 Email');
      return;
    }

    navigator.clipboard.writeText(emails);
    toast.success(`已複製 ${emails.split(',').length} 個 Email`);
  };

  const handleSimulate = () => {
    toast.info('模擬功能暫時停用');
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
              <p className="truncate text-sm text-muted-foreground">
                {currentChurchName} ・ 愛神、愛人、門訓、小組與牧養整合面板
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedChurch} onValueChange={setSelectedChurch}>
              <SelectTrigger className="hidden w-[170px] sm:flex">
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
            <Button variant="outline" size="sm" onClick={handleCopyEmails} className="hidden gap-2 sm:inline-flex">
              <Copy className="h-4 w-4" />
              複製名單
            </Button>
            <Button variant="outline" size="sm" onClick={forceRefetch} disabled={isRefetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        <section className="sm:hidden">
          <Select value={selectedChurch} onValueChange={setSelectedChurch}>
            <SelectTrigger>
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsLoading ? (
            [...Array(4)].map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)
          ) : (
            <>
              <StatTile
                title="總會友資料"
                value={(stats?.registeredCount ?? 0) + (stats?.potentialTotal ?? 0)}
                helper={`本週新增 ${stats?.newThisWeek ?? 0} 人`}
                icon={Users}
                tone="bg-sky-50 text-sky-700"
              />
              <StatTile
                title="小組覆蓋"
                value={`${groups.filter((group) => group.members.length > 0).length}/${groups.length}`}
                helper={`${groups.reduce((sum, group) => sum + group.members.length, 0)} 人已分派`}
                icon={Home}
                tone="bg-emerald-50 text-emerald-700"
              />
              <StatTile
                title="聚會出席率"
                value={`${overview.attendanceRate}%`}
                helper="依近期聚會預估"
                icon={CalendarDays}
                tone="bg-orange-50 text-orange-700"
              />
              <StatTile
                title="需關懷"
                value={overview.atRiskCount + (stats?.pendingCount ?? 0)}
                helper={`${overview.newCount} 位新朋友待融入`}
                icon={HeartHandshake}
                tone="bg-rose-50 text-rose-700"
              />
            </>
          )}
        </section>

        <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)} className="space-y-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 p-1">
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
              <TabsTrigger value="groups" className="gap-2">
                <Users className="h-4 w-4" />
                小組
              </TabsTrigger>
              <TabsTrigger value="gatherings" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                聚會
              </TabsTrigger>
              <TabsTrigger value="serving" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                排班
              </TabsTrigger>
              <TabsTrigger value="facilities" className="gap-2">
                <Landmark className="h-4 w-4" />
                場地
              </TabsTrigger>
              <TabsTrigger value="framework" className="gap-2">
                <Target className="h-4 w-4" />
                框架
              </TabsTrigger>
              <TabsTrigger value="line" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                LINE
              </TabsTrigger>
              <TabsTrigger value="care" className="gap-2">
                <HeartHandshake className="h-4 w-4" />
                關懷
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2">
                <UserCheck className="h-4 w-4" />
                會員
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-5">
            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>{currentChurchName} 牧養會議作戰室</CardTitle>
                      <p className="text-sm text-muted-foreground">週一同工會議 ・ 主日後 48 小時牧養節奏</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Activity className="h-3.5 w-3.5" />
                        健康度 {meetingHealthScore}%
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3.5 w-3.5" />
                        小組覆蓋 {groupCoverage}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    {meetingAgenda.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOpenAgenda(item)}
                        className={`rounded-lg border p-3 text-left transition-colors hover:bg-background ${item.tone}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <item.icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{item.owner}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-2xl font-bold">{item.count}</p>
                        <p className="mt-1 min-h-10 text-xs leading-5">{item.detail}</p>
                        <span className="mt-3 inline-flex items-center text-xs font-medium">
                          {item.action}
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    {roleWorkflows.map((workflow) => (
                      <div key={workflow.title} className={`rounded-lg border p-3 ${workflow.tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{workflow.title}</p>
                            <p className="mt-1 text-xs">{workflow.scope}</p>
                          </div>
                          <workflow.icon className="h-4 w-4" />
                        </div>
                        <p className="mt-3 text-sm font-medium">{workflow.metric}</p>
                        <div className="mt-3 space-y-1">
                          {workflow.actions.map((action) => (
                            <p key={action} className="flex items-start gap-2 text-xs leading-5">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{action}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>本週決策順序</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: '1', title: '先確認高風險名單', helper: `${taskCounts.urgent} 人今天要被聯絡`, filter: 'urgent' as PastoralTaskFilter },
                    { label: '2', title: '再安排新朋友歸屬', helper: `${taskCounts.newcomer} 人需要歡迎與小組`, filter: 'newcomer' as PastoralTaskFilter },
                    { label: '3', title: '最後推進門訓成長', helper: `${taskCounts.growth} 人可進入服事或愛的旅程`, filter: 'growth' as PastoralTaskFilter },
                  ].map((step) => (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => handleOpenTaskLane(step.filter)}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {step.label}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{step.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{step.helper}</span>
                      </span>
                      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">牧養負載</span>
                      <span className="font-medium">{taskCounts.urgent + taskCounts['follow-up']} / {Math.max(allMembers.length, 1)}</span>
                    </div>
                    <Progress value={Math.min(100, ((taskCounts.urgent + taskCounts['follow-up']) / Math.max(allMembers.length, 1)) * 100)} className="mt-2" />
                    <p className="mt-2 text-xs text-muted-foreground">主任牧師分派牧養範圍參考</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>牧養任務中心</CardTitle>
                      <p className="text-sm text-muted-foreground">把全教會名單轉成今天可分派、可追蹤的工作</p>
                    </div>
                    <Badge variant="outline">{currentChurchName}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleOpenTaskLane('urgent')}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-left text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      <p className="text-xs font-medium">今天優先</p>
                      <p className="mt-1 text-2xl font-bold">{taskCounts.urgent}</p>
                      <p className="mt-1 text-xs">流失風險與未訂閱對象</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskLane('follow-up')}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      <p className="text-xs font-medium">48 小時跟進</p>
                      <p className="mt-1 text-2xl font-bold">{taskCounts['follow-up']}</p>
                      <p className="mt-1 text-xs">近期出席但尚未穩定</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskLane('newcomer')}
                      className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-left text-sky-700 transition-colors hover:bg-sky-100"
                    >
                      <p className="text-xs font-medium">新朋友融入</p>
                      <p className="mt-1 text-2xl font-bold">{taskCounts.newcomer}</p>
                      <p className="mt-1 text-xs">本週需要歡迎與連結</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskLane('growth')}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <p className="text-xs font-medium">門訓成長</p>
                      <p className="mt-1 text-2xl font-bold">{taskCounts.growth}</p>
                      <p className="mt-1 text-xs">可邀請服事或愛的旅程</p>
                    </button>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => handleOpenTaskLane('all')}>
                    <ClipboardList className="h-4 w-4" />
                    打開完整任務清單
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>下一步行動</CardTitle>
                      <p className="text-sm text-muted-foreground">依緊急度排序，讓領袖先處理最需要的人</p>
                    </div>
                    <Badge variant="secondary">{taskCounts.all} 件任務</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pastoralTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{task.member.name}</p>
                          <Badge variant="outline" className={task.tone}>
                            {task.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{task.dueLabel}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">負責：{task.owner}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleOpenTaskMember(task)}>
                        查看
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {pastoralTasks.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">目前沒有待處理的牧養任務</p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>牧養健康度</CardTitle>
                      <p className="text-sm text-muted-foreground">把名單轉成可行動的牧養狀態</p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      即時計算
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">穩定委身</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-700">{overview.activeCount}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">新朋友</p>
                      <p className="mt-2 text-2xl font-bold text-sky-700">{overview.newCount}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">流失風險</p>
                      <p className="mt-2 text-2xl font-bold text-rose-700">{overview.atRiskCount}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">可聯絡比例</span>
                      <span className="font-medium">{overview.engagement}%</span>
                    </div>
                    <Progress value={overview.engagement} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">聚會出席達成</span>
                      <span className="font-medium">{overview.attendanceRate}%</span>
                    </div>
                    <Progress value={overview.attendanceRate} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>今日優先事項</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pastoralTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{task.member.name}</p>
                          <Badge variant="outline" className={task.tone}>
                            {task.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.profile.action}</p>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="查看關懷" onClick={() => handleOpenTaskMember(task)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {pastoralTasks.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">尚無關懷資料</p>}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">WeChurch Online 整合架構</h2>
                <p className="text-sm text-muted-foreground">
                  前台的愛神與愛人儀錶板，會在 CRM 形成牧養、門訓與關懷可追蹤資料。
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {integrationModules.map((module) => (
                  <Card key={module.title}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{module.title}</p>
                          <p className="mt-2 text-2xl font-bold">{module.value}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{module.helper}</p>
                        </div>
                        <div className={`rounded-lg p-2 ${module.tone}`}>
                          <module.icon className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">{module.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {groups.slice(0, 3).map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{group.leader}</p>
                      </div>
                      <Badge variant="secondary">{group.members.length} 人</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {group.meetingTime}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {group.location}
                    </div>
                    <Progress value={group.health} />
                    <p className="text-xs text-muted-foreground">小組健康度 {group.health}% ・ {group.focus}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="journey" className="space-y-5">
            <FeatureGate featureKey="pastoral_beta" title="牧養 beta 測試中" description="個人牧養與愛的旅程目前只開放給 beta 同工">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">個人使用與愛的旅程</h2>
                <p className="text-sm text-muted-foreground">把個人的愛神操練與愛人實踐，接回小組和牧養 CRM。</p>
              </div>
            </div>

            <PastoralJourneyPanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} />

            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>個人首頁同步資料</CardTitle>
                  <p className="text-sm text-muted-foreground">使用者每天看到自己的內容，同時留下牧養可用的訊號。</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      title: '應讀查經內容',
                      description: '讀經計畫、查經作業與小組教材進度',
                      icon: BookOpen,
                      tone: 'bg-sky-50 text-sky-700',
                    },
                    {
                      title: '每日靈修進度',
                      description: '愛神儀錶板的穩定度、缺席提醒與成長紀錄',
                      icon: Sparkles,
                      tone: 'bg-orange-50 text-orange-700',
                    },
                    {
                      title: '個人禱告事項',
                      description: '私人、可分享、小組代求與關懷對象連結',
                      icon: MessageCircle,
                      tone: 'bg-rose-50 text-rose-700',
                    },
                    {
                      title: '愛人行動',
                      description: '關懷回覆、服事參與、社區行動與代禱回應',
                      icon: HeartHandshake,
                      tone: 'bg-emerald-50 text-emerald-700',
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3 rounded-lg border p-3">
                      <div className={`h-10 w-10 shrink-0 rounded-lg p-2 ${item.tone}`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>愛的旅程門訓管線</CardTitle>
                  <p className="text-sm text-muted-foreground">從新朋友到門徒領袖，每個階段都能被小組長與牧養團隊看見。</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {journeyStages.map((stage, index) => (
                    <div key={stage.title} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold ${stage.tone}`}>
                              {index + 1}
                            </span>
                            <p className="font-semibold">{stage.title}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{stage.count}</p>
                          <p className="text-xs text-muted-foreground">人</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>階段覆蓋</span>
                          <span>{stage.completion}%</span>
                        </div>
                        <Progress value={stage.completion} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
            </FeatureGate>
          </TabsContent>

          <TabsContent value="prayers" className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">代求事項中心</h2>
                <p className="text-sm text-muted-foreground">教會、社區、國家、國度、緊急事項與關懷對象都回到 CRM 追蹤。</p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新增代求事項
              </Button>
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {prayerCategories.map((category) => (
                <Card key={category.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className={`h-10 w-10 shrink-0 rounded-lg border p-2 ${category.tone}`}>
                          <category.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{category.label}</p>
                            <Badge
                              variant={category.urgency === '緊急' ? 'destructive' : category.urgency === '本週' ? 'default' : 'secondary'}
                            >
                              {category.urgency}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{category.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{category.count}</p>
                        <p className="text-xs text-muted-foreground">事項</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">負責</span>
                      <span className="font-medium">{category.owner}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>代求與 CRM 的資料流</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="font-medium">小組員提交</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">個人禱告可選擇私人、小組可見、同工可見，保留隱私分級。</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">小組長掌握</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">小組代求、出席異常、關懷對象會合併到小組工作台。</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">牧養團隊追蹤</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">緊急事項、長期關懷、門訓階段可以形成跨團隊交接紀錄。</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">小組管理</h2>
                <p className="text-sm text-muted-foreground">查看小組人數、健康度、聚會時間與牧養焦點</p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新增小組
              </Button>
            </div>

            <section className="grid gap-4 lg:grid-cols-2">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{group.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">小組長：{group.leader}</p>
                      </div>
                      <Badge variant={group.health >= 60 ? 'default' : 'secondary'}>{group.health}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">人數</p>
                        <p className="mt-1 text-lg font-semibold">{group.members.length}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">聚會</p>
                        <p className="mt-1 text-sm font-medium">{group.meetingTime}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">焦點</p>
                        <p className="mt-1 text-sm font-medium">{group.focus}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.members.slice(0, 5).map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{member.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                          <Badge variant="outline">{member.role ? roleLabels[member.role] : statusLabels[member.status]}</Badge>
                        </div>
                      ))}
                      {group.members.length === 0 && (
                        <p className="rounded-lg border py-6 text-center text-sm text-muted-foreground">尚未分派成員</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="gatherings" className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">聚會管理</h2>
                <p className="text-sm text-muted-foreground">追蹤崇拜、小組、禱告會與活動出席</p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                建立聚會
              </Button>
            </div>

            <section className="grid gap-4">
              {gatherings.map((gathering) => {
                const rate = gathering.expected > 0 ? Math.round((gathering.checkedIn / gathering.expected) * 100) : 0;
                return (
                  <Card key={gathering.id}>
                    <CardContent className="p-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr_240px_160px] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{gathering.type}</Badge>
                            <Badge variant={gathering.status === '本週' ? 'default' : 'secondary'}>{gathering.status}</Badge>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold">{gathering.title}</h3>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" />
                              {gathering.date} {gathering.time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {gathering.room}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {gathering.owner}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">報到進度</span>
                            <span className="font-medium">{rate}%</span>
                          </div>
                          <Progress value={rate} />
                          <p className="text-xs text-muted-foreground">
                            {gathering.checkedIn} 已報到 / {gathering.expected} 預計
                          </p>
                        </div>
                        <div className="flex gap-2 lg:justify-end">
                          <Button variant="outline" size="sm" className="gap-2">
                            <UserCheck className="h-4 w-4" />
                            點名
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="更多聚會操作">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          </TabsContent>

          <TabsContent value="serving" className="space-y-5">
            <FeatureGate featureKey="serving_beta" title="排班 beta 測試中" description="服事排班目前只開放給 beta 同工">
              <ServingSchedulePanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} />
            </FeatureGate>
          </TabsContent>

          <TabsContent value="facilities" className="space-y-5">
            <FeatureGate featureKey="facilities_beta" title="場地 beta 測試中" description="場地預約目前只開放給 beta 同工">
              <FacilityBookingPanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} />
            </FeatureGate>
          </TabsContent>

          <TabsContent value="framework" className="space-y-5">
            <FeatureGate featureKey="framework_beta" title="牧養框架 beta 測試中" description="牧養框架目前只開放給 beta 同工">
              <PastoralFrameworkPanel selectedChurch={selectedChurch} currentChurchName={currentChurchName} />
            </FeatureGate>
          </TabsContent>

          <TabsContent value="line" className="space-y-5">
            <FeatureGate featureKey="line_login_beta" title="LINE beta 測試中" description="LINE 登入目前只開放給 beta 同工">
              <LineIntegrationPanel />
            </FeatureGate>
          </TabsContent>

          <TabsContent value="care" className="space-y-5">
            <FeatureGate featureKey="pastoral_beta" title="關懷 beta 測試中" description="牧養關懷任務目前只開放給 beta 同工">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">牧養任務清單</h2>
                <p className="text-sm text-muted-foreground">依出席、訂閱、新朋友與門訓狀態產生可分派任務</p>
              </div>
              <Button className="gap-2" onClick={handleCareRecordPlaceholder}>
                <MessageCircle className="h-4 w-4" />
                建立關懷紀錄
              </Button>
            </div>

            <section className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'all' as const, label: '全部', count: taskCounts.all },
                { id: 'urgent' as const, label: '今天優先', count: taskCounts.urgent },
                { id: 'follow-up' as const, label: '48 小時', count: taskCounts['follow-up'] },
                { id: 'newcomer' as const, label: '新朋友', count: taskCounts.newcomer },
                { id: 'growth' as const, label: '門訓成長', count: taskCounts.growth },
              ].map((item) => (
                <Button
                  key={item.id}
                  variant={taskFilter === item.id ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setTaskFilter(item.id)}
                >
                  {item.label}
                  <Badge variant="secondary" className="ml-1">
                    {item.count}
                  </Badge>
                </Button>
              ))}
            </section>

            <section className="grid gap-3">
              {visiblePastoralTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px_150px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{task.member.name}</p>
                          <Badge variant="outline" className={task.tone}>
                            {task.label}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {task.dueLabel}
                          </Badge>
                          {!task.member.subscribed && (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <BellOff className="h-3 w-3" />
                              未訂閱
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {task.member.email || '未提供 Email'}
                          </span>
                          <span>出席 {task.member.sessionsCount} 次</span>
                          <span>最後活動 {formatDate(task.member.lastSessionAt)}</span>
                          <span>負責 {task.owner}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">建議下一步</p>
                        <p className="mt-1 text-sm font-medium">{task.profile.action}</p>
                      </div>
                      <div className="flex gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleCopyMemberEmail(task.member)}>
                          <Phone className="h-4 w-4" />
                          聯絡
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="查看會員" onClick={() => handleOpenTaskMember(task)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {visiblePastoralTasks.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    目前沒有符合條件的牧養任務
                  </CardContent>
                </Card>
              )}
            </section>
            </FeatureGate>
          </TabsContent>

          <TabsContent value="members" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <Tabs value={memberTab} onValueChange={(value) => setMemberTab(value as MemberTab)}>
                    <TabsList className="h-auto flex-wrap justify-start">
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

                  <div className="flex flex-wrap gap-2">
                    {activeSessionId && (
                      <Button variant="outline" size="sm" onClick={handleSimulate} className="gap-2">
                        <FlaskConical className="h-4 w-4" />
                        模擬
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleCopyEmails} className="gap-2 sm:hidden">
                      <Copy className="h-4 w-4" />
                      複製 Email
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜尋姓名、Email、角色或狀態"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(memberTab === 'all' || memberTab === 'registered') && isAdmin && (
                      <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                        <SelectTrigger className="w-[140px]">
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
                        <SelectTrigger className="w-[140px]">
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
                  </div>
                </div>

                {isAdmin && (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 lg:grid-cols-[1fr_160px_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">最高權限會員調整</p>
                      <p className="text-xs text-muted-foreground">
                        目前顯示 {currentChurchName}，可建立小組、調整所屬教會，或在會員列把成員分到小組。
                      </p>
                    </div>
                    <Select value={newGroupChurch} onValueChange={setNewGroupChurch}>
                      <SelectTrigger>
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
                )}

                {selectedIds.size > 0 && (
                  <CRMBulkActions
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onBulkUpdateStatus={handleBulkUpdateStatus}
                    onBulkUpdateSubscription={handleBulkUpdateSubscription}
                    onBulkDelete={handleBulkDelete}
                    isUpdating={false}
                  />
                )}

                {memberTab === 'incomplete' ? (
                  <IncompleteMembersPanel />
                ) : isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, index) => (
                      <Skeleton key={index} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : members.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>尚無符合條件的會員資料</p>
                    <p className="text-sm">調整搜尋或篩選條件後再試一次</p>
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {members.map((member) => {
                      const profile = getCareProfile(member);
                      return (
                        <Card key={member.id} className={selectedIds.has(member.id) ? 'ring-2 ring-primary' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={member.type === 'registered' ? 'default' : 'secondary'}>
                                    {member.type === 'registered' ? '會員' : '潛在'}
                                  </Badge>
                                  <Badge variant="outline" className={profile.tone}>
                                    {profile.label}
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
                                  <Button variant="ghost" size="icon" aria-label="會員操作">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                                      <DropdownMenuItem onClick={() => handleLinkUser(member.potentialMemberId!)}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        手動連結用戶
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
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>角色</DropdownMenuLabel>
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
                                    </>
                                  )}
                                  {member.type === 'potential' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteClick(member.potentialMemberId!)}
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
                    members={members}
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
                    isAdmin={isAdmin}
                    groups={crmGroups}
                    churches={churchOptionsForActions}
                    groupsLoading={groupsLoading}
                  />
                )}

                {memberTab !== 'incomplete' && members.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground">顯示 {members.length} 筆資料</p>
                )}
              </CardContent>
            </Card>
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
            <AlertDialogDescription>此操作將永久刪除該會員資料，無法復原。</AlertDialogDescription>
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
    </div>
  );
};

export default CRMPage;
