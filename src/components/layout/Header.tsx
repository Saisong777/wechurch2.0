import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SoulGymLogo } from '@/components/icons/SoulGymLogo';
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
import { LogOut, BookMarked, User, Settings } from 'lucide-react';
import { ProfileSettingsDialog } from '@/components/user/ProfileSettingsDialog';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

export const Header: React.FC<HeaderProps> = ({
  title = '靈魂健身房',
  subtitle = 'Soul Gym',
  showLogo = true,
  className,
  variant = 'default',
}) => {
  const { user, loading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    // Prefer profile table data, fallback to user metadata
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

  // Get avatar URL: prefer profile table, fallback to user metadata
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <header className={cn(
      'w-full',
      variant === 'default' ? 'py-5 sm:py-6' : 'py-3 sm:py-4',
      className
    )}>
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between">
          {/* Left spacer for balance */}
          <div className="w-10 sm:w-12" />
          
          {/* Center: Logo and Title - Clickable to go home */}
          <Link to="/" className="flex items-center justify-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            {showLogo && (
              <div className="relative">
                <div className="absolute inset-0 bg-secondary/20 rounded-full blur-xl animate-pulse-soft" />
                <SoulGymLogo size={variant === 'default' ? 44 : 36} className="relative sm:w-12 sm:h-12" />
              </div>
            )}
            <div className="text-center">
              <h1 className={cn(
                'font-serif font-bold text-foreground',
                variant === 'default' ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-xl sm:text-2xl'
              )}>
                {title}
              </h1>
              {subtitle && variant === 'default' && (
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 tracking-wide">
                  {subtitle}
                </p>
              )}
            </div>
          </Link>

          {/* Right: Auth Status */}
          <div className="w-10 sm:w-12 flex justify-end">
            {loading ? (
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 p-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary/20 text-secondary text-sm font-medium">
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
        </div>
      </div>
      
      <ProfileSettingsDialog 
        open={showProfileSettings} 
        onOpenChange={setShowProfileSettings} 
      />
    </header>
  );
};