import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dumbbell, 
  BookOpen, 
  Gamepad2, 
  Share2, 
  Heart, 
  Sparkles,
  Users,
  ChevronRight,
  Home
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
import { LogOut, BookMarked, Settings, User } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';
import { useQuery } from '@tanstack/react-query';
import { ClickableVerse } from '@/components/scripture/ClickableVerse';

interface BlessingVerse {
  verseId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  blessingType: string | null;
}

const featureConfig = [
  {
    id: 'live',
    featureKey: 'we_live',
    title: 'We Live',
    subtitle: '靈魂健身房',
    icon: Dumbbell,
    href: '/user',
    bgColor: 'bg-secondary/15',
    iconColor: 'text-secondary',
    hoverBorder: 'hover:border-secondary/40',
  },
  {
    id: 'learn',
    featureKey: 'we_learn',
    title: 'We Learn',
    subtitle: '學習成長',
    icon: BookOpen,
    href: '/learn',
    bgColor: 'bg-primary/15',
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary/40',
  },
  {
    id: 'play',
    featureKey: 'we_play',
    title: 'We Play',
    subtitle: '破冰遊戲',
    icon: Gamepad2,
    href: '/icebreaker',
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-400/40',
  },
  {
    id: 'share',
    featureKey: 'we_share',
    title: 'We Share',
    subtitle: '分享代禱',
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { isFeatureEnabled, getDisabledMessage, loading: featuresLoading } = useFeatureToggles();
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const { data: randomVerse } = useQuery<BlessingVerse>({
    queryKey: ['/api/bible/blessing/random'],
    refetchOnWindowFocus: false,
  });
  
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      navigate(`/user?session=${sessionId}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="w-full py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="w-10" />
          
          <div className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/15 rounded-full blur-xl animate-pulse-soft" />
              <WeChurchLogo size={36} className="relative group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">WeChurch</h1>
            </div>
          </div>

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
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
              <Sparkles className="w-3 h-3" />
              歡迎來到 WeChurch
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              一起經歷信仰生活
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              連結、學習、遊戲、分享
            </p>
          </div>

          {randomVerse && (
            <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent animate-fade-in">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">今日經文（點擊可複製分享）</p>
                    <ClickableVerse
                      text={randomVerse.text}
                      reference={`${randomVerse.bookName} ${randomVerse.chapter}:${randomVerse.verse}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {featureConfig.map((feature) => {
              const Icon = feature.icon;
              const isEnabled = isFeatureEnabled(feature.featureKey);
              const disabledMessage = getDisabledMessage(feature.featureKey);
              
              const cardContent = (
                <Card className={`h-full transition-all duration-300 border ${
                  !isEnabled 
                    ? 'opacity-60 border-muted border-dashed cursor-not-allowed' 
                    : `${feature.hoverBorder} hover:shadow-md cursor-pointer`
                }`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg ${feature.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${feature.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {feature.subtitle}
                        </p>
                      </div>
                      {!isEnabled ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                          {disabledMessage}
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
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
                <Link key={feature.id} to={feature.href} className="block">
                  {cardContent}
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <Heart className="w-3 h-3 text-secondary" />
              <span className="text-xs">與弟兄姊妹一起成長</span>
              <Users className="w-3 h-3 text-primary" />
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 px-4 mt-auto border-t border-border/50">
        <div className="container mx-auto max-w-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Home className="w-3 h-3 text-primary" />
              <span>© {new Date().getFullYear()} WeChurch</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                v1.0.0
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
