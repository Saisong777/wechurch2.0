import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useSession } from '@/contexts/SessionContext';
import { submitStudyNotes } from '@/lib/supabase-helpers';
import { BookOpen, Send, Sparkles, Heart, Lightbulb, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface StudyFormProps {
  onSubmitted: () => void;
}

const formFields = [
  { id: 'theme', label: '主題 Theme', icon: BookOpen, placeholder: '這段經文的主題是什麼？' },
  { id: 'movingVerse', label: '最感動的經文 Most Moving Verse', icon: Heart, placeholder: '哪一節經文最觸動您？' },
  { id: 'factsDiscovered', label: '發現的事實 Facts Discovered', icon: Sparkles, placeholder: '您從經文中發現了什麼事實？' },
  { id: 'traditionalExegesis', label: '傳統解經 Traditional Exegesis', icon: BookOpen, placeholder: '傳統上如何解釋這段經文？' },
  { id: 'inspirationFromGod', label: '神的啟示 Inspiration from God', icon: Lightbulb, placeholder: '神透過這段經文對您說什麼？' },
  { id: 'applicationInLife', label: '生活應用 Application in Life', icon: CheckCircle, placeholder: '您如何將這段經文應用在生活中？' },
  { id: 'others', label: '其他 Others', icon: Sparkles, placeholder: '其他想法或問題' },
];

export const StudyForm: React.FC<StudyFormProps> = ({ onSubmitted }) => {
  const { currentUser, currentSession, addSubmission } = useSession();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !currentSession) {
      toast.error('Session 資訊遺失');
      return;
    }
    
    setIsSubmitting(true);

    const submission = await submitStudyNotes({
      sessionId: currentSession.id,
      userId: currentUser.id,
      groupNumber: currentUser.groupNumber || 0,
      name: currentUser.name,
      email: currentUser.email,
      bibleVerse: currentSession.verseReference,
      theme: formData.theme || '',
      movingVerse: formData.movingVerse || '',
      factsDiscovered: formData.factsDiscovered || '',
      traditionalExegesis: formData.traditionalExegesis || '',
      inspirationFromGod: formData.inspirationFromGod || '',
      applicationInLife: formData.applicationInLife || '',
      others: formData.others || '',
    });

    if (submission) {
      addSubmission(submission);
      toast.success('提交成功！Submission successful!');
      onSubmitted();
    } else {
      toast.error('提交失敗，請重試');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in px-1 sm:px-0">
      {/* Session info card - more compact on mobile */}
      <Card variant="highlight" className="mb-4 md:mb-6">
        <CardContent className="py-4 md:py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">小組 Group</p>
              <p className="font-bold text-base md:text-lg text-primary">#{currentUser?.groupNumber}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">姓名 Name</p>
              <p className="font-medium text-sm md:text-base truncate">{currentUser?.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs md:text-sm text-muted-foreground">經文 Verse</p>
              <p className="font-serif font-medium text-sm md:text-base">{currentSession?.verseReference}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Study form - optimized for mobile input */}
      <Card className="shadow-sm md:shadow">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
            查經筆記 Study Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            {formFields.map(({ id, label, icon: Icon, placeholder }, index) => (
              <div 
                key={id} 
                className="space-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Label 
                  htmlFor={id} 
                  className="text-sm md:text-base flex items-center gap-2 font-medium"
                >
                  <Icon className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span>{label}</span>
                </Label>
                <AutoResizeTextarea
                  id={id}
                  value={formData[id] || ''}
                  onChange={(e) => handleChange(id, e.target.value)}
                  placeholder={placeholder}
                  minRows={id === 'others' ? 2 : 2}
                  maxRows={8}
                  className="text-base leading-relaxed focus:ring-secondary/50"
                />
              </div>
            ))}

            {/* Submit button - sticky on mobile for easy access */}
            <div className="pt-4 md:pt-6 sticky bottom-0 bg-card pb-2 -mx-6 px-6 md:static md:mx-0 md:px-0 md:pb-0">
              <Button
                type="submit"
                variant="gold"
                size="xl"
                className="w-full text-base md:text-lg py-4 md:py-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  '提交中...'
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    提交 Submit
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
