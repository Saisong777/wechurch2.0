import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { JoinForm } from '@/components/user/JoinForm';
import { WaitingRoom } from '@/components/user/WaitingRoom';
import { GroupReveal } from '@/components/user/GroupReveal';
import { GroupVerification } from '@/components/user/GroupVerification';
import { GroupIcebreaker } from '@/components/user/GroupIcebreaker';
import { SpiritualFitnessForm } from '@/components/user/SpiritualFitnessForm';
import { SubmissionReview } from '@/components/user/SubmissionReview';
import { QRCodeScanner } from '@/components/user/QRCodeScanner';
import { MyNotebook } from '@/components/user/MyNotebook';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dumbbell, ArrowRight, QrCode, BookMarked, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isShortCode } from '@/lib/url-helpers';

type UserStep = 'landing' | 'enter-session' | 'join' | 'waiting' | 'group-reveal' | 'verification' | 'icebreaker' | 'study' | 'review' | 'notebook';

const VALID_STEPS: UserStep[] = ['landing', 'enter-session', 'join', 'waiting', 'group-reveal', 'verification', 'icebreaker', 'study', 'review', 'notebook'];

// localStorage keys for session persistence
const STORAGE_KEYS = {
  SESSION_ID: 'pending_session_id',
  PARTICIPANT_ID: 'bible_study_participant_id',
  USER_STEP: 'bible_study_user_step',
};

