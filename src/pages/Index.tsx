import React, { useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Settings, Users, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canCreateSession, loading: roleLoading } = useUserRole();
  
  const loading = authLoading || (user && roleLoading);
  
  // If session ID is in URL, redirect to user page with that session
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      navigate(`/user?session=${sessionId}`);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-secondary/30 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-32 h-32 rounded-full gradient-gold flex items-center justify-center glow-gold animate-float">
                <BookOpen className="w-16 h-16 text-secondary-foreground" />
              </div>
            </div>
            
            <h1 className="font-serif text-4xl md:text-6xl font-bold text-foreground mb-4">
              靈魂健身房
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Soul Gym
            </p>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              一起，活出耶穌的豐盛生命
            </p>
          </div>

          {/* Entry Points */}
          <div className={`grid gap-6 mb-16 ${loading || canCreateSession ? 'md:grid-cols-2' : ''}`}>
            <Card variant="highlight" className="group hover:scale-[1.02] transition-transform cursor-pointer">
              <Link to="/user">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-20 h-20 rounded-full gradient-gold flex items-center justify-center mb-6 group-hover:glow-gold transition-shadow">
                    <Users className="w-10 h-10 text-secondary-foreground" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
                    參加者入口
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Participant Entry
                  </p>
                  <Button variant="gold" size="lg">
                    加入查經 Join Study
                  </Button>
                </CardContent>
              </Link>
            </Card>

            {/* Show Admin card only if loading or user can create sessions */}
            {loading ? (
              <Card variant="default" className="group">
                <CardContent className="py-12 text-center flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : canCreateSession ? (
              <Card variant="default" className="group hover:scale-[1.02] transition-transform cursor-pointer">
                <Link to="/admin">
                  <CardContent className="py-12 text-center">
                    <div className="mx-auto w-20 h-20 rounded-full gradient-navy flex items-center justify-center mb-6">
                      <Settings className="w-10 h-10 text-secondary" />
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
                      主持人入口
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Host / Admin Entry
                    </p>
                    <Button variant="navy" size="lg">
                      管理聚會 Manage Session
                    </Button>
                  </CardContent>
                </Link>
              </Card>
            ) : null}
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-serif text-lg font-semibold mb-2">智慧分組</h3>
              <p className="text-sm text-muted-foreground">
                支援隨機或性別平衡分組，自動顯示組別
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-serif text-lg font-semibold mb-2">結構化筆記</h3>
              <p className="text-sm text-muted-foreground">
                引導式的查經筆記表單，即時同步
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-serif text-lg font-semibold mb-2">AI 分析</h3>
              <p className="text-sm text-muted-foreground">
                自動生成小組摘要和整體洞察報告
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
