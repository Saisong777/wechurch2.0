import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { CreateSession } from '@/components/admin/CreateSession';
import { AdminWaitingRoom } from '@/components/admin/AdminWaitingRoom';
import { AdminMonitor } from '@/components/admin/AdminMonitor';
import { Button } from '@/components/ui/button';
import { Settings, Users, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type AdminStep = 'create' | 'waiting' | 'monitor';

export const AdminPage: React.FC = () => {
  const [step, setStep] = useState<AdminStep>('create');

  const renderStep = () => {
    switch (step) {
      case 'create':
        return <CreateSession onCreated={() => setStep('waiting')} />;
      case 'waiting':
        return <AdminWaitingRoom onGroupingComplete={() => setStep('monitor')} />;
      case 'monitor':
        return <AdminMonitor />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-navy text-primary-foreground py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
                <ChevronLeft className="w-4 h-4" />
                返回
              </Button>
            </Link>
            <span className="text-sm opacity-80">管理後台 Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
          </div>
        </div>
      </div>

      <Header 
        variant="compact" 
        title="查經管理後台"
        subtitle=""
      />

      <main className="container mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['create', 'waiting', 'monitor'] as AdminStep[]).map((s, index) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === s
                    ? 'gradient-gold text-secondary-foreground glow-gold'
                    : index < ['create', 'waiting', 'monitor'].indexOf(step)
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              {index < 2 && (
                <div
                  className={`w-12 h-1 rounded ${
                    index < ['create', 'waiting', 'monitor'].indexOf(step)
                      ? 'bg-accent'
                      : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {renderStep()}
      </main>
    </div>
  );
};
