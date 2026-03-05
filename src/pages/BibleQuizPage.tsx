import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';

export const BibleQuizPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header variant="compact" backTo="/play" />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 pb-4 pt-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">✝️ 聖經問答 Quiz</h1>
      </div>

      {/* 遊戲 iframe */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 flex-1 flex flex-col">
        <div className="w-full flex-1 rounded-2xl overflow-hidden border bg-card shadow-sm">
          <iframe
            src="/bible-quiz.html"
            className="w-full h-full border-0"
            style={{ minHeight: 'calc(100vh - 180px)' }}
            title="聖經問答遊戲"
            allow="autoplay; web-share"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </main>
    </div>
  );
};

export default BibleQuizPage;
