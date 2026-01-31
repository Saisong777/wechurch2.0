import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
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
  Church
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
import { useState } from 'react';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';

const featureConfig = [
  {
    id: 'live',
    featureKey: 'we_live',
    title: 'We Live',
    subtitle: '靈魂健身房',
    description: '一起活出耶穌的豐盛生命',
    icon: Dumbbell,
    href: '/user',
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
  },
  {
    id: 'learn',
    featureKey: 'we_learn',
    title: 'We Learn',
    subtitle: '學習成長',
    description: '聖經研讀與屬靈資源',
    icon: BookOpen,
    href: '/learn',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
  },
  {
    id: 'play',
    featureKey: 'we_play',
    title: 'We Play',
    subtitle: '破冰遊戲',
    description: '透過遊戲認識彼此',
    icon: Gamepad2,
    href: '/icebreaker',
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'share',
    featureKey: 'we_share',
    title: 'We Share',
    subtitle: '分享代禱',
    description: '禱告牆與經文圖卡',
    icon: Share2,
    href: '/share',
    bgColor: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
  },
];

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { isFeatureEnabled, getDisabledMessage, loading: featuresLoading } = useFeatureToggles();
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  
  // If session ID is in URL, redirect to user page with that session
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <header className="w-full py-4 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="w-10" />
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Church className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">WeChurch</h1>
            </div>
          </div>

          {/* User Menu */}
          <div className="w-10 flex justify-end">
            {authLoading ? (
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 p-0">
                    <Avatar className="w-9 h-9">
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
                className="rounded-full w-9 h-9"
                onClick={() => navigate('/notebook')}
              >
                <User className="w-5 h-5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              歡迎來到 WeChurch
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              一起經歷信仰生活
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              連結、學習、遊戲、分享 — 在這裡找到屬於你的信仰社群
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid sm:grid-cols-2 gap-4 md:gap-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {featureConfig.map((feature) => {
              const Icon = feature.icon;
              const isEnabled = isFeatureEnabled(feature.featureKey);
              const disabledMessage = getDisabledMessage(feature.featureKey);
              
              const cardContent = (
                <Card className={`h-full transition-all duration-300 border-2 hover:shadow-xl ${
                  !isEnabled 
                    ? 'opacity-60 border-muted border-dashed' 
                    : 'hover:border-primary/30 hover:scale-[1.02]'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                      </div>
                      {!isEnabled ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {disabledMessage}
                        </span>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                    <CardTitle className="text-xl">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-base font-medium text-foreground/70">
                      {feature.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
              
              if (!isEnabled) {
                return (
                  <div key={feature.id} className="block group cursor-not-allowed">
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

          {/* Footer Tagline */}
          <div className="text-center mt-12 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <Heart className="w-4 h-4 text-destructive" />
              <span className="text-sm">與弟兄姊妹一起成長</span>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 mt-auto border-t border-border/50">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Church className="w-4 h-4 text-primary" />
              <span>© {new Date().getFullYear()} WeChurch. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
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
