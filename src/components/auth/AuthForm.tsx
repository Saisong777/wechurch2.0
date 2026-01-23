import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

interface AuthFormProps {
  onSuccess?: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/admin',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('登入成功！Welcome back!');
          onSuccess?.();
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('註冊成功！Account created!');
          onSuccess?.();
        }
      }
    } catch (err) {
      toast.error('發生錯誤，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="highlight" className="w-full max-w-md mx-auto border-2">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full gradient-navy flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-secondary" />
        </div>
        <CardTitle className="text-2xl">
          {isLogin ? '主持人登入' : '建立帳戶'}
        </CardTitle>
        <CardDescription className="text-base">
          {isLogin ? 'Admin Login' : 'Create Admin Account'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Google Sign In Button */}
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="w-full mb-6 h-14 text-base border-2 hover:bg-muted/50"
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

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或使用電子郵件 Or use email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                顯示名稱 Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="您的名稱"
                className="h-12 text-base"
              />
            </div>
          )}

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
              placeholder="admin@church.org"
              required
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              密碼 Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="h-12 text-base"
            />
          </div>

          <Button
            type="submit"
            variant="navy"
            size="xl"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '處理中...' : isLogin ? '登入 Login' : '註冊 Sign Up'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? '沒有帳戶？建立新帳戶' : '已有帳戶？登入'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};