import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { MyNotebook } from '@/components/user/MyNotebook';
import { Loader2 } from 'lucide-react';

const NotebookPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Get user's email - from auth or localStorage fallback
  const userEmail = user?.email || localStorage.getItem('bible_study_guest_email') || '';

  // Redirect to login if not authenticated - do NOT store redirect to prevent loop
  useEffect(() => {
    if (!loading && !user) {
      // Clear any existing redirect to ensure clean state
      localStorage.removeItem('login_redirect');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  // Logged in - show notebook
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <MyNotebook userEmail={userEmail} />
        </div>
      </main>
    </div>
  );
};

export default NotebookPage;
