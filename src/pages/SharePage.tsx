import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, ImageIcon, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/ui/feature-gate';

const shareFeatures = [
  {
    id: 'prayer',
    title: '禱告牆',
    subtitle: 'Prayer Wall',
    description: '分享代禱事項，一起為彼此禱告',
    icon: Heart,
    href: '/prayer-wall',
    color: 'from-rose-500 to-pink-600',
    bgColor: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
  },
  {
    id: 'prayer-meeting',
    title: '禱告會',
    subtitle: 'Prayer Meeting',
    description: '分組禱告，彼此代禱',
    icon: Sparkles,
    href: '/prayer-meeting',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
  },
  {
    id: 'card',
    title: '信息圖卡',
    subtitle: 'Message Cards',
    description: '下載本週信息摘要圖片',
    icon: ImageIcon,
    href: '/card',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-600',
  },
];

const SharePage: React.FC = () => {
  return (
    <FeatureGate 
      featureKey="we_share" 
      title="分享功能維護中"
      description="We Share 功能目前暫時關閉，請稍後再試"
    >
      <div className="min-h-screen bg-background">
        <Header title="We Share" subtitle="分享代禱" variant="compact" />
        
        <main className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="max-w-2xl mx-auto">
            {/* Feature Cards */}
            <div className="grid gap-3 sm:gap-4">
              {shareFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Link key={feature.id} to={feature.href} className="block group">
                    <Card className="transition-all duration-300 border hover:border-primary/30 hover:shadow-md hover-elevate">
                      <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${feature.bgColor} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                            <Icon className={`w-5 h-5 sm:w-7 sm:h-7 ${feature.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg flex items-center justify-between gap-2">
                              <span className="truncate">{feature.title}</span>
                              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm line-clamp-1">
                              {feature.subtitle}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </FeatureGate>
  );
};

export default SharePage;
