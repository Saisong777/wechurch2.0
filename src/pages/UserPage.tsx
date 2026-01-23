import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { JoinForm } from '@/components/user/JoinForm';
import { WaitingRoom } from '@/components/user/WaitingRoom';
import { GroupReveal } from '@/components/user/GroupReveal';
import { StudyForm } from '@/components/user/StudyForm';
import { SubmissionReview } from '@/components/user/SubmissionReview';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BookOpen, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserStep = 'landing' | 'enter-session' | 'join' | 'waiting' | 'group-reveal' | 'study' | 'review';

export const UserPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, currentSession, setCurrentSession } = useSession();
  const [step, setStep] = useState<UserStep>('landing');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle session ID from QR code URL (support both 'session' and 'session_id' params)
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session_id') || searchParams.get('session');
    if (sessionFromUrl && !currentSession) {
      setSessionId(sessionFromUrl);
      // Store in localStorage for persistence across auth redirects
      localStorage.setItem('pending_session_id', sessionFromUrl);
      loadSessionAndCheckAuth(sessionFromUrl);
    } else if (!sessionFromUrl && !currentSession) {
      // Check localStorage for pending session after OAuth redirect
      const pendingSession = localStorage.getItem('pending_session_id');
      if (pendingSession) {
        setSessionId(pendingSession);
        loadSessionAndCheckAuth(pendingSession);
      }
    }
  }, [searchParams]);

  const loadSessionAndCheckAuth = async (id: string) => {
    setIsLoading(true);
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id.trim())
      .maybeSingle();

    if (sessionError || !sessionData) {
      toast.error('找不到此 Session，請確認 ID 是否正確');
      setIsLoading(false);
      setStep('enter-session');
      return;
    }

    setCurrentSession({
      id: sessionData.id,
      bibleVerse: '',
      verseReference: sessionData.verse_reference,
      status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
      createdAt: new Date(sessionData.created_at),
      groups: [],
    });

    setIsLoading(false);
    
    // QR code scanning goes directly to join form
    setStep('join');
  };

  // Watch for user group number changes (real-time grouping)
  useEffect(() => {
    if (currentUser?.groupNumber && step === 'waiting') {
      setStep('group-reveal');
    }
  }, [currentUser?.groupNumber, step]);

  const handleEnterSession = async () => {
    if (!sessionId.trim()) {
      toast.error('請輸入 Session ID');
      return;
    }
    await loadSessionAndCheckAuth(sessionId);
  };

  const renderStep = () => {
    switch (step) {
      case 'landing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-secondary/30 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-32 h-32 rounded-full gradient-gold flex items-center justify-center glow-gold animate-float">
                <BookOpen className="w-16 h-16 text-secondary-foreground" />
              </div>
            </div>
            
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground text-center mb-4">
              共同查經
            </h1>
            <p className="text-lg text-muted-foreground text-center mb-2">
              Bible Study Together
            </p>
            <p className="text-muted-foreground text-center max-w-md mb-12">
              一起探索神的話語，在小組中分享和學習
            </p>

            <Button
              variant="gold"
              size="xl"
              onClick={() => setStep('enter-session')}
              className="min-w-64"
            >
              加入查經 Join Bible Study
            </Button>
          </div>
        );

      case 'enter-session':
        return (
          <div className="w-full max-w-md mx-auto px-4 py-8 animate-fade-in">
            <Card variant="highlight" className="border-2">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center mb-4 glow-gold">
                  <BookOpen className="w-8 h-8 text-secondary-foreground" />
                </div>
                <CardTitle className="text-2xl">輸入聚會代碼</CardTitle>
                <CardDescription className="text-base">
                  Enter Session ID from your host
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionId" className="text-base">
                    Session ID
                  </Label>
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="輸入主持人提供的 Session ID"
                    className="h-12 text-base font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    請向主持人索取聚會代碼
                  </p>
                </div>

                <Button
                  variant="gold"
                  size="xl"
                  className="w-full"
                  onClick={handleEnterSession}
                  disabled={isLoading || !sessionId.trim()}
                >
                  {isLoading ? '驗證中...' : (
                    <>
                      繼續 Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'join':
        return (
          <div className="px-4 py-8">
            <JoinForm onJoined={() => setStep('waiting')} />
          </div>
        );

      case 'waiting':
        return (
          <div className="px-4 py-8">
            <WaitingRoom onGroupingStarted={() => setStep('group-reveal')} />
          </div>
        );

      case 'group-reveal':
        return <GroupReveal onContinue={() => setStep('study')} />;

      case 'study':
        return (
          <div className="px-4 py-8">
            <StudyForm onSubmitted={() => setStep('review')} />
          </div>
        );

      case 'review':
        return (
          <div className="px-4 py-8">
            <SubmissionReview />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant={step === 'landing' ? 'default' : 'compact'} />
      <main className="container mx-auto pb-8">
        {renderStep()}
      </main>
    </div>
  );
};
