import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { useSession } from '@/contexts/SessionContext';
import { submitStudyNotes } from '@/lib/api-helpers';
import { BookOpen, Send, Sparkles, Heart, Lightbulb, CheckCircle, Cloud, CloudOff } from 'lucide-react';
import { toast } from 'sonner';

interface StudyFormProps {
  onSubmitted: () => void;
}

const formFields = [
  { id: 'theme', label: '1. 標題分段', icon: BookOpen, placeholder: '這段經文的主題是什麼？' },
  { id: 'movingVerse', label: '2. 最感動的經文', icon: Heart, placeholder: '哪一節經文最觸動您？' },
  { id: 'factsDiscovered', label: '3. 經文上的資訊', icon: Sparkles, placeholder: '您從經文中發現了什麼事實？' },
  { id: 'traditionalExegesis', label: '4. 思想神的話', icon: Lightbulb, placeholder: '從這段經文中，有什麼應許、命令、警戒、或對神的認識？' },
  { id: 'inspirationFromGod', label: '5. 注釋書或其他的參考資料', icon: BookOpen, placeholder: '查看相關注釋書或參考資料' },
  { id: 'applicationInLife', label: '6. 與神同行的行動', icon: CheckCircle, placeholder: '具體的行動計畫' },
  { id: 'others', label: '7. 其他', icon: Sparkles, placeholder: '其他想法或問題' },
];

const DRAFT_STORAGE_KEY = 'bible_study_draft';
const AUTO_SAVE_INTERVAL = 3000; // 3 seconds

export const StudyForm: React.FC<StudyFormProps> = ({ onSubmitted }) => {
  const { currentUser, currentSession, addSubmission } = useSession();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedDraft = useRef(false);

  // Generate storage key unique to session and user
  const getDraftKey = useCallback(() => {
    if (!currentSession?.id || !currentUser?.id) return null;
    return `${DRAFT_STORAGE_KEY}_${currentSession.id}_${currentUser.id}`;
  }, [currentSession?.id, currentUser?.id]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (hasLoadedDraft.current) return;
    const draftKey = getDraftKey();
    if (!draftKey) return;

    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.data && Object.keys(parsed.data).some(k => parsed.data[k])) {
          setFormData(parsed.data);
          setLastSaved(parsed.savedAt ? new Date(parsed.savedAt) : null);
          toast.info('已載入上次的草稿 Draft restored', { duration: 2000 });
        }
      }
      hasLoadedDraft.current = true;
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
  }, [getDraftKey]);

  // Auto-save draft to localStorage
  const saveDraft = useCallback(() => {
    const draftKey = getDraftKey();
    if (!draftKey) return;

    // Only save if there's actual content
    const hasContent = Object.values(formData).some(v => v && v.trim());
    if (!hasContent) return;

    setIsSaving(true);
    try {
      const draft = {
        data: formData,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
    setTimeout(() => setIsSaving(false), 500);
  }, [formData, getDraftKey]);

  // Debounced auto-save
  useEffect(() => {
    if (!hasLoadedDraft.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, saveDraft]);

  // Clear draft after successful submission
  const clearDraft = useCallback(() => {
    const draftKey = getDraftKey();
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  }, [getDraftKey]);

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
      clearDraft();
      addSubmission(submission);
      toast.success('提交成功！Submission successful!');
      onSubmitted();
    } else {
      toast.error('提交失敗，請重試');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto animate-fade-in px-1 sm:px-0">
      {/* Session info card - more compact on mobile, spacious on desktop */}
      <Card variant="highlight" className="mb-4 md:mb-6">
        <CardContent className="py-4 md:py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 text-sm">
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">小組 Group</p>
              <p className="font-bold text-base md:text-xl text-primary">#{currentUser?.groupNumber}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">姓名 Name</p>
              <p className="font-medium text-sm md:text-base truncate">{currentUser?.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs md:text-sm text-muted-foreground">經文 Verse</p>
              <p className="font-serif font-medium text-sm md:text-lg">{currentSession?.verseReference}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Study form - responsive layout */}
      <Card className="shadow-sm md:shadow-lg">
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg md:text-2xl">
              <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-secondary" />
              健身筆記 Study Notes
            </CardTitle>
            {/* Auto-save indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isSaving ? (
                <>
                  <Cloud className="w-4 h-4 animate-pulse text-secondary" />
                  <span className="hidden sm:inline">儲存中...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Cloud className="w-4 h-4 text-secondary" />
                  <span className="hidden sm:inline">已自動儲存</span>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            {/* Two-column grid for larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              {formFields.slice(0, 6).map(({ id, label, icon: Icon, placeholder }, index) => (
                <div 
                  key={id} 
                  className="space-y-2 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Label 
                    htmlFor={id} 
                    className="text-sm md:text-base flex items-center gap-2 font-medium"
                  >
                    <Icon className="w-4 h-4 md:w-5 md:h-5 text-secondary flex-shrink-0" />
                    <span>{label}</span>
                  </Label>
                  <AutoResizeTextarea
                    id={id}
                    value={formData[id] || ''}
                    onChange={(e) => handleChange(id, e.target.value)}
                    placeholder={placeholder}
                    minRows={3}
                    maxRows={10}
                    className="text-base md:text-base leading-relaxed focus:ring-secondary/50 lg:min-h-[120px]"
                  />
                </div>
              ))}
            </div>

            {/* "Others" field spans full width */}
            {formFields.slice(6).map(({ id, label, icon: Icon, placeholder }, index) => (
              <div 
                key={id} 
                className="space-y-2 animate-fade-in"
                style={{ animationDelay: `${(index + 6) * 50}ms` }}
              >
                <Label 
                  htmlFor={id} 
                  className="text-sm md:text-base flex items-center gap-2 font-medium"
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5 text-secondary flex-shrink-0" />
                  <span>{label}</span>
                </Label>
                <AutoResizeTextarea
                  id={id}
                  value={formData[id] || ''}
                  onChange={(e) => handleChange(id, e.target.value)}
                  placeholder={placeholder}
                  minRows={2}
                  maxRows={6}
                  className="text-base md:text-base leading-relaxed focus:ring-secondary/50"
                />
              </div>
            ))}

            {/* Submit button */}
            <div className="pt-4 md:pt-6 sticky bottom-0 bg-card pb-2 -mx-6 px-6 md:static md:mx-0 md:px-0 md:pb-0 lg:flex lg:justify-end">
              <Button
                type="submit"
                variant="gold"
                size="xl"
                className="w-full lg:w-auto lg:min-w-[240px] text-base md:text-lg py-4 md:py-3"
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
