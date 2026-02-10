import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { joinSession, findSmallestGroup, assignLatecomerToGroup } from '@/lib/api-helpers';
import { Users, Mail, User as UserIcon, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface JoinFormProps {
  onJoined: (isLatecomer?: boolean) => void;
}

export const JoinForm: React.FC<JoinFormProps> = ({ onJoined }) => {
  const { currentSession, setCurrentUser, addUser } = useSession();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isRemote, setIsRemote] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('bible_study_guest_name');
    const savedEmail = localStorage.getItem('bible_study_guest_email');
    const savedGender = localStorage.getItem('bible_study_guest_gender');
    const savedLocation = localStorage.getItem('bible_study_guest_location');
    
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedGender === 'male' || savedGender === 'female') setGender(savedGender);
    if (savedLocation && savedLocation !== 'On-site') {
      setIsRemote(true);
      setLocationName(savedLocation);
    }
    
    if (user) {
      const displayName = user.user_metadata?.display_name || user.displayName || '';
      const userEmail = user.email || '';
      if (displayName) {
        setName(displayName);
        localStorage.setItem('bible_study_guest_name', displayName);
      }
      if (userEmail) {
        setEmail(userEmail);
        localStorage.setItem('bible_study_guest_email', userEmail);
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSession?.id) {
      toast.error('請先輸入有效的 Session ID');
      return;
    }
    
    setIsLoading(true);

    const location = isRemote && locationName.trim() ? locationName.trim() : 'On-site';

    localStorage.setItem('bible_study_guest_name', name);
    localStorage.setItem('bible_study_guest_email', email);
    localStorage.setItem('bible_study_guest_gender', gender);
    localStorage.setItem('bible_study_guest_location', location);

    try {
      const joinedUser = await joinSession(currentSession.id, name, email, gender, location);

      if (joinedUser) {
        const sessionStatus = currentSession.status;
        const isLatecomer = ['grouping', 'verification', 'studying'].includes(sessionStatus) && !joinedUser.groupNumber;

        if (isLatecomer) {
          const smallestGroup = await findSmallestGroup(currentSession.id, location);
          if (smallestGroup) {
            const assigned = await assignLatecomerToGroup(joinedUser.id, smallestGroup);
            if (assigned) {
              joinedUser.groupNumber = smallestGroup;
              toast.success(`歡迎加入！您已被分配到第 ${smallestGroup} 組`);
            }
          }
        }

        setCurrentUser(joinedUser);
        addUser(joinedUser);
        localStorage.removeItem('pending_session_id');
        localStorage.setItem('bible_study_participant_id', joinedUser.id);
        localStorage.setItem('user_email', email);
        toast.success('成功加入健身課程！');
        onJoined(isLatecomer && !!joinedUser.groupNumber);
      } else {
        toast.error('加入失敗，請重試');
      }
    } catch (error) {
      console.error('[JoinForm] Error during join:', error);
      toast.error('加入失敗，請重試');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      <Card variant="highlight">
        <CardHeader className="text-center px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
          <div className="mx-auto w-20 h-20 sm:w-16 sm:h-16 rounded-full gradient-gold flex items-center justify-center mb-5 sm:mb-4 glow-gold">
            <Users className="w-10 h-10 sm:w-8 sm:h-8 text-secondary-foreground" />
          </div>
          <CardTitle className="text-2xl sm:text-2xl">加入靈魂健身房</CardTitle>
          <CardDescription className="text-base sm:text-base mt-1">
            Join Soul Gym Session
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
          {!user && (
            <div className="mb-6 space-y-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-14 sm:h-12 text-base border-2"
                onClick={() => {
                  localStorage.setItem('pending_session_id', currentSession?.id || '');
                  window.location.href = '/api/login';
                }}
                data-testid="button-google-login"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                使用 Google 帳號加入
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或手動填寫 or fill manually</span>
                </div>
              </div>
            </div>
          )}
          {user && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-center">
              <span className="text-muted-foreground">已登入為</span>{' '}
              <span className="font-medium">{user.user_metadata?.display_name || user.displayName || user.email}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base sm:text-sm flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                姓名 Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入您的姓名"
                required
                className="h-14 sm:h-12 text-lg sm:text-base"
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base sm:text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                電子郵件 Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="h-14 sm:h-12 text-lg sm:text-base"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base sm:text-sm">性別 Gender</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as 'male' | 'female')}
                className="flex gap-3 sm:gap-4"
              >
                <div className="flex-1">
                  <Label
                    htmlFor="male"
                    className={`flex items-center justify-center gap-2 p-4 sm:p-4 rounded-lg border-2 cursor-pointer transition-all touch-manipulation active:scale-[0.98] ${
                      gender === 'male'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="male" id="male" className="sr-only" />
                    <span className="font-medium text-base sm:text-sm">男 Male</span>
                  </Label>
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor="female"
                    className={`flex items-center justify-center gap-2 p-4 sm:p-4 rounded-lg border-2 cursor-pointer transition-all touch-manipulation active:scale-[0.98] ${
                      gender === 'female'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="female" id="female" className="sr-only" />
                    <span className="font-medium text-base sm:text-sm">女 Female</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
                  <Label htmlFor="remote-toggle" className="text-base sm:text-sm cursor-pointer">
                    遠端參加？ Remote Location?
                  </Label>
                </div>
                <Switch
                  id="remote-toggle"
                  checked={isRemote}
                  onCheckedChange={setIsRemote}
                />
              </div>
              
              {isRemote && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="location" className="text-base sm:text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    地點名稱 Location Name
                  </Label>
                  <Input
                    id="location"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="例如：桃園教會、台中小組"
                    required={isRemote}
                    className="h-14 sm:h-12 text-lg sm:text-base"
                    data-testid="input-location"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="gold"
              size="xl"
              className="w-full h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98]"
              disabled={isLoading || !name || !email || (isRemote && !locationName.trim())}
              data-testid="button-join"
            >
              {isLoading ? '加入中...' : '加入課程 Join Now'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
