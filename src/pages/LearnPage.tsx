import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Book, Calendar, BookOpen, BookMarked } from 'lucide-react';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

const LearnPage = () => {
  const { isFeatureEnabled } = useFeatureToggles();

  const features = [
    {
      featureKey: 'bible_reading',
      title: '聖經閱讀',
      description: '閱讀和平本聖經，搜尋經文，收藏喜愛的經節',
      icon: Book,
      href: '/learn/bible',
      color: 'bg-sky-500',
    },
    {
      featureKey: 'jesus_timeline',
      title: '耶穌四季',
      description: '探索耶穌生平的208個事件，按季節分類的時間軸',
      icon: Calendar,
      href: '/learn/jesus-timeline',
      color: 'bg-amber-500',
    },
    {
      featureKey: 'reading_plans',
      title: '讀經計劃',
      description: '選擇適合你的讀經計劃，每日靈修陪伴成長',
      icon: BookOpen,
      href: '/learn/reading-plans',
      color: 'bg-emerald-500',
    },
    {
      featureKey: 'we_learn',
      title: '我的筆記',
      description: '個人讀經筆記與查經紀錄',
      icon: BookMarked,
      href: '/learn/my-notes',
      color: 'bg-rose-500',
    },
  ];

  return (
    <FeatureGate 
      featureKey="we_learn" 
      title="學習功能維護中"
      description="讀聖經功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header title="讀聖經" subtitle="學習成長" variant="compact" />
        
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            <div className="grid gap-2 sm:gap-4">
              {features.filter(f => isFeatureEnabled(f.featureKey)).map((feature) => (
                <Link 
                  key={feature.href} 
                  to={feature.href}
                  data-testid={`link-feature-${feature.href.split('/').pop()}`}
                >
                  <Card className="hover-elevate cursor-pointer transition-all">
                    <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 py-3 sm:py-4 px-3 sm:px-6">
                      <div className={`p-2 sm:p-3 rounded-lg ${feature.color}`}>
                        <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg">{feature.title}</CardTitle>
                        <CardDescription className="mt-0.5 sm:mt-1 text-xs sm:text-sm line-clamp-2">{feature.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default LearnPage;
