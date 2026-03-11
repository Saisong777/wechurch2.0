import { Header } from '@/components/layout/Header';
import DiscipleQuiz from '@/components/play/DiscipleQuiz';

export const DiscipleQuizPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header variant="compact" backTo="/play" />
      <main className="flex-1">
        <DiscipleQuiz />
      </main>
    </div>
  );
};

export default DiscipleQuizPage;
