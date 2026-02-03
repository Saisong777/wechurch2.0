import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/ui/feature-gate';
import { Book, Calendar, BookOpen, ArrowLeft, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface BlessingVerse {
  verseId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  blessingType: string | null;
}

const LearnPage = () => {
  const { data: randomVerse } = useQuery<BlessingVerse>({
    queryKey: ['/api/bible/blessing/random'],
    refetchOnWindowFocus: false,
  });

  const features = [
    {
      title: '聖經閱讀',
      description: '閱讀和平本聖經，搜尋經文，收藏喜愛的經節',
      icon: Book,
      href: '/learn/bible',
      color: 'bg-sky-500',
    },
    {
      title: '耶穌四季',
      description: '探索耶穌生平的208個事件，按季節分類的時間軸',
      icon: Calendar,
      href: '/learn/jesus-timeline',
      color: 'bg-amber-500',
    },
    {
      title: '讀經計劃',
      description: '選擇適合你的讀經計劃，每日靈修陪伴成長',
      icon: BookOpen,
      href: '/learn/reading-plans',
      color: 'bg-emerald-500',
    },
  ];

  return (
    <FeatureGate 
      featureKey="we_learn" 
      title="學習功能維護中"
      description="We Learn 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header title="We Learn" subtitle="學習成長" variant="compact" />
        
        <main className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="max-w-3xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-3 sm:mb-6 h-8 px-2 sm:px-3">
              <Link to="/" className="gap-1 sm:gap-2" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">返回首頁</span>
              </Link>
            </Button>

            {randomVerse && (
              <Card className="mb-3 sm:mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="py-3 sm:py-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">今日祝福經文</p>
                      <p className="text-sm sm:text-base text-foreground leading-relaxed">{randomVerse.text}</p>
                      <p className="text-xs sm:text-sm text-primary mt-1.5 sm:mt-2 font-medium">
                        {randomVerse.bookName} {randomVerse.chapter}:{randomVerse.verse}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2 sm:gap-4">
              {features.map((feature) => (
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
