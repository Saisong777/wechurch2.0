import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Mail, Lock, User, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && user) {
      localStorage.removeItem('login_redirect');
      navigate('/', { replace: true });
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
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

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
          toast.success('註冊成功！');
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
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        setResetEmailSent(true);
        toast.success('密碼重設連結已發送至您的信箱！');
      } else {
        toast.error('發送失敗，請重試');
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
              data-testid="input-email"
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
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isLoading}
            data-testid="button-submit"
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
