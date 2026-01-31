import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { LogIn, Mail, Lock, User, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && user) {
      const redirectTo = localStorage.getItem('login_redirect') || '/notebook';
      localStorage.removeItem('login_redirect');
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
      <Header title="WeChurch" subtitle="" />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse-soft" />
              <WeChurchLogo size={80} className="relative" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              歡迎回來
            </div>
            <p className="text-muted-foreground text-lg">
              一起與主同行，歡迎登入
            </p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
};

const LoginForm: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const redirectTo = localStorage.getItem('login_redirect') || '/notebook';
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + redirectTo,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('登入成功！');
        }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('註冊成功！請查收驗證信件');
        }
      }
    } catch (err) {
      toast.error('發生錯誤，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('請輸入電子郵件');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('send-password-reset', {
        body: {
          email,
          redirectUrl: `${window.location.origin}/reset-password`,
        },
      });
      
      if (response.error) {
        toast.error(response.error.message || '發送失敗，請重試');
      } else if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        setResetEmailSent(true);
        toast.success('密碼重設連結已發送至您的信箱！');
      }
    } catch (err) {
      toast.error('發生錯誤，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'forgot') {
    if (resetEmailSent) {
      return (
        <Card variant="highlight" className="w-full border-2 shadow-lg">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">請查收您的信箱</h3>
            <p className="text-muted-foreground text-sm">
              我們已將密碼重設連結發送至<br />
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              若未收到信件，請檢查垃圾郵件資料夾
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setMode('login');
                setResetEmailSent(false);
              }}
              className="mt-4"
            >
              返回登入
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card variant="highlight" className="w-full border-2 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl">忘記密碼</CardTitle>
          <CardDescription>輸入您的電子郵件，我們將發送重設連結</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                電子郵件
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '發送中...' : '發送重設連結'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                返回登入
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="highlight" className="w-full border-2 shadow-lg">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">
          {mode === 'login' ? '登入帳戶' : '建立新帳戶'}
        </CardTitle>
        <CardDescription>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Google Sign In Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full h-12 text-base border-2 hover:bg-muted/50 hover:border-primary/30 transition-all"
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或使用電子郵件</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                顯示名稱
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="您的名稱"
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              電子郵件
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                密碼
              </Label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  忘記密碼？
                </button>
              )}
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="h-11"
              showStrength={mode === 'signup'}
            />
          </div>

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '處理中...' : mode === 'login' ? '登入' : '註冊'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === 'login' ? '沒有帳戶？建立新帳戶' : '已有帳戶？登入'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
