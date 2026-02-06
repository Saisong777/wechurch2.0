import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, BookMarked, User, Settings, Home, Dumbbell, BookOpen, Gamepad2, Share2 } from 'lucide-react';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';
import { convertToProxiedUrl } from '@/lib/storage-helpers';

const navItems = [
  { id: 'home', label: '首頁', href: '/', icon: Home },
  { id: 'live', label: '健身房', href: '/user', icon: Dumbbell },
  { id: 'learn', label: '學習', href: '/learn', icon: BookOpen },
  { id: 'play', label: '破冰', href: '/icebreaker', icon: Gamepad2 },
  { id: 'share', label: '分享', href: '/share', icon: Share2 },
];

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

export const Header: React.FC<HeaderProps> = ({
  title = 'WeChurch',
  subtitle,
  showLogo = true,
  className,
  variant = 'default',
}) => {
  const { user, loading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const isNavActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    if (profile?.display_name) {
      return profile.display_name;
    }
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return '使用者';
  };
  // Convert direct Supabase Storage URLs to proxied URLs
  const rawAvatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const avatarUrl = rawAvatarUrl ? convertToProxiedUrl(rawAvatarUrl) : undefined;

  const userMenu = (
    <div className="w-10 sm:w-12 flex justify-end">
      {loading ? (
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
            <DropdownMenuItem onClick={() => setShowProfileSettings(true)} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
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
  );

  return (
    <header className={cn(
      'w-full',
      variant === 'default' ? 'py-3 sm:py-5 md:py-3' : 'py-2 sm:py-3',
      className
    )}>
      <div className="container mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex items-center justify-between">
          {/* Mobile: Left spacer for balance */}
          <div className="w-10 sm:w-12 md:hidden" />
          
          {/* Desktop: Logo on left */}
          <Link to="/" className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity group shrink-0">
            {showLogo && (
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-soft" />
                <WeChurchLogo size={32} className="relative group-hover:scale-105 transition-transform" />
              </div>
            )}
            <h1 className="font-bold text-foreground text-lg">
              {title}
            </h1>
          </Link>

          {/* Mobile: Center logo */}
          <Link to="/" className="flex md:hidden items-center justify-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity group">
            {showLogo && (
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-soft" />
                <WeChurchLogo size={variant === 'default' ? 36 : 32} className="relative group-hover:scale-105 transition-transform sm:w-12 sm:h-12" />
              </div>
            )}
            <div className="text-center">
              <h1 className={cn(
                'font-bold text-foreground',
                variant === 'default' ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'
              )}>
                {title}
              </h1>
              {subtitle && variant === 'default' && (
                <p className="hidden sm:block text-muted-foreground text-sm mt-1 tracking-wide">
                  {subtitle}
                </p>
              )}
            </div>
          </Link>

          {/* Desktop: Navigation links */}
          <nav className="hidden md:flex items-center gap-1" data-testid="nav-top">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  data-testid={`nav-top-link-${item.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Auth Status */}
          {userMenu}
        </div>
      </div>
      
      <ProfileSettingsDialog 
        open={showProfileSettings} 
        onOpenChange={setShowProfileSettings} 
      />
    </header>
  );
};
