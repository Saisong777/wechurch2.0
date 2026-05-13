import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dumbbell,
  BookOpen,
  Gamepad2,
  Share2,
  Heart,
  Sparkles,
  ChevronRight,
  Home,
  LogOut,
  BookMarked,
  Settings,
  User,
  CheckCircle2,
  ClipboardCheck,
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
import { ClickableVerse } from '@/components/scripture/ClickableVerse';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { appNavItems, isNavItemActive } from '@/lib/navigation';
import { useUserRole } from '@/hooks/useUserRole';

interface BlessingVerse {
  verseId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  blessingType: string | null;
}

interface TodayReadingSummary {
  planId: string;
  planName: string;
  dayNumber: number;
  totalDays: number;
  completedDays: number;
  isCompleted: boolean;
  scriptureReference: string;
  previewVerses: Array<{ verse: number; text: string }>;
  todayCompleted: boolean;
}

interface DevotionalNoteSummary {
  id: string;
  readingPlanId: string | null;
  actionPlan: string | null;
  updatedAt: string;
}

interface NotebookEntrySummary {
  id: string;
  action_plan: string | null;
  session_date: string;
}

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { canCreateSession } = useUserRole();
  const { isFeatureEnabled, loading: featuresLoading } = useFeatureToggles();
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const { data: randomVerse, isLoading: isVerseLoading } = useQuery<BlessingVerse>({
    queryKey: ['/api/bible/blessing/random'],
    refetchOnWindowFocus: false,
  });

  const { data: todaySummary, isLoading: isSummaryLoading } = useQuery<TodayReadingSummary | null>({
    queryKey: ['/api/user-reading-plans/today-summary'],
    enabled: !!user,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

  const { data: devotionalNotes = [] } = useQuery<DevotionalNoteSummary[]>({
    queryKey: ['/api/devotional-notes'],
    enabled: !!user,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60000,
  });

  const { data: notebookEntries = [] } = useQuery<NotebookEntrySummary[]>({
    queryKey: ['/api/notebook', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/notebook?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch notebook');
      const data = await res.json();
      return (data?.entries || []) as NotebookEntrySummary[];
    },
    enabled: !!user && !!userEmail,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60000,
  });

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      navigate(`/user/study?session=${sessionId}`);
    }
  }, [searchParams, navigate]);

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
  const currentHour = useMemo(() => new Date().getHours(), []);
  const greeting = currentHour < 12 ? '早安' : currentHour < 18 ? '午安' : '晚安';
  const displayName = getDisplayName();
  const greetingName = user ? displayName : '朋友';
  const spiritualSnapshot = useMemo(() => {
    const readingNoteCount = devotionalNotes.filter((note) => note.readingPlanId !== null).length;
    const freeNoteCount = devotionalNotes.filter((note) => note.readingPlanId === null).length;
    const studyNoteCount = notebookEntries.length;
    const actionTexts = [
      ...devotionalNotes.map((note) => note.actionPlan),
      ...notebookEntries.map((entry) => entry.action_plan),
    ].filter(Boolean) as string[];
    const latestDates = [
      ...devotionalNotes.map((note) => note.updatedAt),
      ...notebookEntries.map((entry) => entry.session_date),
    ]
      .filter(Boolean)
      .map((date) => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime());

    return {
      readingNoteCount,
      freeNoteCount,
      studyNoteCount,
      actionCount: actionTexts.length,
      latestAction: actionTexts[0] || '今天可以從一段經文、一個代禱，或一場 SoulGym 開始。',
      latestActivity: latestDates[0],
    };
  }, [devotionalNotes, notebookEntries]);
  const primaryActions = [
    {
      id: 'study',
      featureKey: 'we_live',
      title: '加入 SoulGym 查經',
      subtitle: '掃 QR 或輸入代碼，直接進入今晚流程',
      href: '/user/study',
      icon: Dumbbell,
      className: 'border-secondary/20 bg-secondary/10',
      iconClass: 'bg-secondary text-secondary-foreground',
    },
    {
      id: 'today-reading',
      featureKey: 'we_learn',
      title: todaySummary && !todaySummary.isCompleted ? '繼續今日讀經' : '打開聖經',
      subtitle: todaySummary && !todaySummary.isCompleted ? todaySummary.scriptureReference || todaySummary.planName : '閱讀、搜尋、收藏、寫下亮光',
      href: todaySummary && !todaySummary.isCompleted ? `/learn/reading-plans/${todaySummary.planId}/read` : '/learn',
      icon: BookOpen,
      className: 'border-primary/20 bg-primary/10',
      iconClass: 'bg-primary text-primary-foreground',
    },
  ];

  const secondaryActions = [
    {
      id: 'share',
      featureKey: 'we_share',
      title: '代禱',
      href: '/share',
      icon: Share2,
    },
    {
      id: 'play',
      featureKey: 'we_play',
      title: '小工具',
      href: '/play',
      icon: Gamepad2,
    },
    ...(user ? [{
      id: 'notes',
      featureKey: 'we_learn',
      title: '我的筆記',
      href: '/learn/my-notes',
      icon: BookMarked,
    }] : []),
    ...(canCreateSession ? [{
      id: 'admin',
      featureKey: 'we_live',
      title: '主持台',
      href: '/admin',
      icon: Settings,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="w-full py-3 sm:py-4 md:py-3 px-4 sm:px-6 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] transition-all">
        <div className="container mx-auto flex items-center justify-between">
          {/* Mobile: Left spacer */}
          <div className="w-10 md:hidden" />

          {/* Desktop: Logo on left */}
          <Link to="/" className="hidden md:flex items-center gap-2 group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/15 rounded-full blur-xl animate-pulse-soft" />
              <WeChurchLogo size={32} className="relative group-hover:scale-105 transition-transform" />
            </div>
            <h1 className="text-lg font-bold text-foreground">WeChurch</h1>
          </Link>

          {/* Mobile: Center logo */}
          <div className="flex md:hidden items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/15 rounded-full blur-xl animate-pulse-soft" />
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                    <Link to="/notebook" className="flex items-center gap-2 cursor-pointer">
                      <BookMarked className="w-4 h-4" />
                      我的筆記本
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
                onClick={() => navigate('/notebook')}
              >
                <User className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-6">

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-secondary/10 p-6 sm:p-8 animate-fade-in border border-primary/10 shadow-sm">
            <div className="hidden sm:block absolute top-5 right-5 opacity-10 pointer-events-none">
              <WeChurchLogo size={132} />
            </div>

            <div className="relative z-10 mb-6 sm:mb-8">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/10 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                WeChurch 我們就是教會
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                {greeting}，
                <span className="text-primary">{greetingName}</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                一起，活出耶穌的豐盛生命。今天從讀經、禱告，或一段真誠的小組分享開始。
              </p>
            </div>
            {(isVerseLoading || isSummaryLoading) ? (
              <Card className="border-white/40 bg-white/60 backdrop-blur-md shadow-card">
                <CardContent className="py-5 px-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-2xl flex-shrink-0 bg-primary/20" />
                    <div className="flex-1 space-y-3 mt-1">
                      <Skeleton className="h-4 w-24 bg-primary/20" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full bg-primary/10" />
                        <Skeleton className="h-4 w-4/5 bg-primary/10" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : todaySummary && !todaySummary.isCompleted ? (
              <Card className="border-white/40 bg-white/60 backdrop-blur-md shadow-card hover:shadow-card-hover transition-all duration-300" data-testid="card-today-reading">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {todaySummary.todayCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <BookOpen className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                          {todaySummary.todayCompleted ? '今日已完成' : '今日讀經'}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          第 {todaySummary.dayNumber} 天 / 共 {todaySummary.totalDays} 天
                        </span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-foreground mb-1 truncate" data-testid="text-plan-name">
                        {todaySummary.planName}
                      </p>
                      {todaySummary.scriptureReference && (
                        <p className="text-sm text-muted-foreground mb-3" data-testid="text-scripture-ref">
                          {todaySummary.scriptureReference}
                        </p>
                      )}

                      <div className="bg-white/50 rounded-xl p-3 mb-3 border border-white/40">
                        {todaySummary.previewVerses.length > 0 && (
                          <div className="space-y-1.5" data-testid="text-preview-verses">
                            {todaySummary.previewVerses.map((v, i) => (
                              <p key={i} className="text-sm text-foreground/80 leading-relaxed">
                                <span className="text-primary/60 font-medium mr-1.5">{v.verse}</span>
                                {v.text}
                              </p>
                            ))}
                            <p className="text-xs text-muted-foreground/60 italic pt-1">接續閱讀......</p>
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-xs font-medium text-muted-foreground">進度 {Math.round((todaySummary.completedDays / todaySummary.totalDays) * 100)}%</span>
                          <span className="text-xs text-muted-foreground">{todaySummary.completedDays} / {todaySummary.totalDays} 天</span>
                        </div>
                        <Progress value={todaySummary.totalDays > 0 ? (todaySummary.completedDays / todaySummary.totalDays) * 100 : 0} className="h-2 bg-primary/10" />
                      </div>

                      <Link
                        to={`/learn/reading-plans/${todaySummary.planId}/read`}
                        data-testid="link-continue-reading"
                        className="inline-block w-full sm:w-auto"
                      >
                        <Button className="w-full sm:w-auto gap-2 shadow-md hover:shadow-lg transition-all rounded-xl" size="lg">
                          {todaySummary.todayCompleted ? '查看今日經文' : '開始今日閱讀'}
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : randomVerse ? (
              <Card className="border-white/40 bg-white/60 backdrop-blur-md shadow-card hover:shadow-card-hover transition-all duration-300">
                <CardContent className="py-5 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/15 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">今日隨機經文</p>
                      <div className="bg-white/50 rounded-xl p-4 border border-white/40 group">
                        <ClickableVerse
                          text={randomVerse.text}
                          reference={`${randomVerse.bookName} ${randomVerse.chapter}:${randomVerse.verse}`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>

          {user && (
            <section className="animate-fade-in" style={{ animationDelay: '70ms' }} aria-labelledby="snapshot-title">
              <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-white/60 bg-white/80 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-primary">我的今天</p>
                        <h2 id="snapshot-title" className="mt-1 text-lg font-bold text-foreground">
                          回來就接得上
                        </h2>
                      </div>
                      <Link
                        to="/learn/my-notes"
                        className="mt-1 text-xs font-semibold text-primary hover:underline"
                      >
                        看筆記
                      </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border bg-background/80 p-3">
                        <BookOpen className="mb-2 h-4 w-4 text-primary" />
                        <p className="text-xl font-bold text-foreground">{spiritualSnapshot.readingNoteCount}</p>
                        <p className="text-[11px] text-muted-foreground">讀經筆記</p>
                      </div>
                      <div className="rounded-xl border bg-background/80 p-3">
                        <Dumbbell className="mb-2 h-4 w-4 text-secondary" />
                        <p className="text-xl font-bold text-foreground">{spiritualSnapshot.studyNoteCount}</p>
                        <p className="text-[11px] text-muted-foreground">查經紀錄</p>
                      </div>
                      <div className="rounded-xl border bg-background/80 p-3">
                        <ClipboardCheck className="mb-2 h-4 w-4 text-emerald-600" />
                        <p className="text-xl font-bold text-foreground">{spiritualSnapshot.actionCount}</p>
                        <p className="text-[11px] text-muted-foreground">行動操練</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/60 bg-white/80 shadow-sm">
                  <CardContent className="flex h-full flex-col justify-between p-4 sm:p-5">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-secondary" />
                        <h2 className="text-sm font-semibold text-foreground">下一步提醒</h2>
                      </div>
                      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {spiritualSnapshot.latestAction}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      <span>最近更新</span>
                      <span className="font-semibold text-foreground">
                        {spiritualSnapshot.latestActivity
                          ? spiritualSnapshot.latestActivity.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                          : '尚未開始'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          <section className="animate-fade-in" style={{ animationDelay: '80ms' }} aria-labelledby="home-actions-title">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="home-actions-title" className="text-base font-semibold text-foreground">
                  今天要做什麼？
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  首頁只放最常用的入口。
                </p>
              </div>
            </div>

            {featuresLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Card key={index} className="border-white/50 bg-white/60 shadow-sm">
                    <CardContent className="flex min-h-[116px] items-center gap-4 p-4 sm:p-5">
                      <Skeleton className="h-12 w-12 rounded-2xl bg-primary/15" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-32 bg-primary/10" />
                        <Skeleton className="h-4 w-44 max-w-full bg-primary/10" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {primaryActions.filter(action => isFeatureEnabled(action.featureKey)).map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link key={action.id} to={action.href} className="group block" data-testid={`link-primary-action-${action.id}`}>
                        <Card className={`h-full border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${action.className}`}>
                          <CardContent className="flex min-h-[116px] items-center gap-4 p-4 sm:p-5">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${action.iconClass}`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-bold text-foreground">{action.title}</h3>
                              <p className="mt-1 text-sm leading-5 text-muted-foreground">{action.subtitle}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm">
                  <p className="px-1 text-xs font-semibold text-muted-foreground">
                    其他功能
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {secondaryActions.filter(action => isFeatureEnabled(action.featureKey)).map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          key={action.id}
                          to={action.href}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                          data-testid={`link-secondary-action-${action.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          {action.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
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
