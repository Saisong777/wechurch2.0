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
        <Header title="We Learn" subtitle="學習成長" />
        
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-2" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4" />
                返回首頁
              </Link>
            </Button>

            {randomVerse && (
              <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">今日祝福經文</p>
                      <p className="text-foreground leading-relaxed">{randomVerse.text}</p>
                      <p className="text-sm text-primary mt-2 font-medium">
                        {randomVerse.bookName} {randomVerse.chapter}:{randomVerse.verse}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {features.map((feature) => (
                <Link 
                  key={feature.href} 
                  to={feature.href}
                  data-testid={`link-feature-${feature.href.split('/').pop()}`}
                >
                  <Card className="hover-elevate cursor-pointer transition-all">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className={`p-3 rounded-lg ${feature.color}`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                        <CardDescription className="mt-1">{feature.description}</CardDescription>
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
