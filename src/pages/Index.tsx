import React, { useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Users, Sparkles, Loader2, Dumbbell, Heart } from 'lucide-react';
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
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Entry Points */}
          <div className="flex flex-col gap-8 mb-16">
            {/* Main Participant Entry - Hero Card with animated logo */}
            <Card variant="highlight" className="group hover:scale-[1.01] transition-all duration-300 cursor-pointer border-2 border-primary/30 shadow-xl hover:shadow-2xl hover:border-primary/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
              <Link to="/user">
                <CardContent className="py-12 md:py-16 text-center relative">
                  {/* Animated Logo */}
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-secondary/30 rounded-full blur-3xl animate-pulse-soft" />
                    <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full gradient-gold flex items-center justify-center glow-gold animate-float shadow-lg">
                      <Dumbbell className="w-14 h-14 md:w-16 md:h-16 text-secondary-foreground" />
                    </div>
                  </div>
                  
                  {/* Title & Tagline */}
                  <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-2">
                    靈魂健身房
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground mb-2">
                    Soul Gym
                  </p>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    一起，活出耶穌的豐盛生命
                  </p>
                  
                  <Button variant="gold" size="xl" className="text-lg px-10 py-6 shadow-lg hover:shadow-xl">
                    開始健身 Join Session
                  </Button>
                </CardContent>
              </Link>
            </Card>

            {/* Secondary Admin Entry - Subtle text link */}
            {loading ? (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : canCreateSession ? (
              <div className="flex justify-center">
                <Link 
                  to="/admin" 
                  className="group inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                  <span className="text-sm">教練入口 Coach Entry</span>
                </Link>
              </div>
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
                <Heart className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-serif text-lg font-semibold mb-2">靈魂健身</h3>
              <p className="text-sm text-muted-foreground">
                七步驟靈魂健身系統，即時同步
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
