import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import {
  Dumbbell,
  BookOpen,
  Gamepad2,
  Share2,
  Heart,
  Home,
  LogOut,
  BookMarked,
  Settings,
  User,
  HandHeart,
  MessageCircleHeart,
  Landmark,
  Users,
  PenLine,
  ChevronDown,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { appNavItems, isNavItemActive } from '@/lib/navigation';
import { useUserRole } from '@/hooks/useUserRole';
import { useCareContacts } from '@/hooks/useCareContacts';
import { usePrayerWall } from '@/hooks/usePrayerWall';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { fetchChurchReadingForToday, getChurchReadingForToday } from '@/lib/churchReading';
import {
  createLocalDevotionalNoteId,
  mergeLocalDevotionalNotes,
  upsertLocalDevotionalNote,
} from '@/lib/localDevotionalNotes';

interface DevotionalNoteSummary {
  id: string;
  userId?: string | null;
  verseReference: string;
  verseText: string;
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  coreInsightCategory?: string | null;
  coreInsightNote: string | null;
  scholarsNote?: string | null;
  actionPlan: string | null;
  coolDownNote: string | null;
  readingPlanId: string | null;
  dayNumber: number | null;
  createdAt?: string;
  updatedAt: string;
}

interface PersonalPrayerRecord {
  id: string;
  title: string;
  prayer?: string;
  response?: string;
  status?: 'waiting' | 'answered' | 'grace_response';
  createdAt: string;
}

interface HomeDevotionalDraft {
  observation: string;
  receiving: string;
  actionPlan: string;
}

const GRACE_RECORD_STORAGE_KEY = 'wechurch_grace_records_v1';
const RECEIVE_KEY = 'GOD_ATTRIBUTE';
const EMPTY_DEVOTIONAL_DRAFT: HomeDevotionalDraft = {
  observation: '',
  receiving: '',
  actionPlan: '',
};
const HOME_SECTION_STATE_KEY = 'wechurch_home_section_open_v3';
const DEFAULT_HOME_SECTIONS: Record<string, boolean> = {
  scripture: true,
  devotional: false,
  devotionalNote: false,
  personalPrayer: true,
  intercession: true,
  communityPrayer: false,
  care: false,
};

function getCoreInsightText(raw: string | null | undefined) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join('\n');
    }
  } catch {
  }
  return raw;
}

function updateHomeDevotionalDraft(
  setDraft: Dispatch<SetStateAction<HomeDevotionalDraft>>,
  key: keyof HomeDevotionalDraft,
  value: string
) {
  setDraft((current) => ({ ...current, [key]: value }));
}

interface HomeSectionProps {
  id: string;
  title: string;
  summary: string;
  icon: ReactNode;
  action?: ReactNode;
  openSections: Record<string, boolean>;
  setOpenSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  children: ReactNode;
}

