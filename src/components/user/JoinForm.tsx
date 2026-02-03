import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { joinSession, findSmallestGroup, assignLatecomerToGroup } from '@/lib/supabase-helpers';
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
