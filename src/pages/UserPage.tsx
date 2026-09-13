import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getPollingInterval } from '@/lib/retry-utils';
import { useSearchParams, Link } from 'react-router-dom';
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
import { ParticipantStepGuide } from '@/components/user/ParticipantStepGuide';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Home, ArrowRight, QrCode, BookMarked, ChevronLeft, ArrowLeft } from 'lucide-react';
import { WeChurchIcon } from '@/components/icons/WeChurchLogo';
import { toast } from 'sonner';
import { isShortCode } from '@/lib/url-helpers';
import { FeatureGate } from '@/components/ui/feature-gate';
import { fetchGroupMembers } from '@/lib/api-helpers';

type UserStep = 'landing' | 'enter-session' | 'join' | 'waiting' | 'group-reveal' | 'verification' | 'icebreaker' | 'study' | 'review' | 'notebook';

const VALID_STEPS: UserStep[] = ['landing', 'enter-session', 'join', 'waiting', 'group-reveal', 'verification', 'icebreaker', 'study', 'review', 'notebook'];

// localStorage keys for session persistence
const STORAGE_KEYS = {
  SESSION_ID: 'pending_session_id',
  PARTICIPANT_ID: 'bible_study_participant_id',
  USER_STEP: 'bible_study_user_step',
};