function HomeSection({
  id,
  title,
  summary,
  icon,
  action,
  openSections,
  setOpenSections,
  children,
}: HomeSectionProps) {
  const isOpen = !!openSections[id];

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(nextOpen) =>
        setOpenSections((current) => ({
          ...current,
          [id]: nextOpen,
        }))
      }
    >
      <div className="border-b border-border/60 last:border-b-0">
        <div className="flex items-center gap-2 p-3 sm:p-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group/home -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`${isOpen ? '收合' : '展開'}${title}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background shadow-sm transition-colors group-hover/home:bg-muted/60">
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">{title}</span>
                <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">{summary}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          {action && (
            <div className="shrink-0 [&_a]:inline-flex [&_a]:h-8 [&_a]:items-center [&_a]:rounded-md [&_a]:px-2.5 [&_a]:text-xs [&_a]:font-semibold [&_a]:transition-colors [&_a]:hover:bg-muted [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring">
              {action}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-4 sm:px-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { canCreateSession } = useUserRole();
  const { contacts: careContacts } = useCareContacts();
  const { isFeatureEnabled, loading: featuresLoading } = useFeatureToggles();
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [personalPrayerRecords, setPersonalPrayerRecords] = useState<PersonalPrayerRecord[]>([]);
  const [devotionalDraft, setDevotionalDraft] = useState<HomeDevotionalDraft>(EMPTY_DEVOTIONAL_DRAFT);
  const [savedHomeDevotionalNote, setSavedHomeDevotionalNote] = useState<DevotionalNoteSummary | null>(null);
  const [isSavingDevotional, setIsSavingDevotional] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_HOME_SECTIONS;

    try {
      const raw = localStorage.getItem(HOME_SECTION_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...DEFAULT_HOME_SECTIONS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch {
      return DEFAULT_HOME_SECTIONS;
    }
  });

  const { data: homePrayers = [] } = usePrayerWall();

  const { data: devotionalNotes = [], isLoading: devotionalNotesLoading } = useQuery<DevotionalNoteSummary[]>({
    queryKey: ['/api/devotional-notes'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/devotional-notes', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch devotional notes');
        return mergeLocalDevotionalNotes((await res.json()) as DevotionalNoteSummary[]);
      } catch {
        return mergeLocalDevotionalNotes<DevotionalNoteSummary>([]);
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60000,
  });

  const fallbackChurchReading = useMemo(() => getChurchReadingForToday(), []);
  const { data: syncedChurchReading } = useQuery({
    queryKey: ['/api/church-reading/today'],
    queryFn: () => fetchChurchReadingForToday(),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      navigate(`/user/study?session=${sessionId}`);
    }
  }, [searchParams, navigate]);

  const loadPersonalPrayers = () => {
    try {
      const raw = localStorage.getItem(GRACE_RECORD_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setPersonalPrayerRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPersonalPrayerRecords([]);
    }
  };

  useEffect(() => {
    loadPersonalPrayers();
    window.addEventListener('storage', loadPersonalPrayers);
    window.addEventListener('wechurch:grace-records-updated', loadPersonalPrayers);
    return () => {
      window.removeEventListener('storage', loadPersonalPrayers);
      window.removeEventListener('wechurch:grace-records-updated', loadPersonalPrayers);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/') loadPersonalPrayers();
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(HOME_SECTION_STATE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (user?.user_metadata?.display_name) return user.user_metadata.display_name;
    if (user?.email) return user.email.split('@')[0];
    return '使用者';
  };

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const prayerFocus = useMemo(() => {
    const currentUserId = (user as any)?.legacyUserId || user?.id;
    const activePrayers = [...homePrayers]
      .filter((prayer) => !prayer.isAnswered)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    const personalPrayer = activePrayers.find((prayer) => prayer.userId === currentUserId);
    const intercessionPrayers = activePrayers;
    const visibleIntercessionPrayers = intercessionPrayers.slice(0, 3);

    return {
      personalPrayer,
      intercessionPrayers: visibleIntercessionPrayers,
      activeCount: activePrayers.length,
      intercessionCount: intercessionPrayers.length || activePrayers.length,
      answeredCount: homePrayers.filter((prayer) => prayer.isAnswered).length,
    };
  }, [homePrayers, user]);
  const activeCareContacts = useMemo(() => {
    return careContacts.filter((contact) => !contact.lastCaredAt).slice(0, 3);
  }, [careContacts]);
  const activePrivatePrayerRecords = useMemo(() => {
    return [...personalPrayerRecords]
      .filter((record) => {
        const hasContent = !!(record.prayer?.trim() || record.title?.trim());
        const stillWaiting = record.status !== 'answered' && record.status !== 'grace_response' && !record.response?.trim();
        return hasContent && stillWaiting;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [personalPrayerRecords]);
  const visiblePrivatePrayerRecords = activePrivatePrayerRecords.slice(0, 3);
  const churchReading = syncedChurchReading || fallbackChurchReading;
  const todayScripture = {
    label: '教會每日讀經',
    title: churchReading.scriptureReference,
    subtitle: `${churchReading.planName} · 第 ${churchReading.dayNumber} 天`,
    href: '/learn/church-reading',
    verses: churchReading.previewVerses.map((verse) => ({
      marker: String(verse.verse),
      text: verse.text,
    })),
    devotionalTitle: churchReading.devotionalTitle,
    devotionalText: churchReading.devotionalText,
  };
  const todayDevotionalNote = useMemo(() => {
    if (savedHomeDevotionalNote?.verseReference === todayScripture.title) {
      return savedHomeDevotionalNote;
    }
    if (!devotionalNotes.length) return undefined;

    const byReference = devotionalNotes.find((note) => note.verseReference === todayScripture.title);

    return byReference || [...devotionalNotes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }, [devotionalNotes, savedHomeDevotionalNote, todayScripture.title]);
  const todayDevotionalText = todayDevotionalNote
    ? getCoreInsightText(todayDevotionalNote.coreInsightNote)
      || todayDevotionalNote.observation
      || todayDevotionalNote.actionPlan
      || todayDevotionalNote.coolDownNote
      || todayDevotionalNote.heartbeatVerse
      || ''
    : '';
  const todayDevotionalSteps = todayDevotionalNote
    ? [
        { label: '1. 看見', value: todayDevotionalNote.observation },
        {
          label: '2. 領受',
          value: getCoreInsightText(todayDevotionalNote.coreInsightNote) || todayDevotionalNote.heartbeatVerse,
        },
        { label: '3. 回應', value: todayDevotionalNote.actionPlan },
      ].filter((step) => step.value?.trim())
    : [];
  const handleSaveDevotional = async () => {
    const observation = devotionalDraft.observation.trim();
    const receiving = devotionalDraft.receiving.trim();
    const actionPlan = devotionalDraft.actionPlan.trim();
    if ((!observation && !receiving && !actionPlan) || isSavingDevotional) return;
    if (!user) {
      navigate('/login');
      return;
    }

    setIsSavingDevotional(true);
    try {
      const notePayload = {
        observation: observation || null,
        heartbeatVerse: receiving || null,
        coreInsightCategory: receiving ? JSON.stringify([RECEIVE_KEY]) : null,
        coreInsightNote: receiving ? JSON.stringify({ [RECEIVE_KEY]: receiving }) : null,
        actionPlan: actionPlan || null,
      };
      const payload = {
        verseReference: todayScripture.title,
        verseText: todayScripture.verses.map((verse) => `${verse.marker ? `${verse.marker} ` : ''}${verse.text}`).join('\n'),
        readingPlanId: null,
        dayNumber: churchReading.dayNumber,
        ...notePayload,
      };

      let savedNote: DevotionalNoteSummary;
      try {
        const shouldPatchRemote = todayDevotionalNote && !todayDevotionalNote.id.startsWith('local-devotional-');
        const response = shouldPatchRemote
          ? await apiRequest('PATCH', `/api/devotional-notes/${todayDevotionalNote.id}`, notePayload)
          : await apiRequest('POST', '/api/devotional-notes', payload);
        savedNote = (await response.json()) as DevotionalNoteSummary;
      } catch {
        const now = new Date().toISOString();
        savedNote = {
          id: todayDevotionalNote?.id || createLocalDevotionalNoteId(),
          userId: (user as any)?.legacyUserId || user?.id,
          titlePhrase: null,
          coolDownNote: null,
          scholarsNote: null,
          createdAt: todayDevotionalNote?.createdAt || now,
          updatedAt: now,
          ...payload,
        } as DevotionalNoteSummary;
      }
      const visibleSavedNote: DevotionalNoteSummary = {
        ...savedNote,
        verseReference: savedNote.verseReference || todayScripture.title,
        verseText: savedNote.verseText || payload.verseText,
        observation: savedNote.observation ?? notePayload.observation,
        heartbeatVerse: savedNote.heartbeatVerse ?? notePayload.heartbeatVerse,
        coreInsightNote: savedNote.coreInsightNote ?? notePayload.coreInsightNote,
        actionPlan: savedNote.actionPlan ?? notePayload.actionPlan,
        updatedAt: savedNote.updatedAt || new Date().toISOString(),
      };

      upsertLocalDevotionalNote(visibleSavedNote);
      setSavedHomeDevotionalNote(visibleSavedNote);
      queryClient.setQueryData<DevotionalNoteSummary[]>(['/api/devotional-notes'], (current = []) => [
        visibleSavedNote,
        ...current.filter((note) => note.id !== visibleSavedNote.id),
      ]);
      setDevotionalDraft(EMPTY_DEVOTIONAL_DRAFT);
      await queryClient.invalidateQueries({ queryKey: ['/api/devotional-notes'] });
    } finally {
      setIsSavingDevotional(false);
    }
  };
  const mindMapModules = [
    {
      id: 'bible-module',
      title: '聖經',
      subtitle: '閱覽聖經、每日讀經、靈修筆記、耶穌四季',
      href: '/learn',
      icon: BookOpen,
      tone: 'border-border/70 bg-white/95 hover:border-primary/25',
      iconTone: 'bg-primary/10 text-primary',
      featureKeys: ['we_learn'],
    },
    {
      id: 'prayer-module',
      title: '禱告',
      subtitle: '個人需求禱告、恩典紀錄、教會禱告網、緊急禱告',
      href: '/share',
      icon: Share2,
      tone: 'border-border/70 bg-white/95 hover:border-secondary/25',
      iconTone: 'bg-secondary/10 text-secondary',
      featureKeys: ['we_share'],
    },
    {
      id: 'study-module',
      title: '查經',
      subtitle: 'SoulGym 查經、查經筆記、個人與小組成果整理',
      href: '/user',
      icon: Dumbbell,
      tone: 'border-border/70 bg-white/95 hover:border-accent/25',
      iconTone: 'bg-accent/10 text-accent',
      featureKeys: ['we_live'],
    },
    {
      id: 'care-module',
      title: '關懷',
      subtitle: '個人關懷清單、小組關懷清單、具體要關心的人',
      href: '/care',
      icon: HandHeart,
      tone: 'border-border/70 bg-white/95 hover:border-emerald-200',
      iconTone: 'bg-emerald-500/10 text-emerald-600',
      featureKeys: ['care'],
    },
    {
      id: 'tools-module',
      title: '工具',
      subtitle: '牌卡、隨機分組、十二門徒人格測驗、聖經問答',
      href: '/play',
      icon: Gamepad2,
      tone: 'border-border/70 bg-white/95 hover:border-amber-200',
      iconTone: 'bg-amber-500/10 text-amber-700',
      featureKeys: ['we_play'],
    },
    ...(canCreateSession ? [{
      id: 'host-module',
      title: '主持與管理',
      subtitle: '主持 SoulGym、管理禱告會、查看歷史資料與成員',
      href: '/admin',
      icon: Settings,
      tone: 'border-border/70 bg-white/95 hover:border-slate-300',
      iconTone: 'bg-slate-500/10 text-slate-700',
      featureKeys: ['we_live'],
    }] : []),
  ];
  const todayLabel = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
  const dailyOfficeSteps = [
    {
      number: '01',
      label: '讀經',
      detail: todayScripture.title,
      status: '今日',
      tone: 'text-primary',
      chip: 'bg-primary/10 text-primary',
    },
    {
      number: '02',
      label: '代求',
      detail: prayerFocus.intercessionCount > 0 ? `${prayerFocus.intercessionCount} 件守望` : '為一個人禱告',
      status: '接著',
      tone: 'text-secondary',
      chip: 'bg-secondary/10 text-secondary',
    },
    {
      number: '03',
      label: '關懷',
      detail: activeCareContacts.length > 0 ? `${activeCareContacts.length} 位待關心` : '主動關心一位',
      status: '下一步',
      tone: 'text-emerald-700',
      chip: 'bg-emerald-50 text-emerald-700',
    },
  ];
  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 px-4 py-3 shadow-[0_10px_30px_-28px_rgba(30,58,95,0.45)] backdrop-blur-xl transition-all sm:px-6 sm:py-4 md:py-3">
        <div className="container mx-auto flex items-center justify-between">
          {/* Mobile: Left spacer */}
          <div className="w-10 md:hidden" />

          {/* Desktop: Logo on left */}
          <Link to="/" className="hidden md:flex items-center gap-2 group shrink-0">
            <div className="relative">
              <WeChurchLogo size={32} className="relative group-hover:scale-105 transition-transform" />
            </div>
            <h1 className="text-lg font-bold text-foreground">WeChurch</h1>
          </Link>

          {/* Mobile: Center logo */}
          <div className="flex md:hidden items-center gap-2 group">
            <div className="relative">
              <WeChurchLogo size={36} className="relative group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">WeChurch</h1>
            </div>
          </div>

          {/* Desktop: Navigation links */}
          <nav className="hidden md:flex items-center gap-1" data-testid="nav-top-index">
            {appNavItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(location.pathname, item);
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  data-testid={`nav-top-link-${item.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="w-10 flex justify-end">
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 p-0">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{getDisplayName()}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/me" className="flex items-center gap-2 cursor-pointer">
                      <User className="w-4 h-4" />
                      個人管理
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="w-4 h-4" />
                      管理後台
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowProfileSettings(true)} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    個人設定
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={() => navigate('/me')}
              >
                <User className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-readable container mx-auto px-4 py-4 sm:px-6 md:py-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <section className="animate-fade-in space-y-4" aria-labelledby="today-dashboard-title">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-white/95 shadow-[0_16px_48px_-34px_rgba(30,58,95,0.42)]">
              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.62fr)] lg:items-stretch">
                <div className="flex min-w-0 flex-col">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 items-center rounded-md bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                      今日日課
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{todayLabel}</span>
                  </div>
                  <h2 id="today-dashboard-title" className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
                    愛神 · 愛人
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    今天照著一個安靜的次序走：讀經、代求、關懷。
                  </p>
                  <div className="scripture-paper mt-4 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-primary">{todayScripture.title}</p>
                      <p className="text-xs text-muted-foreground">第 {churchReading.dayNumber} 天</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {todayScripture.verses.slice(0, 2).map((verse, index) => (
                        <p key={`${verse.marker}-hero-${index}`} className="scripture-serif text-[16px] leading-8 text-foreground">
                          {verse.marker && <span className="mr-1.5 font-semibold text-primary/70">{verse.marker}</span>}
                          {verse.text}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid content-start gap-2">
                  {dailyOfficeSteps.map((item) => (
                    <div key={item.number} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-lg border border-border/60 bg-background/75 p-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-md text-sm font-bold ${item.chip}`}>
                        {item.number}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm font-bold ${item.tone}`}>{item.label}</p>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-foreground">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
              <Card className="overflow-hidden rounded-lg border-border/70 bg-white/95 shadow-[0_16px_50px_-34px_rgba(30,58,95,0.5)]">
                <CardContent className="p-0">
                  <div className="border-b border-border/60 bg-primary/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Heart className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-primary">愛神</p>
                        <h3 className="text-lg font-bold text-foreground">今天與神同行</h3>
                      </div>
                    </div>
                  </div>

                  <div>
                    <HomeSection
                      id="scripture"
                      title={todayScripture.label}
                      summary={`${todayScripture.title} · 第 ${churchReading.dayNumber} 天`}
                      icon={<BookOpen className="h-4 w-4 text-primary" />}
                      action={<Link to={todayScripture.href} className="shrink-0 text-xs font-medium text-primary">打開</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-base font-bold leading-tight text-foreground">{todayScripture.title}</h4>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">{todayScripture.subtitle}</p>
                        </div>
                        <div className="scripture-paper space-y-2 rounded-lg border p-3">
                          {todayScripture.verses.slice(0, 3).map((verse, index) => (
                            <p key={`${verse.marker}-${index}`} className="scripture-serif text-[15px] leading-7 text-foreground">
                              {verse.marker && <span className="mr-1.5 font-semibold text-primary/70">{verse.marker}</span>}
                              {verse.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    </HomeSection>

                    <HomeSection
                      id="devotional"
                      title="靈修短文"
                      summary={todayScripture.devotionalTitle}
                      icon={<BookOpen className="h-4 w-4 text-primary" />}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/[0.04] p-3">
                        <div>
                          <h5 className="text-sm font-bold text-foreground">{todayScripture.devotionalTitle}</h5>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{todayScripture.devotionalText}</p>
                        </div>
                        {(churchReading.prayer || churchReading.loveAction) && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {churchReading.prayer && (
                              <div className="rounded-lg bg-white/70 p-3">
                                <p className="text-xs font-semibold text-primary">今日愛神</p>
                                <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{churchReading.prayer}</p>
                              </div>
                            )}
                            {churchReading.loveAction && (
                              <div className="rounded-lg bg-white/70 p-3">
                                <p className="text-xs font-semibold text-emerald-700">今日愛人</p>
                                <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{churchReading.loveAction}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </HomeSection>

                    <HomeSection
                      id="devotionalNote"
                      title="靈修筆記"
                      summary={todayDevotionalSteps.length > 0 ? `${todayDevotionalSteps.length}/3 已記錄` : '三步驟：看見、領受、回應'}
                      icon={<BookMarked className="h-4 w-4 text-primary" />}
                      action={<Link to="/learn/my-notes" className="shrink-0 text-xs font-medium text-primary">回看</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      {devotionalNotesLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-4/5 bg-primary/10" />
                          <Skeleton className="h-4 w-2/3 bg-primary/10" />
                        </div>
                      ) : todayDevotionalSteps.length > 0 || todayDevotionalText ? (
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-foreground">
                            {todayDevotionalNote?.titlePhrase || '今天的三步驟筆記'}
                          </h5>
                          {todayDevotionalSteps.length > 0 ? (
                            <div className="space-y-1.5">
                              {todayDevotionalSteps.map((step) => (
                                <div key={step.label} className="rounded-lg bg-primary/5 px-3 py-2">
                                  <p className="text-xs font-semibold text-primary">{step.label}</p>
                                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{step.value}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{todayDevotionalText}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                            <p className="text-xs font-semibold text-emerald-700">1. 看見</p>
                            <p className="mt-1 text-xs text-muted-foreground">這段經文中，我觀察到什麼？</p>
                            <AutoResizeTextarea
                              minRows={1}
                              maxRows={3}
                              value={devotionalDraft.observation}
                              onChange={(event) => updateHomeDevotionalDraft(setDevotionalDraft, 'observation', event.target.value)}
                              placeholder="人物、場景、重複的詞、讓我注意到的細節..."
                              className="mt-2 rounded-lg bg-background text-sm"
                            />
                          </div>
                          <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3">
                            <p className="text-xs font-semibold text-sky-700">2. 領受</p>
                            <p className="mt-1 text-xs text-muted-foreground">神透過這段經文對我說什麼？</p>
                            <AutoResizeTextarea
                              minRows={1}
                              maxRows={3}
                              value={devotionalDraft.receiving}
                              onChange={(event) => updateHomeDevotionalDraft(setDevotionalDraft, 'receiving', event.target.value)}
                              placeholder="哪句話觸動我？我被提醒、安慰或光照的是什麼？"
                              className="mt-2 rounded-lg bg-background text-sm"
                            />
                          </div>
                          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                            <p className="text-xs font-semibold text-amber-700">3. 回應</p>
                            <p className="mt-1 text-xs text-muted-foreground">我接下來要怎麼實踐？</p>
                            <AutoResizeTextarea
                              minRows={1}
                              maxRows={3}
                              value={devotionalDraft.actionPlan}
                              onChange={(event) => updateHomeDevotionalDraft(setDevotionalDraft, 'actionPlan', event.target.value)}
                              placeholder="今天或這週的一個具體行動..."
                              className="mt-2 rounded-lg bg-background text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-9 rounded-lg"
                            onClick={handleSaveDevotional}
                            disabled={
                              (!devotionalDraft.observation.trim() &&
                                !devotionalDraft.receiving.trim() &&
                                !devotionalDraft.actionPlan.trim()) ||
                              isSavingDevotional
                            }
                          >
                            {isSavingDevotional && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isSavingDevotional ? '儲存中' : '儲存三步驟筆記'}
                          </Button>
                        </div>
                      )}
                    </HomeSection>

                    <HomeSection
                      id="personalPrayer"
                      title="個人禱告"
                      summary={activePrivatePrayerRecords.length > 0 ? `${activePrivatePrayerRecords.length} 筆正在等候` : '前往清單新增'}
                      icon={<PenLine className="h-4 w-4 text-secondary" />}
                      action={<Link to="/grace-record" className="shrink-0 text-xs font-medium text-secondary">記錄</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      {visiblePrivatePrayerRecords.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm leading-6 text-muted-foreground">
                            今天為自己的需要認真禱告，把正在等候的事帶到神面前。
                          </p>
                          <div className="divide-y rounded-lg border bg-background/80">
                            {visiblePrivatePrayerRecords.map((record) => (
                              <div key={record.id} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] sm:items-center">
                                <h4 className="text-sm font-bold leading-6 text-foreground">{record.title || '今天要交託的事'}</h4>
                                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground sm:line-clamp-1">
                                  {record.prayer?.trim() || '已加入禱告清單，等待補充禱告內容。'}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              {activePrivatePrayerRecords.length > visiblePrivatePrayerRecords.length
                                ? `還有 ${activePrivatePrayerRecords.length - visiblePrivatePrayerRecords.length} 筆在清單中`
                                : `${activePrivatePrayerRecords.length} 筆正在等候`}
                            </p>
                            <Link to="/grace-record" className="inline-flex text-xs font-medium text-secondary">查看禱告清單</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-dashed bg-background/70 p-3">
                            <h4 className="text-sm font-bold leading-6 text-foreground">目前沒有正在等候的個人禱告</h4>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              個人禱告先到清單新增；首頁只保留今天要認真守望的提醒。
                            </p>
                          </div>
                          <Link to="/grace-record" className="inline-flex text-sm font-medium text-secondary">
                            前往個人禱告清單
                          </Link>
                        </div>
                      )}
                    </HomeSection>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-lg border-border/70 bg-white/95 shadow-[0_16px_50px_-34px_rgba(30,58,95,0.5)]">
                <CardContent className="p-0">
                  <div className="border-b border-border/60 bg-secondary/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-secondary/15 bg-secondary/10 text-secondary">
                        <HandHeart className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-secondary">愛人</p>
                        <h3 className="text-lg font-bold text-foreground">今天去關心人</h3>
                      </div>
                    </div>
                  </div>

                  <div>
                    <HomeSection
                      id="intercession"
                      title="每日代求"
                      summary={prayerFocus.intercessionCount > 0 ? `${prayerFocus.intercessionCount} 件正在守望` : '從禱告牆選一件需要'}
                      icon={<MessageCircleHeart className="h-4 w-4 text-secondary" />}
                      action={<Link to="/prayer-wall" className="shrink-0 text-xs font-medium text-secondary">禱告牆</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      {prayerFocus.intercessionPrayers.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm leading-6 text-muted-foreground">
                            從禱告牆列出正在守望的事項，今天可以逐一為這些需要代禱。
                          </p>
                          <div className="divide-y rounded-lg border bg-background/80">
                            {prayerFocus.intercessionPrayers.map((prayer) => (
                              <div key={prayer.id} className="space-y-2 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-bold leading-6 text-foreground">
                                    為 {prayer.authorName || '匿名'} 代禱
                                  </h4>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {prayer.amenCount > 0 ? `${prayer.amenCount} 個阿門` : '等待守望'}
                                  </span>
                                  {prayer.isPinned && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                      置頂
                                    </span>
                                  )}
                                </div>
                                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                  {prayer.content}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              {prayerFocus.intercessionCount > prayerFocus.intercessionPrayers.length
                                ? `還有 ${prayerFocus.intercessionCount - prayerFocus.intercessionPrayers.length} 件在禱告牆`
                                : `${prayerFocus.intercessionPrayers.length} 件正在守望`}
                            </p>
                            <Link to="/prayer-wall" className="inline-flex text-xs font-medium text-secondary">查看禱告牆</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="text-base font-bold text-foreground">今天為一個人代禱</h4>
                          <p className="text-sm leading-6 text-muted-foreground">
                            禱告牆目前沒有正在守望的事項，可以先寫下一個代禱，邀請大家一起守望。
                          </p>
                          <Link to="/prayer-wall" className="inline-flex text-sm font-medium text-secondary">前往禱告牆</Link>
                        </div>
                      )}
                    </HomeSection>

                    <HomeSection
                      id="communityPrayer"
                      title="國家與社區代求"
                      summary="為所在之地求平安"
                      icon={<Landmark className="h-4 w-4 text-primary" />}
                      action={<Link to="/prayer-meeting" className="shrink-0 text-xs font-medium text-primary">加入</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      <h4 className="text-base font-bold text-foreground">為所在之地求平安</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        為城市、家庭、學校、職場與教會禱告，讓信仰進入公共生活。
                      </p>
                    </HomeSection>

                    <HomeSection
                      id="care"
                      title="具體關心的人"
                      summary={activeCareContacts.length > 0 ? `${activeCareContacts.length} 位正在關懷` : '今天主動關心一個人'}
                      icon={<Users className="h-4 w-4 text-secondary" />}
                      action={<Link to="/care" className="shrink-0 text-xs font-medium text-secondary">管理</Link>}
                      openSections={openSections}
                      setOpenSections={setOpenSections}
                    >
                      {activeCareContacts.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm leading-6 text-muted-foreground">
                            今天具體記得一個人，也把下一步關心做出來。
                          </p>
                          <div className="divide-y rounded-lg border bg-background/80">
                            {activeCareContacts.map((contact) => (
                              <div key={contact.id} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] sm:items-center">
                                <h4 className="text-sm font-bold leading-6 text-foreground">{contact.name}</h4>
                                <div className="space-y-1 text-sm leading-6 text-muted-foreground">
                                  <p className="line-clamp-1">{contact.need}</p>
                                  <p className="line-clamp-1 rounded-lg bg-secondary/5 px-3 py-1.5 text-foreground">{contact.nextAction}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">{activeCareContacts.length} 位正在關懷</p>
                            <Link to="/care" className="inline-flex text-xs font-medium text-secondary">查看關懷清單</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="text-base font-bold text-foreground">今天主動關心一個人</h4>
                          <p className="text-sm leading-6 text-muted-foreground">
                            先從一個名字開始，記得他的需要，為他禱告。
                          </p>
                          <p className="rounded-lg bg-secondary/5 p-3 text-sm leading-6 text-foreground">
                            今天傳一則訊息、約一杯咖啡，或問候近況。
                          </p>
                        </div>
                      )}
                    </HomeSection>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="animate-fade-in" style={{ animationDelay: '80ms' }} aria-labelledby="home-actions-title">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 id="home-actions-title" className="text-sm font-semibold text-muted-foreground">
                主要入口
              </h2>
              <p className="text-xs text-muted-foreground">完整流程從這裡進入</p>
            </div>

            {featuresLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-lg bg-primary/10" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mindMapModules.filter(action => action.featureKeys.every(isFeatureEnabled)).map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.id}
                      to={action.href}
                      className={`group flex min-h-24 gap-3 rounded-lg border p-4 shadow-[0_10px_30px_-26px_rgba(30,58,95,0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-28px_rgba(30,58,95,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${action.tone}`}
                      data-testid={`link-module-action-${action.id}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${action.iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-foreground">{action.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.subtitle}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="w-full py-4 px-4 mt-auto border-t border-border/50">
        <div className="container mx-auto max-w-2xl md:max-w-3xl lg:max-w-4xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Home className="w-3 h-3 text-primary" />
              <span>© {new Date().getFullYear()} WeChurch</span>
              <Heart className="w-3 h-3 text-secondary ml-1" />
              <span>一起與主同行</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                v3.0.1版
              </span>
            </div>
          </div>
        </div>
      </footer>

      <ProfileSettingsDialog
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
      />
    </div>
  );
};

export default Index;
