import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { KeyRound, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setErrorMessage('缺少重設連結參數，請從信箱中的連結進入');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setIsValid(true);
          setEmail(data.email);
        } else {
          setErrorMessage(data.message || '無效的重設連結');
        }
      } catch {
        setErrorMessage('驗證失敗，請稍後重試');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('兩次輸入的密碼不一致');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setResetSuccess(true);
        toast.success('密碼重設成功！');
      } else {
        toast.error(data.message || '重設失敗，請重試');
      }
    } catch {
      toast.error('發生錯誤，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
        <Header title="WeChurch" subtitle="" />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">正在驗證重設連結...</p>
          </div>
        </main>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
        <Header title="WeChurch" subtitle="" />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <Card variant="highlight" className="border-2 shadow-lg">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-xl" data-testid="text-reset-success">密碼重設成功</h3>
                <p className="text-muted-foreground">
                  您的密碼已成功更新，請使用新密碼登入。
                </p>
                <Button
                  onClick={() => navigate('/login')}
                  variant="default"
                  size="lg"
                  className="mt-4"
                  data-testid="button-go-login"
                >
                  前往登入
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
        <Header title="WeChurch" subtitle="" />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <Card variant="highlight" className="border-2 shadow-lg">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="font-semibold text-xl">無法重設密碼</h3>
                <p className="text-muted-foreground">{errorMessage}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => navigate('/login')}
                    variant="default"
                    data-testid="button-back-login"
                  >
                    返回登入頁面
                  </Button>
                  <Button
                    onClick={() => navigate('/login')}
                    variant="outline"
                    data-testid="button-request-again"
                  >
                    重新申請重設
                  </Button>
                </div>
              </CardContent>
            </Card>
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
          <Card variant="highlight" className="border-2 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">設定新密碼</CardTitle>
              <CardDescription>
                {email && (
                  <span className="block mt-1">
                    帳號：<span className="font-medium text-foreground">{email}</span>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    新密碼
                  </Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 個字元"
                    required
                    minLength={6}
                    className="h-11"
                    showStrength
                    data-testid="input-new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    確認新密碼
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次輸入新密碼"
                    required
                    minLength={6}
                    className="h-11"
                    data-testid="input-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? '處理中...' : '確認重設密碼'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
