import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Shuffle, ChevronRight } from 'lucide-react';

const features = [
  {
    id: 'icebreaker',
    title: '真心話不用冒險',
    subtitle: '破冰互動卡牌遊戲',
    icon: Gamepad2,
    href: '/icebreaker',
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-400/40',
    featureKeys: ['we_play', 'icebreaker_game'] as string[],
  },
  {
    id: 'grouper',
    title: '只能說是神的安排',
    subtitle: '隨機分組工具',
    icon: Shuffle,
    href: '/grouper',
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
    hoverBorder: 'hover:border-amber-400/40',
    featureKeys: ['we_play', 'random_grouper'] as string[],
  },
];

export const WePlayPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 mb-3">
              <Gamepad2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">We Play</h1>
            <p className="text-sm text-muted-foreground mt-1">互動遊戲與分組工具</p>
          </div>

          <div className="grid gap-3 md:gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.id} to={feature.href} className="block" data-testid={`link-feature-${feature.id}`}>
                  <Card className={`transition-all duration-300 border ${feature.hoverBorder} hover:shadow-md cursor-pointer`}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-foreground" data-testid={`text-feature-title-${feature.id}`}>
                            {feature.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
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
  );
};

export default WePlayPage;