export const UserPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, currentSession, setCurrentSession, setCurrentUser } = useSession();
  const [step, setStep] = useState<UserStep>('enter-session');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  const resetLocalState = useCallback(() => {
    // Clear only the keys we own to avoid nuking unrelated app storage.
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_STEP);
    localStorage.removeItem('pending_session_id');
    // Guest profile fields
    localStorage.removeItem('bible_study_guest_name');
    localStorage.removeItem('bible_study_guest_email');
    localStorage.removeItem('bible_study_guest_gender');
    localStorage.removeItem('bible_study_guest_location');

    setCurrentSession(null);
    setCurrentUser(null);
    setSessionId('');
    setShowScanner(false);
    setStep('enter-session');
  }, [setCurrentSession, setCurrentUser]);

  // Restore user session on page load/refresh
  const restoreUserSession = useCallback(async () => {
    const storedSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const storedParticipantId = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID);
    const rawStoredStep = localStorage.getItem(STORAGE_KEYS.USER_STEP);
    const storedStep = (rawStoredStep && (VALID_STEPS as string[]).includes(rawStoredStep))
      ? (rawStoredStep as UserStep)
      : null;
    const storedEmail = localStorage.getItem('bible_study_guest_email');

    console.log('[UserPage] Attempting session restore:', {
      storedSessionId,
      storedParticipantId,
      storedStep,
      storedEmail: storedEmail ? '***' : null,
    });

    // If no session or participant info stored, nothing to restore
    if (!storedSessionId || !storedParticipantId || !storedEmail) {
      console.log('[UserPage] Missing required data for restore');
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
        console.log('[UserPage] Session not found or expired, clearing all stored data');
        // Clear all session-related data since the session no longer exists
        localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        setIsRestoring(false);
        return false;
      }

      // Try to get the participant data using the RPC function
      // This RPC function is SECURITY DEFINER and doesn't require auth
      const { data: participantData, error: participantError } = await supabase.rpc('get_participant_for_reentry', {
        p_session_id: storedSessionId,
        p_email: storedEmail,
      });

      if (participantError) {
        console.error('[UserPage] RPC error:', participantError);
        setIsRestoring(false);
        return false;
      }

      if (!participantData || participantData.length === 0) {
        console.log('[UserPage] Participant not found for this email, may need to rejoin');
        // Clear participant data but keep session ID so user can rejoin the same session
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        // Keep SESSION_ID so user can rejoin - set session context and go to join step
        setCurrentSession({
          id: sessionData.id,
          bibleVerse: '',
          verseReference: sessionData.verse_reference,
          status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
          createdAt: new Date(sessionData.created_at),
          groups: [],
          allowLatecomers: sessionData.allow_latecomers || false,
        });
        setSessionId(storedSessionId);
        setStep('join');
        setIsRestoring(false);
        return true; // Return true since we're handling the redirect
      }

      const participant = participantData[0];

      // Note: Guest users don't need an auth session - the edge functions (save-study-response, 
      // get-study-response) use service role to bypass RLS. The RPC get_participant_for_reentry
      // is SECURITY DEFINER and also works without auth.
      console.log('[UserPage] Verified participant via RPC, restoring session');

      // Restore session state
      setCurrentSession({
        id: sessionData.id,
        bibleVerse: '',
        verseReference: sessionData.verse_reference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.created_at),
        groups: [],
        allowLatecomers: sessionData.allow_latecomers || false,
        icebreakerEnabled: sessionData.icebreaker_enabled || false,
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
        // Check if icebreaker is enabled and user hasn't completed it yet
        if (sessionData.icebreaker_enabled && participant.group_number) {
          // Check localStorage if user already completed icebreaker
          const completedIcebreaker = localStorage.getItem(`icebreaker_completed_${storedSessionId}_${participant.id}`);
          restoredStep = completedIcebreaker ? 'study' : 'icebreaker';
        } else {
          restoredStep = 'study';
        }
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
      
      // Silent restoration - no toast to avoid notification spam during transitions
      console.log('[UserPage] Session restored successfully (silent)');
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
      // Support both ?session= (new short code) and ?session_id= (legacy UUID)
      const sessionFromUrl = searchParams.get('session') || searchParams.get('session_id');
      const stepFromUrl = searchParams.get('step');
      
      // If URL has step=notebook, go directly to notebook
      if (stepFromUrl === 'notebook') {
        setStep('notebook');
        setIsRestoring(false);
        return;
      }
      
      // If URL has a session code/ID, use that (new session join)
      if (sessionFromUrl) {
        setSessionId(sessionFromUrl);
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

  const loadSessionAndCheckAuth = async (idOrCode: string) => {
    setIsLoading(true);
    
    const trimmedInput = idOrCode.trim().toUpperCase();
    
    // Determine if input is a short code or UUID
    let sessionData;
    let sessionError;
    
    if (isShortCode(trimmedInput)) {
      // Query by short_code
      const result = await supabase
        .from('sessions_public')
        .select('*')
        .eq('short_code', trimmedInput)
        .maybeSingle();
      sessionData = result.data;
      sessionError = result.error;
    } else {
      // Query by UUID (for backwards compatibility and QR code deep links)
      const result = await supabase
        .from('sessions_public')
        .select('*')
        .eq('id', trimmedInput)
        .maybeSingle();
      sessionData = result.data;
      sessionError = result.error;
    }

    if (sessionError || !sessionData) {
      toast.error('找不到此課程，請確認代碼是否正確');
      setIsLoading(false);
      setStep('enter-session');
      return;
    }

    // Store the actual session UUID for internal use
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionData.id);

    setCurrentSession({
      id: sessionData.id,
      bibleVerse: '',
      verseReference: sessionData.verse_reference,
      status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
      createdAt: new Date(sessionData.created_at),
      groups: [],
      icebreakerEnabled: sessionData.icebreaker_enabled || false,
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
      toast.error('請輸入課程代碼');
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
                <Dumbbell className="w-16 h-16 text-secondary-foreground" />
              </div>
            </div>
            
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground text-center mb-4">
              靈魂健身房
            </h1>
            <p className="text-lg text-muted-foreground text-center mb-2">
              Soul Gym
            </p>
            <p className="text-muted-foreground text-center max-w-md mb-12">
              一起，活出耶穌的豐盛生命
            </p>

            <Button
              variant="gold"
              size="xl"
              onClick={() => setStep('enter-session')}
              className="min-w-64"
            >
              開始健身 Join Session
            </Button>
          </div>
        );

      case 'enter-session':
        const storedEmail = localStorage.getItem('bible_study_guest_email');
        return (
          <div className="w-full max-w-md mx-auto px-4 sm:px-4 py-6 sm:py-8 animate-fade-in">
            <Card variant="highlight" className="border-2">
              <CardHeader className="text-center px-4 sm:px-6 pt-8 sm:pt-8 pb-4">
                <div className="mx-auto w-20 h-20 sm:w-16 sm:h-16 rounded-full gradient-gold flex items-center justify-center mb-5 sm:mb-4 glow-gold">
                  <Dumbbell className="w-10 h-10 sm:w-8 sm:h-8 text-secondary-foreground" />
                </div>
                <CardTitle className="text-2xl sm:text-2xl">輸入課程代碼</CardTitle>
                <CardDescription className="text-base sm:text-base mt-2">
                  Enter 4-digit code from your coach
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6 pb-8 sm:pb-8">
                <div className="space-y-3">
                  <Label htmlFor="sessionId" className="text-base sm:text-sm font-medium">
                    課程代碼 Session Code
                  </Label>
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                    placeholder="例如: AB12"
                    className="h-16 sm:h-14 text-2xl sm:text-xl font-mono text-center tracking-[0.3em] uppercase"
                    maxLength={4}
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    輸入教練提供的 4 碼代碼
                  </p>
                </div>

                <Button
                  variant="gold"
                  size="xl"
                  className="w-full h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98]"
                  onClick={handleEnterSession}
                  disabled={isLoading || !sessionId.trim()}
                >
                  {isLoading ? '驗證中...' : (
                    <>
                      繼續 Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">
                      或者 OR
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="xl"
                  className="w-full h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98]"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode className="w-6 h-6 sm:w-5 sm:h-5 mr-2" />
                  掃描 QR Code
                </Button>

                {/* My Notebook Button - only show if user has previously joined */}
                {storedEmail && (
                  <>
                    <Separator />
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full h-12 text-base"
                      onClick={() => setStep('notebook')}
                    >
                      <BookMarked className="w-5 h-5 mr-2" />
                      我的筆記本 My Notebook
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            
            <QRCodeScanner 
              open={showScanner} 
              onClose={() => setShowScanner(false)} 
              onScan={handleQRScan}
            />
          </div>
        );

      case 'notebook':
        const notebookEmail = localStorage.getItem('bible_study_guest_email') || '';
        return (
          <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-8 animate-fade-in">
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('enter-session')}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                返回
              </Button>
            </div>
            <MyNotebook userEmail={notebookEmail} />
          </div>
        );

      case 'join':
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <JoinForm onJoined={(isLatecomer) => {
              if (isLatecomer) {
                setStep('verification');
              } else {
                setStep('waiting');
              }
            }} />
          </div>
        );

      case 'waiting':
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <WaitingRoom onGroupingStarted={() => setStep('group-reveal')} />
          </div>
        );

      case 'group-reveal':
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <GroupReveal onContinue={() => setStep('verification')} />
          </div>
        );

      case 'verification':
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <GroupVerification onAllReady={() => {
              // Check if icebreaker is enabled for this session
              if (currentSession?.icebreakerEnabled && currentUser?.groupNumber) {
                setStep('icebreaker');
              } else {
                setStep('study');
              }
            }} />
          </div>
        );

      case 'icebreaker':
        if (!currentSession?.id || !currentUser?.groupNumber || !currentUser?.id) {
          setStep('study');
          return null;
        }
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <GroupIcebreaker 
              sessionId={currentSession.id}
              groupNumber={currentUser.groupNumber}
              currentUserId={currentUser.id}
              onComplete={() => {
                // Mark icebreaker as completed in localStorage
                localStorage.setItem(`icebreaker_completed_${currentSession.id}_${currentUser.id}`, 'true');
                setStep('study');
              }}
              onSkip={() => {
                // Mark icebreaker as completed even when skipped
                localStorage.setItem(`icebreaker_completed_${currentSession.id}_${currentUser.id}`, 'true');
                setStep('study');
              }}
            />
          </div>
        );

      case 'study':
        return (
          <div className="px-2 sm:px-4 py-3 sm:py-8">
            <SpiritualFitnessForm onSubmitted={() => setStep('review')} />
          </div>
        );

      case 'review':
        return (
          <div className="px-3 sm:px-4 py-4 sm:py-8">
            <SubmissionReview onEdit={() => setStep('study')} />
          </div>
        );

      default:
        // Safety net: if step is corrupted (e.g., multiple test accounts on same device),
        // show a recoverable UI instead of a blank screen.
        return (
          <div className="w-full max-w-md mx-auto px-4 py-10 animate-fade-in">
            <Card variant="highlight" className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">畫面狀態已失效</CardTitle>
                <CardDescription className="text-base mt-1">
                  可能是同一台裝置切換多個帳號測試造成狀態不一致。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  請點擊下方按鈕重置後重新輸入課程代碼。
                </p>
                <Button variant="gold" size="xl" className="w-full" onClick={resetLocalState}>
                  重置並重新加入
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep('enter-session')}>
                  返回輸入課程代碼
                </Button>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  // Show loading while restoring session
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full gradient-gold flex items-center justify-center animate-pulse">
            <Dumbbell className="w-8 h-8 text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground">正在載入您的課程進度...</p>
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
