import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const BibleQuizPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 頂部返回列 */}
      <div className="flex items-center gap-3 p-4 border-b bg-card sticky top-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/play')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="text-base font-semibold">✝️ 聖經問答 Quiz</h1>
      </div>

      {/* 遊戲 iframe */}
      <iframe
        src="/bible-quiz.html"
        className="flex-1 w-full border-0"
        style={{ minHeight: 'calc(100vh - 57px)' }}
        title="聖經問答遊戲"
        allow="autoplay; web-share"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
};

export default BibleQuizPage;
