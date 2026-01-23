import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { createSession } from '@/lib/supabase-helpers';
import { BookOpen, Play } from 'lucide-react';
import { toast } from 'sonner';

interface CreateSessionProps {
  onCreated: () => void;
}

export const CreateSession: React.FC<CreateSessionProps> = ({ onCreated }) => {
  const { setCurrentSession, setIsAdmin } = useSession();
  const [verseReference, setVerseReference] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    
    const session = await createSession(verseReference);
    
    if (session) {
      setCurrentSession(session);
      setIsAdmin(true);
      toast.success('查經聚會已建立！Session created!');
      onCreated();
    } else {
      toast.error('建立失敗，請重試');
    }
    
    setIsCreating(false);
  };

  return (
    <Card variant="highlight" className="w-full max-w-xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full gradient-navy flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-secondary" />
        </div>
        <CardTitle className="text-2xl">建立新的查經聚會</CardTitle>
        <CardDescription className="text-base">
          Create a new Bible study session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="verse" className="text-base">
            經文章節 Bible Verse Reference
          </Label>
          <Input
            id="verse"
            value={verseReference}
            onChange={(e) => setVerseReference(e.target.value)}
            placeholder="例如: 約翰福音 3:1-21 / John 3:1-21"
            className="h-12 text-base"
          />
          <p className="text-sm text-muted-foreground">
            輸入今天要查考的經文章節
          </p>
        </div>

        <Button
          variant="navy"
          size="xl"
          className="w-full"
          onClick={handleCreate}
          disabled={!verseReference || isCreating}
        >
          {isCreating ? (
            '建立中...'
          ) : (
            <>
              <Play className="w-5 h-5" />
              開始聚會 Start Session
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
