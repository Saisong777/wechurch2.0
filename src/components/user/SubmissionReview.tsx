import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/contexts/SessionContext';
import { CheckCircle, BookOpen, Heart, Sparkles, Lightbulb, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SubmissionReview: React.FC = () => {
  const { currentUser, currentSession, submissions } = useSession();

  const mySubmission = submissions.find(s => s.userId === currentUser?.id);

  if (!mySubmission) {
    return null;
  }

  const fields = [
    { key: 'theme', label: '主題', icon: BookOpen },
    { key: 'movingVerse', label: '最感動的經文', icon: Heart },
    { key: 'factsDiscovered', label: '發現的事實', icon: Sparkles },
    { key: 'traditionalExegesis', label: '傳統解經', icon: BookOpen },
    { key: 'inspirationFromGod', label: '神的啟示', icon: Lightbulb },
    { key: 'applicationInLife', label: '生活應用', icon: CheckCircle },
    { key: 'others', label: '其他', icon: Sparkles },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Card variant="highlight" className="text-center">
        <CardContent className="py-8">
          <div className="w-16 h-16 rounded-full gradient-gold mx-auto mb-4 flex items-center justify-center glow-gold">
            <CheckCircle className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            提交成功！
          </h2>
          <p className="text-muted-foreground mt-2">
            Your study notes have been submitted successfully
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">您的查經筆記</CardTitle>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              分享
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{currentSession?.verseReference}</span>
            {' · '}
            <span>第 {currentUser?.groupNumber} 組</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map(({ key, label, icon: Icon }) => {
            const value = mySubmission[key as keyof typeof mySubmission];
            if (!value || typeof value !== 'string') return null;
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-foreground pl-6">{value}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
