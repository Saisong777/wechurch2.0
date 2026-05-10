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

const featureConfig = [
  {
    id: 'live',
    featureKey: 'we_live',
    title: '加入查經',
    subtitle: 'SoulGym',
    icon: Dumbbell,
    href: '/user',
    bgColor: 'bg-secondary/15',
    iconColor: 'text-secondary',
    hoverBorder: 'hover:border-secondary/40',
  },
  {
    id: 'learn',
    featureKey: 'we_learn',
    title: '打開聖經',
    subtitle: '閱讀與筆記',
    icon: BookOpen,
    href: '/learn',
    bgColor: 'bg-primary/15',
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary/40',
  },
  {
    id: 'play',
    featureKey: 'we_play',
    title: '帶互動',
    subtitle: '分組與遊戲',
    icon: Gamepad2,
    href: '/play',
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-400/40',
  },
  {
    id: 'share',
    featureKey: 'we_share',
    title: '寫代禱',
    subtitle: '一起禱告',
    icon: Share2,
    href: '/share',
    bgColor: 'bg-rose-500/15',
    iconColor: 'text-rose-500',
    hoverBorder: 'hover:border-rose-400/40',
  },
];

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { canCreateSession } = useUserRole();
  const { isFeatureEnabled, getDisabledMessage, loading: featuresLoading } = useFeatureToggles();
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
  const quickActions = [
    {
      id: 'study',
      featureKey: 'we_live',
      title: '加入查經',
      subtitle: '輸入代碼或掃 QR',
      href: '/user/study',
      icon: Dumbbell,
      iconClass: 'bg-secondary/15 text-secondary',
    },
    {
      id: 'today-reading',
      featureKey: 'we_learn',
      title: todaySummary && !todaySummary.isCompleted ? '開始今日讀經' : '打開聖經',
      subtitle: todaySummary && !todaySummary.isCompleted ? todaySummary.scriptureReference || todaySummary.planName : '搜尋、收藏、做筆記',
      href: todaySummary && !todaySummary.isCompleted ? `/learn/reading-plans/${todaySummary.planId}/read` : '/learn/bible',
      icon: BookOpen,
      iconClass: 'bg-primary/15 text-primary',
    },
    {
      id: 'prayer',
      featureKey: 'we_share',
      title: '寫代禱',
      subtitle: '留下今天的需要',
      href: '/prayer-wall',
      icon: Share2,
      iconClass: 'bg-rose-500/15 text-rose-500',
    },
    ...(canCreateSession ? [{
      id: 'host-study',
      featureKey: 'we_live',
      title: '開查經',
      subtitle: '建立課程與分組',
      href: '/admin',
      icon: Settings,
      iconClass: 'bg-amber-500/15 text-amber-600',
    }] : []),
  ];
  const productJourneys = [
    {
      id: 'participant',
      featureKey: 'we_live',
      title: '我正在現場',
      subtitle: '輸入代碼加入 SoulGym',
      href: '/user/study',
      icon: Dumbbell,
      iconClass: 'bg-secondary/15 text-secondary',
      enabled: true,
    },
    {
      id: 'host',
      featureKey: 'we_live',
      title: canCreateSession ? '我今晚要主持' : '我是參與者',
      subtitle: canCreateSession ? '打開一頁式主持台' : '加入查經或查看筆記',
      href: canCreateSession ? '/admin' : '/user',
      icon: Settings,
      iconClass: 'bg-amber-500/15 text-amber-600',
      enabled: true,
    },
    {
      id: 'devotion',
      featureKey: 'we_learn',
      title: '我想安靜讀經',
      subtitle: '聖經、讀經計畫、筆記',
      href: '/learn',
      icon: BookOpen,
      iconClass: 'bg-primary/15 text-primary',
      enabled: true,
    },
    {
      id: 'care',
      featureKey: 'we_share',
      title: '我想留下代禱',
      subtitle: '寫下需要，彼此扶持',
      href: '/share',
      icon: Share2,
      iconClass: 'bg-rose-500/15 text-rose-500',
      enabled: true,
    },
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

          {!featuresLoading && (
            <section className="animate-fade-in" style={{ animationDelay: '80ms' }} aria-labelledby="quick-actions-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="quick-actions-title" className="text-base font-semibold text-foreground">
                  現在開始
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  選一件事
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {quickActions.filter(action => isFeatureEnabled(action.featureKey)).map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.id} to={action.href} className="group block" data-testid={`link-quick-action-${action.id}`}>
                      <Card className="h-full border-white/60 bg-white/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                        <CardContent className="flex h-full items-center gap-3 p-4">
                          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${action.iconClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-foreground">{action.title}</h3>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.subtitle}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!featuresLoading && (
            <section className="animate-fade-in" style={{ animationDelay: '90ms' }} aria-labelledby="journey-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="journey-title" className="text-base font-semibold text-foreground">
                  依照此刻開始
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  不用找功能
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {productJourneys
                  .filter((journey) => journey.enabled && isFeatureEnabled(journey.featureKey))
                  .map((journey) => {
                    const Icon = journey.icon;
                    return (
                      <Link key={journey.id} to={journey.href} className="group block" data-testid={`link-journey-${journey.id}`}>
                        <Card className="h-full border-white/60 bg-white/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                          <CardContent className="flex h-full items-center gap-3 p-4">
                            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${journey.iconClass}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-semibold text-foreground">{journey.title}</h3>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{journey.subtitle}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {featuresLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="h-[142px] sm:h-[154px] border-white/50 bg-white/60 backdrop-blur-md shadow-sm">
                  <CardContent className="p-4 sm:p-5 flex flex-col h-full justify-between">
                    <Skeleton className="w-12 h-12 rounded-2xl bg-primary/15" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-20 bg-primary/10" />
                      <Skeleton className="h-4 w-16 bg-primary/10" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : featureConfig.map((feature) => {
              const Icon = feature.icon;
              const isEnabled = isFeatureEnabled(feature.featureKey);
              const disabledMessage = getDisabledMessage(feature.featureKey);

              const cardContent = (
                <Card className={`h-[142px] sm:h-[154px] transition-all duration-300 ${!isEnabled
                  ? 'opacity-60 border-muted border-dashed cursor-not-allowed bg-muted/10'
                  : `border-white/50 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-card hover:-translate-y-1 cursor-pointer`
                  }`}>
                  <CardContent className="p-4 sm:p-5 flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl ${feature.bgColor} flex items-center justify-center shadow-inner`}>
                        <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                      </div>
                      {!isEnabled ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground flex-shrink-0 font-medium tracking-wide">
                          {disabledMessage}
                        </span>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-foreground/70" />
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-snug font-medium">
                        {feature.subtitle}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );

              if (!isEnabled) {
                return (
                  <div key={feature.id} className="block">
                    {cardContent}
                  </div>
                );
              }

              return (
                <Link key={feature.id} to={feature.href} className="block group">
                  {cardContent}
                </Link>
              );
            })}
          </div>


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
