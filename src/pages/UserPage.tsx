import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { JoinForm } from '@/components/user/JoinForm';
import { WaitingRoom } from '@/components/user/WaitingRoom';
import { GroupReveal } from '@/components/user/GroupReveal';
import { StudyForm } from '@/components/user/StudyForm';
import { SubmissionReview } from '@/components/user/SubmissionReview';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

type UserStep = 'landing' | 'join' | 'waiting' | 'group-reveal' | 'study' | 'review';

export const UserPage: React.FC = () => {
  const { currentUser, currentSession } = useSession();
  const [step, setStep] = useState<UserStep>('landing');

  // Watch for session status changes (simulating real-time)
  useEffect(() => {
    if (currentSession?.status === 'studying' && step === 'waiting') {
      setStep('group-reveal');
    }
  }, [currentSession?.status, step]);

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
              onClick={() => setStep('join')}
              className="min-w-64"
            >
              加入查經 Join Bible Study
            </Button>
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
            <WaitingRoom />
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
