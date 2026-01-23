import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Mail, Lock, User, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface ParticipantAuthProps {
  onSuccess: () => void;
  onGuestJoin: (name: string, email: string, gender: 'male' | 'female') => void;
  verseReference?: string;
}

export const ParticipantAuth: React.FC<ParticipantAuthProps> = ({ onSuccess, onGuestJoin, verseReference }) => {
  const { signIn, signUp, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestGender, setGuestGender] = useState<'male' | 'female'>('male');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // If user is already logged in, show a simpler UI
  const isLoggedIn = !!user;

  // Load saved guest info from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('bible_study_guest_name');
    const savedEmail = localStorage.getItem('bible_study_guest_email');
    const savedGender = localStorage.getItem('bible_study_guest_gender');
    if (savedName) setGuestName(savedName);
    if (savedEmail) setGuestEmail(savedEmail);
    if (savedGender === 'male' || savedGender === 'female') setGuestGender(savedGender);
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href,
        },
      });
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      toast.error('Google 登入失敗，請重試');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('登入成功！');
          onSuccess();
        }
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          toast.error('請輸入您的名稱');
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('註冊成功！');
          onSuccess();
        }
      }
    } catch (err) {
      toast.error('操作失敗，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error('請填寫姓名和電子郵件');
      return;
    }

    // Save to localStorage for next time
    localStorage.setItem('bible_study_guest_name', guestName);
    localStorage.setItem('bible_study_guest_email', guestEmail);
    localStorage.setItem('bible_study_guest_gender', guestGender);

    onGuestJoin(guestName, guestEmail, guestGender);
  };

  // If user is already logged in, show options to continue or join as guest
  if (isLoggedIn && mode !== 'guest') {
    return (
      <Card className="w-full max-w-md mx-auto border-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center glow-gold">
            <BookOpen className="w-8 h-8 text-secondary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">歡迎回來！</CardTitle>
            <CardDescription className="text-base mt-2">
              Welcome back, {user?.email}
            </CardDescription>
            {verseReference && (
              <p className="text-sm text-primary font-medium mt-2">
                📖 {verseReference}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="gold"
            size="lg"
            className="w-full h-12"
            onClick={onSuccess}
          >
            <User className="w-5 h-5 mr-2" />
            以此帳號繼續 Continue with this account
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-12"
            onClick={() => setMode('guest')}
          >
            <UserX className="w-5 h-5 mr-2" />
            訪客快速加入 Join as Guest
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Guest mode UI
  if (mode === 'guest') {
    return (
      <Card className="w-full max-w-md mx-auto border-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <UserX className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">訪客加入</CardTitle>
            <CardDescription className="text-base mt-2">
              Join as Guest (no account needed)
            </CardDescription>
            {verseReference && (
              <p className="text-sm text-primary font-medium mt-2">
                📖 {verseReference}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guestName" className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                姓名 Name
              </Label>
              <Input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="請輸入您的姓名"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestEmail" className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                電子郵件 Email
              </Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base">性別 Gender</Label>
              <RadioGroup
                value={guestGender}
                onValueChange={(value) => setGuestGender(value as 'male' | 'female')}
                className="flex gap-4"
              >
                <div className="flex-1">
                  <Label
                    htmlFor="guest-male"
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      guestGender === 'male'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="male" id="guest-male" className="sr-only" />
                    <span>👨</span>
                    <span className="font-medium">男</span>
                  </Label>
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor="guest-female"
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      guestGender === 'female'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="female" id="guest-female" className="sr-only" />
                    <span>👩</span>
                    <span className="font-medium">女</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="w-full"
            >
              加入查經 Join Now
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              想要登入帳號？<span className="text-primary font-medium">返回登入</span>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Login/Signup mode UI
  return (
    <Card className="w-full max-w-md mx-auto border-2">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center glow-gold">
          <BookOpen className="w-8 h-8 text-secondary-foreground" />
        </div>
        <div>
          <CardTitle className="text-2xl font-serif">
            {mode === 'login' ? '登入加入查經' : '註冊新帳號'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {mode === 'login' ? 'Sign in to join Bible Study' : 'Create account to join'}
          </CardDescription>
          {verseReference && (
            <p className="text-sm text-primary font-medium mt-2">
              📖 {verseReference}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Google Sign In Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full mb-4 h-12 text-base border-2 hover:bg-muted/50"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isGoogleLoading ? '連接中...' : '使用 Google 登入'}
        </Button>

        {/* Guest join button */}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full mb-4 h-12 text-base"
          onClick={() => setMode('guest')}
        >
          <UserX className="w-5 h-5 mr-2" />
          訪客快速加入 Join as Guest
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或使用 Email</span>
          </div>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                您的名稱 Your Name
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="輸入您的名稱"
                className="h-11"
                required={mode === 'signup'}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              電子郵件 Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" />
              密碼 Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11"
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            variant="gold"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '處理中...' : mode === 'login' ? '登入 Sign In' : '註冊 Sign Up'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === 'login' ? (
              <>第一次加入？<span className="text-primary font-medium">註冊新帳號</span></>
            ) : (
              <>已有帳號？<span className="text-primary font-medium">登入</span></>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
