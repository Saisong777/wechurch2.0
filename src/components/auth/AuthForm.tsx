import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
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