const extractSessionIdentifier = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const sessionFromQuery = url.searchParams.get('session') || url.searchParams.get('session_id');
    if (sessionFromQuery) return sessionFromQuery.trim().toUpperCase();
  } catch {
  }

  const queryMatch = trimmed.match(/[?&](session|session_id)=([^&#]+)/i);
  if (queryMatch?.[2]) {
    return decodeURIComponent(queryMatch[2]).trim().toUpperCase();
  }

  return trimmed.toUpperCase();
};

const isParticipantGroupReady = async (sessionId: string, groupNumber?: number | null) => {
  if (!groupNumber) return false;

  try {
    const members = await fetchGroupMembers(sessionId, groupNumber);
    return members.length > 0 && members.every((member) => member.readyConfirmed);
  } catch (error) {
    console.warn('[UserPage] Failed to check group ready state:', error);
    return false;
  }
};

const fetchSessionByIdentifier = async (idOrCode: string) => {
  const trimmedInput = extractSessionIdentifier(idOrCode);
  if (!trimmedInput) return null;

  const response = isShortCode(trimmedInput)
    ? await fetch(`/api/sessions/by-code/${trimmedInput}`)
    : await fetch(`/api/sessions/${trimmedInput}`);

  if (!response.ok) return null;
  return response.json();
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
    localStorage.removeItem('user_email');

    setCurrentSession(null);
    setCurrentUser(null);
    setSessionId('');
    setShowScanner(false);
    setStep('enter-session');
  }, [setCurrentSession, setCurrentUser]);

  // Handle session ended - show notification and go to notebook
  const handleSessionEnded = useCallback(() => {
    toast.info('查經已結束', {
      description: '感謝您的參與！已為您打開筆記本',
    });
    setStep('notebook');
  }, []);

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
      // Fetch the session first using Express API
      const sessionRes = await fetch(`/api/sessions/${storedSessionId}`);
      if (!sessionRes.ok) {
        console.log('[UserPage] Session not found or expired, clearing all stored data');
        localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        setIsRestoring(false);
        return false;
      }
      const sessionData = await sessionRes.json();

      // Prefer the exact participant id. Email is only a fallback for older
      // browser sessions that were saved before participant id recovery existed.
      let participantRes = await fetch(`/api/sessions/${storedSessionId}/participants/${storedParticipantId}`);
      if (!participantRes.ok) {
        participantRes = await fetch(`/api/sessions/${storedSessionId}/participants/by-email/${encodeURIComponent(storedEmail)}`);
      }

      if (!participantRes.ok) {
        console.log('[UserPage] Participant not found for this email, may need to rejoin');
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_STEP);
        setCurrentSession({
          id: sessionData.id,
          bibleVerse: '',
          verseReference: sessionData.verseReference,
          status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
          createdAt: new Date(sessionData.createdAt),
          groups: [],
          allowLatecomers: sessionData.allowLatecomers || false,
        });
        setSessionId(storedSessionId);
        setStep('join');
        setIsRestoring(false);
        return true;
      }

      const participant = await participantRes.json();
      console.log('[UserPage] Verified participant via API, restoring session');
      localStorage.setItem(STORAGE_KEYS.PARTICIPANT_ID, participant.id);
      localStorage.setItem('user_email', storedEmail);

      // Restore session state
      setCurrentSession({
        id: sessionData.id,
        bibleVerse: '',
        verseReference: sessionData.verseReference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.createdAt),
        groups: [],
        allowLatecomers: sessionData.allowLatecomers || false,
        icebreakerEnabled: sessionData.icebreakerEnabled || false,
        icebreakerLevel: (sessionData.icebreakerLevel as 'L1' | 'L2' | 'L3') || 'L1',
      });

      // Restore user state
      setCurrentUser({
        id: participant.id,
        name: participant.name,
        email: storedEmail,
        gender: participant.gender as 'male' | 'female',
        groupNumber: participant.groupNumber || undefined,
        joinedAt: new Date(participant.joinedAt),
        location: participant.location,
        readyConfirmed: participant.readyConfirmed,
      });

      // Determine the correct step based on session status and user state
      let restoredStep: UserStep = 'waiting';

      if (sessionData.status === 'studying') {
        // Check if icebreaker is enabled and user hasn't completed it yet
        if (sessionData.icebreakerEnabled && participant.groupNumber) {
          // Check localStorage if user already completed icebreaker
          const completedIcebreaker = localStorage.getItem(`icebreaker_completed_${storedSessionId}_${participant.id}`);
          restoredStep = completedIcebreaker ? 'study' : 'icebreaker';
        } else {
          restoredStep = 'study';
        }
      } else if (sessionData.status === 'grouping') {
        if (participant.groupNumber) {
          const groupReady = await isParticipantGroupReady(storedSessionId, participant.groupNumber);
          if (groupReady && sessionData.icebreakerEnabled) {
            const completedIcebreaker = localStorage.getItem(`icebreaker_completed_${storedSessionId}_${participant.id}`);
            restoredStep = completedIcebreaker ? 'study' : 'icebreaker';
          } else if (groupReady) {
            restoredStep = 'study';
          } else {
            restoredStep = 'verification';
          }
        } else {
          restoredStep = 'waiting';
        }
      } else if (sessionData.status === 'waiting') {
        if (participant.groupNumber) {
          restoredStep = 'group-reveal';
        } else {
          restoredStep = 'waiting';
        }
      } else if (sessionData.status === 'completed') {
        restoredStep = storedStep === 'review' ? 'review' : 'notebook';
        toast.info('查經已結束', {
          description: '感謝您的參與！已為您打開筆記本',
        });
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
        const incomingSession = await fetchSessionByIdentifier(sessionFromUrl);
        const storedSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
        const storedParticipantId = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID);
        const storedEmail = localStorage.getItem('bible_study_guest_email');

        if (incomingSession?.id && storedSessionId === incomingSession.id && storedParticipantId && storedEmail) {
          const restored = await restoreUserSession();
          if (!restored) {
            setSessionId(sessionFromUrl);
            await loadSessionAndCheckAuth(sessionFromUrl);
          }
        } else {
          setSessionId(sessionFromUrl);
          await loadSessionAndCheckAuth(sessionFromUrl);
        }
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

    const trimmedInput = extractSessionIdentifier(idOrCode);

    try {
      const sessionData = await fetchSessionByIdentifier(trimmedInput);
      if (!sessionData) {
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
        verseReference: sessionData.verseReference,
        status: sessionData.status as 'waiting' | 'grouping' | 'studying' | 'completed',
        createdAt: new Date(sessionData.createdAt),
        groups: [],
        icebreakerEnabled: sessionData.icebreakerEnabled || false,
        icebreakerLevel: (sessionData.icebreakerLevel as 'L1' | 'L2' | 'L3') || 'L1',
      });

      setIsLoading(false);
      setStep('join');
    } catch (error) {
      console.error('[UserPage] Error loading session:', error);
      toast.error('載入課程失敗，請稍後再試');
      setIsLoading(false);
      setStep('enter-session');
    }
  };

  // Watch for user group number changes (real-time grouping)
  useEffect(() => {
    if (currentUser?.groupNumber && step === 'waiting') {
      setStep('group-reveal');
    }
  }, [currentUser?.groupNumber, step]);

  // Recovery guard: if a mobile browser refreshed exactly during grouping, it
  // may land on group-reveal before the assigned group has been hydrated.
  useEffect(() => {
    if (step !== 'group-reveal' || !currentSession?.id || !currentUser?.id || currentUser.groupNumber) return;

    let cancelled = false;
    const userSnapshot = currentUser;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${currentSession.id}/participants/${userSnapshot.id}`);
        if (!res.ok || cancelled) return;

        const participant = await res.json();
        if (participant.groupNumber) {
          setCurrentUser({
            ...userSnapshot,
            ...participant,
            email: userSnapshot.email,
            groupNumber: participant.groupNumber || undefined,
            joinedAt: new Date(participant.joinedAt),
          });
        } else if (currentSession.status === 'grouping') {
          setStep('waiting');
        }
      } catch {
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [step, currentSession?.id, currentSession?.status, currentUser?.id, currentUser?.groupNumber, setCurrentUser]);

  // Lightweight session status poller for steps that don't have their own
  // realtime hooks (group-reveal, icebreaker, study). This ensures the user
  // detects re-grouping even when their current component doesn't poll.
  useEffect(() => {
    const stepsWithoutPolling = ['group-reveal', 'icebreaker', 'study'];
    if (!currentSession?.id || !stepsWithoutPolling.includes(step)) return;

    const pollSessionStatus = async () => {
      try {
        const res = await fetch(`/api/sessions/${currentSession.id}`);
        if (res.ok) {
          const session = await res.json();
          if (session.status !== currentSession.status) {
            setCurrentSession({ ...currentSession, status: session.status });
          }
        }
      } catch {
      }
    };

    const interval = setInterval(pollSessionStatus, getPollingInterval(5000));
    return () => clearInterval(interval);
  }, [currentSession?.id, currentSession?.status, step]);

  // Watch for session status going back to 'waiting' (admin re-grouped)
  // This handles the case where the user is at a later step but the admin
  // cleared groups and reset the session to 'waiting'.
  const prevSessionStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = currentSession?.status;
    const prevStatus = prevSessionStatusRef.current;
    prevSessionStatusRef.current = currentStatus || null;

    if (!currentStatus || !prevStatus) return;

    if (
      currentStatus === 'waiting' &&
      prevStatus !== 'waiting' &&
      ['group-reveal', 'verification', 'icebreaker', 'study'].includes(step)
    ) {
      console.log('[UserPage] Re-grouping detected: session went back to waiting, resetting user step');
      setCurrentUser(currentUser ? { ...currentUser, groupNumber: undefined, readyConfirmed: false } : null);
      setStep('waiting');
      toast.info('帶領者已重新分組', {
        description: '請稍候，即將進行新的分組',
      });
    }
  }, [currentSession?.status, step]);

  const handleEnterSession = async () => {
    if (!sessionId.trim()) {
      toast.error('請輸入活動代碼或貼上查經連結');
      return;
    }
    await loadSessionAndCheckAuth(sessionId);
  };

  const handleQRScan = async (scannedId: string) => {
    const parsedId = extractSessionIdentifier(scannedId);
    setSessionId(parsedId);
    toast.success('QR Code 掃描成功！');
    await loadSessionAndCheckAuth(parsedId);
  };

  const renderWithGuide = (
    guideStep: Exclude<UserStep, 'landing' | 'notebook'>,
    content: React.ReactNode,
    className = 'px-3 sm:px-4 py-4 sm:py-8'
  ) => (
    <div className={className}>
      <ParticipantStepGuide
        currentStep={guideStep}
        icebreakerEnabled={currentSession?.icebreakerEnabled ?? true}
      />
      {content}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'landing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-32 h-32 rounded-full gradient-sky flex items-center justify-center shadow-xl animate-float">
                <WeChurchIcon size={64} className="drop-shadow-lg" />
              </div>
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground text-center mb-4">
              WeChurch
            </h1>
            <p className="text-lg text-primary text-center mb-2 font-medium">
              我們就是教會
            </p>
            <p className="text-muted-foreground text-center max-w-md mb-12">
              一起學習、彼此交流的網路之家
            </p>

            <Button
              variant="default"
              size="xl"
              onClick={() => setStep('enter-session')}
              className="min-w-64 gradient-sky hover:opacity-90 text-white shadow-lg"
            >
              加入課程 Join Session
            </Button>
          </div>
        );

      case 'enter-session':
        const storedEmail = localStorage.getItem('bible_study_guest_email');
        return renderWithGuide('enter-session', (
          <div className="w-full max-w-md md:max-w-lg mx-auto animate-fade-in">
            {/* Back to Home Button */}
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回首頁
              </Link>
            </Button>

            <Card variant="highlight" className="border-2 border-primary/20">
              <CardHeader className="text-center px-4 sm:px-6 pt-8 sm:pt-8 pb-4">
                <div className="mx-auto w-20 h-20 sm:w-16 sm:h-16 rounded-full gradient-sky flex items-center justify-center mb-5 sm:mb-4 shadow-lg">
                  <WeChurchIcon size={40} className="drop-shadow-md" />
                </div>
                <CardTitle className="text-2xl sm:text-2xl font-display">輸入活動代碼</CardTitle>
                <CardDescription className="text-base sm:text-base mt-2">
                  輸入帶領者提供的 4 碼代碼
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6 pb-8 sm:pb-8">
                <div className="space-y-3">
                  <Label htmlFor="sessionId" className="text-base sm:text-sm font-medium">
                    活動代碼 Session Code
                  </Label>
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(extractSessionIdentifier(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && sessionId.trim() && !isLoading) {
                        void handleEnterSession();
                      }
                    }}
                    placeholder="AB12 或貼上連結"
                    className="h-16 sm:h-14 text-xl sm:text-lg font-mono text-center uppercase"
                    maxLength={120}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    enterKeyHint="go"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    也可以直接貼上帶領者分享的查經連結
                  </p>
                </div>

                <Button
                  variant="default"
                  size="xl"
                  className="w-full h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98] gradient-sky hover:opacity-90 text-white shadow-md"
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
        ), 'px-3 sm:px-4 md:px-6 py-6 sm:py-8');

      case 'notebook':
        const notebookEmail = localStorage.getItem('bible_study_guest_email') || '';
        return (
          <div className="w-full max-w-2xl md:max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 animate-fade-in">
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
        return renderWithGuide('join', (
          <JoinForm onJoined={(isLatecomer) => {
            if (isLatecomer) {
              setStep('verification');
            } else {
              setStep('waiting');
            }
          }} />
        ));

      case 'waiting':
        return renderWithGuide('waiting', (
          <WaitingRoom
            onGroupingStarted={() => setStep('group-reveal')}
            onSessionEnded={handleSessionEnded}
          />
        ));

      case 'group-reveal':
        return renderWithGuide('group-reveal', (
          <GroupReveal onContinue={() => setStep('verification')} />
        ));

      case 'verification':
        return renderWithGuide('verification', (
          <GroupVerification
            onAllReady={() => {
              // Check if icebreaker is enabled for this session
              if (currentSession?.icebreakerEnabled && currentUser?.groupNumber) {
                setStep('icebreaker');
              } else {
                setStep('study');
              }
            }}
            onSessionEnded={handleSessionEnded}
          />
        ));

      case 'icebreaker':
        if (!currentSession?.id || !currentUser?.groupNumber || !currentUser?.id) {
          setStep('study');
          return null;
        }
        return renderWithGuide('icebreaker', (
          <GroupIcebreaker
            sessionId={currentSession.id}
            groupNumber={currentUser.groupNumber}
            currentUserId={currentUser.id}
            initialLevel={currentSession.icebreakerLevel || 'L1'}
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
        ));

      case 'study':
        return renderWithGuide('study', (
          <SpiritualFitnessForm onSubmitted={() => setStep('review')} />
        ), 'px-2 sm:px-4 py-3 sm:py-8');

      case 'review':
        return renderWithGuide('review', (
          <SubmissionReview onEdit={() => setStep('study')} />
        ));

      default:
        // Safety net: if step is corrupted (e.g., multiple test accounts on same device),
        // show a recoverable UI instead of a blank screen.
        return (
          <div className="w-full max-w-md md:max-w-lg mx-auto px-3 sm:px-4 md:px-6 py-10 animate-fade-in">
            <Card variant="highlight" className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">畫面狀態已失效</CardTitle>
                <CardDescription className="text-base mt-1">
                  可能是同一台裝置切換多個帳號測試造成狀態不一致。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  請點擊下方按鈕重置後重新輸入活動代碼。
                </p>
                <Button variant="gold" size="xl" className="w-full" onClick={resetLocalState}>
                  重置並重新加入
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep('enter-session')}>
                  返回輸入活動代碼
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
          <div className="w-16 h-16 mx-auto rounded-full gradient-sky flex items-center justify-center animate-pulse shadow-lg">
            <WeChurchIcon size={32} />
          </div>
          <p className="text-muted-foreground">正在載入您的課程進度...</p>
          <p className="text-sm text-muted-foreground">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate
      featureKeys={["we_live", "bible_study"]}
      title="靈魂健身房維護中"
      description="Soul Gym 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header variant={step === 'landing' ? 'default' : 'compact'} backTo="/user" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 pb-8">
          {renderStep()}
        </main>
      </div>
    </FeatureGate>
  );
};
