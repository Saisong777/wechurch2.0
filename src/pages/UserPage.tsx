import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { JoinForm } from '@/components/user/JoinForm';
import { WaitingRoom } from '@/components/user/WaitingRoom';
import { GroupReveal } from '@/components/user/GroupReveal';
import { GroupVerification } from '@/components/user/GroupVerification';
import { StudyForm } from '@/components/user/StudyForm';
import { SubmissionReview } from '@/components/user/SubmissionReview';
import { QRCodeScanner } from '@/components/user/QRCodeScanner';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BookOpen, ArrowRight, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserStep = 'landing' | 'enter-session' | 'join' | 'waiting' | 'group-reveal' | 'verification' | 'study' | 'review';

// localStorage keys for session persistence
const STORAGE_KEYS = {
  SESSION_ID: 'pending_session_id',
  PARTICIPANT_ID: 'bible_study_participant_id',
  USER_STEP: 'bible_study_user_step',
};

export const UserPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, currentSession, setCurrentSession, setCurrentUser } = useSession();
  const [step, setStep] = useState<UserStep>('landing');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore user session on page load/refresh
  const restoreUserSession = useCallback(async () => {
    const storedSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const storedParticipantId = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID);
    const storedStep = localStorage.getItem(STORAGE_KEYS.USER_STEP) as UserStep | null;
    const storedEmail = localStorage.getItem('bible_study_guest_email');

    // If no session or participant info stored, nothing to restore
    if (!storedSessionId || !storedParticipantId || !storedEmail) {
      setIsRestoring(false);
      return false;
    }

    try {
      // Fetch the session first
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions_public')
        .select('*')
        .eq('id', storedSessionId)
        .maybeSingle();

      if (sessionError || !sessionData) {
        console.log('[UserPage] Session not found or expired, clearing stored data');
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        setIsRestoring(false);
        return false;
      }

      // Try to get the participant data using the RPC function
      const { data: participantData } = await supabase.rpc('get_participant_for_reentry', {
        p_session_id: storedSessionId,
        p_email: storedEmail,
      });

      if (!participantData || participantData.length === 0) {
        console.log('[UserPage] Participant not found, clearing stored data');
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        setIsRestoring(false);
        return false;
      }

      const participant = participantData[0];

      // Restore session state
      setCurrentSession({
        id: sessionData.id,
        bibleVerse: '',
        verseReference: sessionData.verse_reference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.created_at),
        groups: [],
        allowLatecomers: sessionData.allow_latecomers || false,
      });

      // Restore user state
      setCurrentUser({
        id: participant.id,
        name: participant.name,
        email: storedEmail,
        gender: participant.gender as 'male' | 'female',
        groupNumber: participant.group_number || undefined,
        joinedAt: new Date(participant.joined_at),
        location: participant.location,
        readyConfirmed: participant.ready_confirmed,
      });

      // Determine the correct step based on session status and user state
      let restoredStep: UserStep = 'waiting';
      
      if (sessionData.status === 'studying') {
        restoredStep = 'study';
      } else if (sessionData.status === 'grouping') {
        if (participant.ready_confirmed) {
          restoredStep = 'study'; // All confirmed, waiting for others
        } else if (participant.group_number) {
          restoredStep = 'verification';
        } else {
          restoredStep = 'waiting';
        }
      } else if (sessionData.status === 'waiting') {
        if (participant.group_number) {
          restoredStep = 'group-reveal';
        } else {
          restoredStep = 'waiting';
        }
      }

      // If stored step is 'review', keep it (user already submitted)
      if (storedStep === 'review') {
        restoredStep = 'review';
      }

      setStep(restoredStep);
      setSessionId(storedSessionId);
      
      console.log('[UserPage] Session restored successfully:', {
        sessionId: storedSessionId,
        participantId: participant.id,
        step: restoredStep,
        sessionStatus: sessionData.status,
      });
      
      toast.success('已恢復您的查經進度 Session restored!');
      setIsRestoring(false);
      return true;
    } catch (error) {
      console.error('[UserPage] Error restoring session:', error);
      setIsRestoring(false);
      return false;
    }
  }, [setCurrentSession, setCurrentUser]);

  // Initial session restoration on mount
  useEffect(() => {
    const initializeSession = async () => {
      const sessionFromUrl = searchParams.get('session_id') || searchParams.get('session');
      
      // If URL has a session ID, use that (new session join)
      if (sessionFromUrl) {
        setSessionId(sessionFromUrl);
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionFromUrl);
        await loadSessionAndCheckAuth(sessionFromUrl);
        setIsRestoring(false);
      } else if (!currentSession) {
        // Try to restore existing session
        const restored = await restoreUserSession();
        if (!restored) {
          // Check for pending session from OAuth redirect
          const pendingSession = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
          if (pendingSession) {
            setSessionId(pendingSession);
            await loadSessionAndCheckAuth(pendingSession);
          }
        }
      } else {
        setIsRestoring(false);
      }
    };

    initializeSession();
  }, [searchParams, restoreUserSession]);

  // Persist step changes to localStorage
  useEffect(() => {
    if (step !== 'landing' && step !== 'enter-session') {
      localStorage.setItem(STORAGE_KEYS.USER_STEP, step);
    }
  }, [step]);

  // Persist participant ID when user joins
  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(STORAGE_KEYS.PARTICIPANT_ID, currentUser.id);
    }
  }, [currentUser?.id]);

  const loadSessionAndCheckAuth = async (id: string) => {
    setIsLoading(true);
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions_public')
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

  const handleQRScan = async (scannedId: string) => {
    setSessionId(scannedId);
    toast.success('QR Code 掃描成功！');
    await loadSessionAndCheckAuth(scannedId);
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

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      或者 OR
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="xl"
                  className="w-full"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  掃描 QR Code
                </Button>
              </CardContent>
            </Card>
            
            <QRCodeScanner 
              open={showScanner} 
              onClose={() => setShowScanner(false)} 
              onScan={handleQRScan}
            />
          </div>
        );

      case 'join':
        return (
          <div className="px-4 py-8">
            <JoinForm onJoined={(isLatecomer) => {
              if (isLatecomer) {
                // Latecomers with assigned group go directly to verification
                setStep('verification');
              } else {
                setStep('waiting');
              }
            }} />
          </div>
        );

      case 'waiting':
        return (
          <div className="px-4 py-8">
            <WaitingRoom onGroupingStarted={() => setStep('group-reveal')} />
          </div>
        );

      case 'group-reveal':
        return <GroupReveal onContinue={() => setStep('verification')} />;

      case 'verification':
        return (
          <div className="px-4 py-8">
            <GroupVerification onAllReady={() => setStep('study')} />
          </div>
        );

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

  // Show loading while restoring session
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full gradient-gold flex items-center justify-center animate-pulse">
            <BookOpen className="w-8 h-8 text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground">正在載入您的查經進度...</p>
          <p className="text-sm text-muted-foreground">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant={step === 'landing' ? 'default' : 'compact'} />
      <main className="container mx-auto pb-8">
        {renderStep()}
      </main>
    </div>
  );
};
