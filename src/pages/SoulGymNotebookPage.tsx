import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { MyNotebook } from '@/components/user/MyNotebook';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { FeatureGate } from '@/components/ui/feature-gate';

export const SoulGymNotebookPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

  useEffect(() => {
    if (!loading && !user && !localStorage.getItem('bible_study_guest_email')) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="Soul Gym 查經筆記本" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <FeatureGate
      featureKeys={["we_live", "notebook"]}
      title="筆記本功能維護中"
      description="筆記本功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background" data-testid="soul-gym-notebook-page">
        <Header variant="compact" title="Soul Gym 查經筆記本" />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8">
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <MyNotebook userEmail={userEmail} />
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default SoulGymNotebookPage;
