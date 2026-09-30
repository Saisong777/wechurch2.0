import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { WeChurchLogo } from '@/components/icons/WeChurchLogo';
import { SiGoogle } from 'react-icons/si';
import { consumeLoginReturn, rememberLoginReturn } from '@/lib/loginReturn';
import { LineLoginButton } from '@/components/auth/LineLoginButton';
import { AppearanceControl } from '@/components/theme/AppearanceControl';

const bibleVerses = [
  '「你們祈求，就給你們；尋找，就尋見；叩門，就給你們開門。」— 馬太福音 7:7',
  '「我是世界的光，跟從我的，就不在黑暗裡走。」— 約翰福音 8:12',
  '「因為神愛世人，甚至將他的獨生子賜給他們。」— 約翰福音 3:16',
  '「你們要常在我裡面，我也常在你們裡面。」— 約翰福音 15:4',
  '「耶和華是我的牧者，我必不致缺乏。」— 詩篇 23:1',
  '「我留下平安給你們，我將我的平安賜給你們。」— 約翰福音 14:27',
];

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recipeTest = searchParams.get('recipeTest') === 'form-flow' ? 'form-flow' : 'default';

  React.useEffect(() => {
    if (!loading && user) {
      localStorage.removeItem('login_redirect');
      navigate(consumeLoginReturn(searchParams.get('returnTo')), { replace: true });
    }
  }, [user, loading, navigate, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="login-surface min-h-screen bg-background text-foreground relative overflow-hidden"
      data-login-recipe={recipeTest}
    >
      <div className="absolute right-4 top-3 z-20"><AppearanceControl /></div>

      <main className="relative z-10 container mx-auto px-4 flex flex-col items-center justify-start min-h-screen pt-16 pb-8">
        <div className="login-brand-lockup text-center mb-10">
          <div className="mb-4">
            <WeChurchLogo size={64} className="mx-auto" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">WeChurch</h1>
          <p className="text-base text-muted-foreground">我們就是教會</p>
        </div>

        <div className="w-full max-w-md">
          <LoginForm />
        </div>

        {import.meta.env.DEV && (
          <a
            href="/api/dev-login"
            className="mt-6 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            data-testid="link-dev-login"
          >
            開發者快速登入
          </a>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Powered by Christ</p>
      </main>
    </div>
  );
};

const LoginForm: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [staging, setStaging] = useState(false);
  const [authOptions, setAuthOptions] = useState<{ google: boolean; emailRegistration: boolean } | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  React.useEffect(() => {
    let active = true;
    fetch('/api/auth/options', { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('AUTH_OPTIONS_UNAVAILABLE');
      return r.json();
    }).then(data => {
      if (typeof data?.google !== 'boolean' || typeof data?.emailRegistration !== 'boolean') throw new Error('AUTH_OPTIONS_INVALID');
      if (active) { setStaging(data.staging === true); setAuthOptions(data); }
    }).catch(() => { if (active) setOptionsError(true); });
    return () => { active = false; };
  }, []);

  const randomVerse = useMemo(() => bibleVerses[Math.floor(Math.random() * bibleVerses.length)], []);

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
        <Card className="login-form-card w-full rounded-lg shadow-sheet border-0 bg-card text-foreground">
          <CardContent className="py-8 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-brand-sky/10 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-brand-sky" />
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
              className="mt-4 h-[52px] rounded-xl font-semibold text-base"
              data-testid="button-back-to-login"
            >
              返回登入
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="login-form-card w-full rounded-lg shadow-sheet border-0 bg-card text-foreground">
        <CardHeader className="text-center pb-4 pt-8 px-6">
          <CardTitle className="text-xl">忘記密碼</CardTitle>
          <CardDescription>輸入您的電子郵件，我們將發送重設連結</CardDescription>
        </CardHeader>
        <CardContent className="pb-8 px-6 space-y-6">
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
                data-testid="input-email-forgot"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-[52px] rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading}
              data-testid="button-send-reset"
            >
              {isLoading ? '發送中...' : '發送重設連結'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
                data-testid="button-back-login"
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

  const handleGoogleLogin = () => {
    const returnTo = params.get('returnTo');
    if (returnTo) rememberLoginReturn(returnTo);
    window.location.href = '/api/login';
  };

  if (!authOptions) return <Card className="login-form-card"><CardContent className="p-6 text-center">
    {optionsError ? <><p role="alert">暫時無法載入登入方式，請重試。</p><Button className="mt-4" onClick={() => window.location.reload()}>重新載入</Button></> : <p role="status">載入登入方式…</p>}
  </CardContent></Card>;
  const googleOnly = !authOptions.emailRegistration;

  return (
    <Card className="login-form-card w-full rounded-lg shadow-sheet border-0 bg-card text-foreground">
      <CardContent className="py-8 px-6">
        {params.get('error') === 'google_link_required' && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            此信箱已有帳號。請先用原本的方式登入，並聯絡同工協助確認 Google 帳號連結，避免建立重複帳號。
          </p>
        )}
        {['google_login_failed', 'google_unavailable'].includes(params.get('error') || '') && (
          <p role="alert" className="mb-4 text-sm text-destructive">Google 登入未完成，請重新嘗試。</p>
        )}
        <p className="text-sm italic text-brand-sky mb-4 text-center leading-relaxed" data-testid="text-bible-verse">
          {randomVerse}
        </p>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            {googleOnly ? '歡迎來到 WeChurch' : mode === 'login' ? '登入帳戶' : '建立新帳戶'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {googleOnly ? '登入或建立帳號' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </p>
        </div>

        {!googleOnly && <div className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="group" aria-label="帳號操作">
          <Button type="button" variant={mode === 'signup' ? 'default' : 'ghost'} aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>首次使用</Button>
          <Button type="button" variant={mode === 'login' ? 'default' : 'ghost'} aria-pressed={mode === 'login'} onClick={() => setMode('login')}>已有帳號</Button>
        </div>}
        {!googleOnly && <LineLoginButton />}
        {authOptions.google && <><div className="space-y-3">
          <Button
            type="button"
            className="w-full h-[52px] rounded-xl font-semibold text-base gap-3 bg-card hover:bg-muted text-brand-indigo border-[1.5px] border-brand-indigo"
            onClick={handleGoogleLogin}
            data-testid="button-google-login"
          >
            <SiGoogle className="w-5 h-5" />
            使用 Google 帳號繼續
          </Button>
        </div>

        {!googleOnly && <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或使用電子郵件</span>
          </div>
        </div>}

        </>}

        {googleOnly && !authOptions.google && <p role="alert">Google 登入尚未開放，請稍後再試。</p>}
        {!googleOnly && <form onSubmit={handleSubmit} className="space-y-4">
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
                data-testid="input-display-name"
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
              {mode === 'login' && !staging && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-muted-foreground hover:text-brand-sky transition-colors"
                  data-testid="button-forgot-password"
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
              minLength={mode === 'signup' ? 8 : 1}
              className="h-11"
              showStrength={mode === 'signup'}
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-[52px] rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-primary-foreground"
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
              data-testid="button-toggle-mode"
            >
              {mode === 'login' ? '沒有帳戶？建立新帳戶' : '已有帳戶？登入'}
            </button>
          </div>
        </form>}
      </CardContent>
    </Card>
  );
};

export default LoginPage;
