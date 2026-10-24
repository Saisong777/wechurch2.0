import { Header } from '@/components/layout/Header';
import DiscipleQuiz from '@/components/play/DiscipleQuiz';
import { FeatureGate } from '@/components/ui/feature-gate';
import { useCastleContentPresentation } from '@/contexts/CastleContentPresentationContext';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './pavilion.css';

export const DiscipleQuizPage = () => {
  const castleContent = useCastleContentPresentation();
  return (
    <FeatureGate featureKeys={['we_play', 'disciple_quiz']} title="十二門徒人格暫未開放" description="目前無法開始測驗，請稍後再試。"><div className="min-h-screen bg-background flex flex-col">
      <Header variant="compact" backTo="/play" />
      <main className="flex-1">
        {castleContent && <div className="pavilion-return"><Link to="/play"><ArrowLeft size={18} aria-hidden="true" />返回相聚小亭</Link></div>}
        <DiscipleQuiz />
      </main>
    </div></FeatureGate>
  );
};

export default DiscipleQuizPage;
