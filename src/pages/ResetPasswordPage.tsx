import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';

const ResetPasswordPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header title="WeChurch" subtitle="" />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-2">密碼重設</h1>
          <p className="text-muted-foreground mb-6">
            請使用 Replit 帳戶登入或聯繫管理員重設密碼
          </p>
          <Button onClick={() => navigate('/login')} variant="default">
            返回登入頁面
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
