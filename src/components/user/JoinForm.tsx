import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { joinSession } from '@/lib/supabase-helpers';
import { supabase } from '@/integrations/supabase/client';
import { Users, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface JoinFormProps {
  onJoined: () => void;
}

export const JoinForm: React.FC<JoinFormProps> = ({ onJoined }) => {
  const { currentSession, setCurrentUser, addUser } = useSession();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Load saved info from localStorage or from logged-in user
  useEffect(() => {
    if (user) {
      // Pre-fill from Google account
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const userEmail = user.email || '';
      if (displayName) setName(displayName);
      if (userEmail) setEmail(userEmail);
    } else {
      // Load from localStorage for returning guests
      const savedName = localStorage.getItem('bible_study_guest_name');
      const savedEmail = localStorage.getItem('bible_study_guest_email');
      const savedGender = localStorage.getItem('bible_study_guest_gender');
      if (savedName) setName(savedName);
      if (savedEmail) setEmail(savedEmail);
      if (savedGender === 'male' || savedGender === 'female') setGender(savedGender);
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/user?session=${currentSession?.id || ''}`,
        },
      });
      if (error) {
        toast.error('Google 登入失敗: ' + error.message);
      }
    } catch (error) {
      toast.error('Google 登入失敗');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSession?.id) {
      toast.error('請先輸入有效的 Session ID');
      return;
    }
    
    setIsLoading(true);

    // Save to localStorage for next time
    localStorage.setItem('bible_study_guest_name', name);
    localStorage.setItem('bible_study_guest_email', email);
    localStorage.setItem('bible_study_guest_gender', gender);

    const user = await joinSession(currentSession.id, name, email, gender);

    if (user) {
      setCurrentUser(user);
      addUser(user);
      toast.success('成功加入查經！');
      onJoined();
    } else {
      toast.error('加入失敗，請重試');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <Card variant="highlight" className="border-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center mb-4 glow-gold">
            <Users className="w-8 h-8 text-secondary-foreground" />
          </div>
          <CardTitle className="text-2xl">加入查經小組</CardTitle>
          <CardDescription className="text-base">
            Join Bible Study Session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google Sign In Button */}
          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base flex items-center justify-center gap-3"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || authLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              使用 Google 帳號登入
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-2">
              登入後會自動填入您的姓名和電子郵件
            </p>
          </div>

          <div className="relative mb-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-sm text-muted-foreground">
              或直接填寫資料加入
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                姓名 Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入您的姓名"
                required
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center gap-2">
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
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base">性別 Gender</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as 'male' | 'female')}
                className="flex gap-4"
              >
                <div className="flex-1">
                  <Label
                    htmlFor="male"
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      gender === 'male'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="male" id="male" className="sr-only" />
                    <span className="text-lg">👨</span>
                    <span className="font-medium">男 Male</span>
                  </Label>
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor="female"
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      gender === 'female'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="female" id="female" className="sr-only" />
                    <span className="text-lg">👩</span>
                    <span className="font-medium">女 Female</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              variant="gold"
              size="xl"
              className="w-full"
              disabled={isLoading || !name || !email}
            >
              {isLoading ? '加入中...' : '加入查經 Join Now'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
