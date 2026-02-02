import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/ui/feature-gate';

const LearnPage: React.FC = () => {
  return (
    <FeatureGate 
      featureKey="we_learn" 
      title="學習功能維護中"
      description="We Learn 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header title="We Learn" subtitle="學習成長" />
        
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            {/* Back Button */}
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回首頁
              </Link>
            </Button>

            {/* Coming Soon Card */}
            <Card className="border-2 border-dashed">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <Construction className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  即將推出
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  我們正在打造全新的學習體驗，包含聖經研讀系統與 Rejesus 整合
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                    聖經系統
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                    Rejesus 整合
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                    學習資源
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default LearnPage;
