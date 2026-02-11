import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Dumbbell, BookMarked, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FeatureGate } from '@/components/ui/feature-gate';

const features = [
  {
    id: 'study',
    title: 'Soul Gym 共同查經',
    subtitle: '加入查經課程，與弟兄姊妹一起學習',
    icon: Dumbbell,
    href: '/user/study',
    bgColor: 'bg-primary/15',
    iconColor: 'text-primary',
  },
  {
    id: 'notebook',
    title: 'Soul Gym 查經筆記本',
    subtitle: '個人查經紀錄與小組彙整',
    icon: BookMarked,
    href: '/user/notebook',
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
  },
];

export const WeLiveLandingPage = () => {
  return (
    <FeatureGate
      featureKeys={["we_live"]}
      title="靈魂健身房維護中"
      description="Soul Gym 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
        <Header title="Soul Gym" subtitle="靈魂健身房" variant="compact" />
        <div className="container mx-auto px-4 py-6 md:py-10">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6 md:mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-3">
                <Dumbbell className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Soul Gym</h1>
              <p className="text-sm text-muted-foreground mt-1">靈魂健身房</p>
            </div>

            <div className="grid gap-3 md:gap-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Link key={feature.id} to={feature.href} className="block" data-testid={`link-feature-${feature.id}`}>
                    <Card className="hover-elevate active-elevate-2 cursor-pointer">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground" data-testid={`text-feature-title-${feature.id}`}>
                              {feature.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5" data-testid={`text-feature-subtitle-${feature.id}`}>
                              {feature.subtitle}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
};

export default WeLiveLandingPage;
