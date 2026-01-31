import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, ImageIcon, ChevronRight, ArrowLeft } from 'lucide-react';
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
        <Header title="We Share" subtitle="分享代禱" />
        
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            {/* Back Button */}
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回首頁
              </Link>
            </Button>

            {/* Feature Cards */}
            <div className="grid gap-4">
              {shareFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Link key={feature.id} to={feature.href} className="block group">
                    <Card className="transition-all duration-300 border-2 hover:border-primary/30 hover:shadow-lg hover:scale-[1.01]">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center justify-between">
                              {feature.title}
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </CardTitle>
                            <CardDescription className="text-sm">
                              {feature.subtitle}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pl-[4.5rem]">
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </CardContent>
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
