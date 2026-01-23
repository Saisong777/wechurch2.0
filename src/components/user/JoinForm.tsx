import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSession } from '@/contexts/SessionContext';
import { joinSession } from '@/lib/supabase-helpers';
import { Users, Mail, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface JoinFormProps {
  onJoined: () => void;
}

export const JoinForm: React.FC<JoinFormProps> = ({ onJoined }) => {
  const { currentSession, setCurrentUser, addUser } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved info from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('bible_study_guest_name');
    const savedEmail = localStorage.getItem('bible_study_guest_email');
    const savedGender = localStorage.getItem('bible_study_guest_gender');
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedGender === 'male' || savedGender === 'female') setGender(savedGender);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSession?.id) {
      toast.error('請先輸入有效的 Session ID');
      return;
    }
    
    setIsLoading(true);

    // Save to localStorage for next time
    localStorage.setItem('bible_study_guest_name', name);
    localStorage.setItem('bible_study_guest_email', email);
    localStorage.setItem('bible_study_guest_gender', gender);

    const user = await joinSession(currentSession.id, name, email, gender);

    if (user) {
      setCurrentUser(user);
      addUser(user);
      toast.success('成功加入查經！');
      onJoined();
    } else {
      toast.error('加入失敗，請重試');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <Card variant="highlight" className="border-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full gradient-gold flex items-center justify-center mb-4 glow-gold">
            <Users className="w-8 h-8 text-secondary-foreground" />
          </div>
          <CardTitle className="text-2xl">加入查經小組</CardTitle>
          <CardDescription className="text-base">
            Join Bible Study Session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                姓名 Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入您的姓名"
                required
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                電子郵件 Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base">性別 Gender</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as 'male' | 'female')}
                className="flex gap-4"
              >
                <div className="flex-1">
                  <Label
                    htmlFor="male"
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      gender === 'male'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="male" id="male" className="sr-only" />
                    <span className="text-lg">👨</span>
                    <span className="font-medium">男 Male</span>
                  </Label>
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor="female"
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      gender === 'female'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="female" id="female" className="sr-only" />
                    <span className="text-lg">👩</span>
                    <span className="font-medium">女 Female</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              variant="gold"
              size="xl"
              className="w-full"
              disabled={isLoading || !name || !email}
            >
              {isLoading ? '加入中...' : '加入查經 Join Now'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
