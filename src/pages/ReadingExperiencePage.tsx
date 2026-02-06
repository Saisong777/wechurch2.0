import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import {
  ArrowLeft, Play, Pause, Square, Volume2, VolumeX, BookOpen,
  Check, ChevronDown, ChevronUp, Loader2, SkipForward, SkipBack, Mic,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { INSIGHT_CATEGORIES, type InsightCategory } from '@/types/spiritual-fitness';
import { cn } from '@/lib/utils';

interface PlanInfo {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  totalDays: number | null;
  reminderEnabled: boolean | null;
  reminderMorning: string | null;
  reminderNoon: string | null;
  reminderEvening: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProgressEntry {
  dayNumber: number;
  scriptureReference: string;
  isCompleted: boolean;
  completedAt: string | null;
}

interface BibleVerse {
  verseId?: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

interface DevotionalNote {
  id: string;
  userId: string;
  verseReference: string;
  verseText: string | null;
  readingPlanId: string | null;
  dayNumber: number | null;
  titlePhrase: string | null;
  heartbeatVerse: string | null;
  observation: string | null;
  coreInsightCategory: string | null;
  coreInsightNote: string | null;
  scholarsNote: string | null;
  actionPlan: string | null;
  coolDownNote: string | null;
  createdAt: string;
  updatedAt: string;
}

type TtsState = 'idle' | 'playing' | 'paused';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];

function parseScriptureReference(ref: string): { bookName: string; chapterStart: number; chapterEnd: number }[] {
  if (!ref) return [];
  const parts = ref.split(' ');
  if (parts.length < 2) return [];

  const bookName = parts[0];
  const chapterPart = parts.slice(1).join('');

  if (chapterPart.includes('-')) {
    const [startStr, endStr] = chapterPart.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (!isNaN(start) && !isNaN(end)) {
      return [{ bookName, chapterStart: start, chapterEnd: end }];
    }
    if (!isNaN(start)) {
      return [{ bookName, chapterStart: start, chapterEnd: start }];
    }
  } else {
    const chapter = parseInt(chapterPart, 10);
    if (!isNaN(chapter)) {
      return [{ bookName, chapterStart: chapter, chapterEnd: chapter }];
    }
  }
  return [];
}

function calculateCurrentDay(startDate: string): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

const ReadingExperiencePage = () => {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const initialDay = searchParams.get('day') ? parseInt(searchParams.get('day')!, 10) : 1;
  const [selectedDay, setSelectedDay] = useState<number>(initialDay || 1);
  const [ttsState, setTtsState] = useState<TtsState>('idle');
  const [autoRead, setAutoRead] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem('wechurch-tts-voice') || '';
  });
  const [devotionalExpanded, setDevotionalExpanded] = useState(false);
  const [devotionalForm, setDevotionalForm] = useState({
    titlePhrase: '',
    heartbeatVerse: '',
    observation: '',
    coreInsightCategory: null as InsightCategory | null,
    coreInsightNote: '',
    scholarsNote: '',
    actionPlan: '',
    coolDownNote: '',
  });
  const [devotionalNoteId, setDevotionalNoteId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const dayStripRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const versesQueueRef = useRef<BibleVerse[]>([]);
  const currentQueueIndexRef = useRef(0);

  const { data: plan, isLoading: planLoading } = useQuery<PlanInfo>({
    queryKey: ['/api/user-reading-plans', planId],
    queryFn: async () => {
      const res = await fetch(`/api/user-reading-plans/${planId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch plan');
      return res.json();
    },
    enabled: !!planId,
  });

  const { data: progressEntries = [], isLoading: progressLoading } = useQuery<ProgressEntry[]>({
    queryKey: ['/api/user-reading-plans', planId, 'progress'],
    queryFn: async () => {
      const res = await fetch(`/api/user-reading-plans/${planId}/progress`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    },
    enabled: !!planId,
  });

  const currentDayEntry = useMemo(() => {
    return progressEntries.find(e => e.dayNumber === selectedDay);
  }, [progressEntries, selectedDay]);

  const scriptureRefs = useMemo(() => {
    if (!currentDayEntry?.scriptureReference) return [];
    return parseScriptureReference(currentDayEntry.scriptureReference);
  }, [currentDayEntry]);

  const chapterQueries = useMemo(() => {
    const chapters: { bookName: string; chapter: number }[] = [];
    for (const ref of scriptureRefs) {
      for (let ch = ref.chapterStart; ch <= ref.chapterEnd; ch++) {
        chapters.push({ bookName: ref.bookName, chapter: ch });
      }
    }
    return chapters;
  }, [scriptureRefs]);

  const { data: allVerses = [], isLoading: versesLoading } = useQuery<BibleVerse[]>({
    queryKey: ['/api/bible/verses', ...chapterQueries.map(c => `${c.bookName}-${c.chapter}`)],
    queryFn: async () => {
      const results: BibleVerse[] = [];
      for (const cq of chapterQueries) {
        const res = await fetch(`/api/bible/verses/${encodeURIComponent(cq.bookName)}/${cq.chapter}`, { credentials: 'include' });
        if (res.ok) {
          const verses: BibleVerse[] = await res.json();
          results.push(...verses);
        }
      }
      return results;
    },
    enabled: chapterQueries.length > 0,
  });

  const { data: existingNote } = useQuery<DevotionalNote | null>({
    queryKey: ['/api/user-reading-plans', planId, 'devotional', selectedDay],
    queryFn: async () => {
      const res = await fetch(`/api/user-reading-plans/${planId}/devotional/${selectedDay}`, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!planId && !!user,
  });

  useEffect(() => {
    if (plan?.startDate && !searchParams.get('day')) {
      const calcDay = calculateCurrentDay(plan.startDate);
      const totalDays = plan.totalDays || progressEntries.length;
      setSelectedDay(Math.min(calcDay, totalDays || 1));
    }
  }, [plan?.startDate, plan?.totalDays, progressEntries.length, searchParams]);

  useEffect(() => {
    if (existingNote) {
      setDevotionalNoteId(existingNote.id);
      setDevotionalForm({
        titlePhrase: existingNote.titlePhrase || '',
        heartbeatVerse: existingNote.heartbeatVerse || '',
        observation: existingNote.observation || '',
        coreInsightCategory: (existingNote.coreInsightCategory as InsightCategory) || null,
        coreInsightNote: existingNote.coreInsightNote || '',
        scholarsNote: existingNote.scholarsNote || '',
        actionPlan: existingNote.actionPlan || '',
        coolDownNote: existingNote.coolDownNote || '',
      });
    } else {
      setDevotionalNoteId(null);
      setDevotionalForm({
        titlePhrase: '',
        heartbeatVerse: '',
        observation: '',
        coreInsightCategory: null,
        coreInsightNote: '',
        scholarsNote: '',
        actionPlan: '',
        coolDownNote: '',
      });
    }
  }, [existingNote]);

  useEffect(() => {
    if (dayStripRef.current) {
      const activeBtn = dayStripRef.current.querySelector(`[data-day="${selectedDay}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDay]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const chineseVoices = allVoices.filter(v => v.lang.startsWith('zh'));
      setVoices(chineseVoices);
      if (!selectedVoiceURI && chineseVoices.length > 0) {
        const twVoice = chineseVoices.find(v => v.lang === 'zh-TW');
        setSelectedVoiceURI(twVoice?.voiceURI || chineseVoices[0].voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [selectedVoiceURI]);

  const handleVoiceChange = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    localStorage.setItem('wechurch-tts-voice', voiceURI);
    if (ttsState !== 'idle') {
      window.speechSynthesis.cancel();
      setTtsState('idle');
      setCurrentVerseIndex(-1);
    }
  }, [ttsState]);

  const completedCount = useMemo(() => progressEntries.filter(e => e.isCompleted).length, [progressEntries]);
  const totalDays = plan?.totalDays || progressEntries.length || 1;
  const overallProgress = Math.round((completedCount / totalDays) * 100);

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/user-reading-plans/${planId}/progress/${selectedDay}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-reading-plans', planId, 'progress'] });
      toast({ title: '已完成', description: `第 ${selectedDay} 天的讀經已標記完成` });
    },
    onError: (error: Error) => {
      toast({ title: '標記失敗', description: error.message, variant: 'destructive' });
    },
  });

  const saveDevotionalNote = useCallback(async () => {
    if (!user || !planId) return;
    setSavingState('saving');
    const body = {
      userId: user.id,
      verseReference: currentDayEntry?.scriptureReference || '',
      verseText: allVerses.slice(0, 3).map(v => v.text).join(' ') || '',
      readingPlanId: planId,
      dayNumber: selectedDay,
      titlePhrase: devotionalForm.titlePhrase || null,
      heartbeatVerse: devotionalForm.heartbeatVerse || null,
      observation: devotionalForm.observation || null,
      coreInsightCategory: devotionalForm.coreInsightCategory || null,
      coreInsightNote: devotionalForm.coreInsightNote || null,
      scholarsNote: devotionalForm.scholarsNote || null,
      actionPlan: devotionalForm.actionPlan || null,
      coolDownNote: devotionalForm.coolDownNote || null,
    };

    try {
      if (devotionalNoteId) {
        await apiRequest('PATCH', `/api/devotional-notes/${devotionalNoteId}`, body);
      } else {
        const res = await apiRequest('POST', '/api/devotional-notes', body);
        const data = await res.json();
        if (data.id) setDevotionalNoteId(data.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/user-reading-plans', planId, 'devotional', selectedDay] });
      setSavingState('saved');
      toast({ title: '筆記已儲存' });
      setTimeout(() => setSavingState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save devotional note:', err);
      setSavingState('idle');
      toast({ title: '儲存失敗', description: '請稍後再試', variant: 'destructive' });
    }
  }, [user, planId, selectedDay, devotionalForm, devotionalNoteId, currentDayEntry, allVerses, toast]);

  const updateDevotionalField = useCallback((field: string, value: string | InsightCategory | null) => {
    setDevotionalForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const speakVerse = useCallback((verse: BibleVerse, index: number) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(verse.text);
    utterance.lang = 'zh-TW';
    utterance.rate = speed;
    if (selectedVoiceURI) {
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) utterance.voice = voice;
    }
    utteranceRef.current = utterance;
    setCurrentVerseIndex(index);
    setTtsState('playing');

    utterance.onend = () => {
      if (autoRead && currentQueueIndexRef.current < versesQueueRef.current.length - 1) {
        currentQueueIndexRef.current += 1;
        const nextVerse = versesQueueRef.current[currentQueueIndexRef.current];
        speakVerse(nextVerse, currentQueueIndexRef.current);
      } else {
        setTtsState('idle');
        setCurrentVerseIndex(-1);
      }
    };

    utterance.onerror = () => {
      setTtsState('idle');
      setCurrentVerseIndex(-1);
    };

    window.speechSynthesis.speak(utterance);
  }, [speed, autoRead, selectedVoiceURI, voices]);

  const handlePlay = useCallback(() => {
    if (allVerses.length === 0) return;
    if (ttsState === 'paused') {
      window.speechSynthesis.resume();
      setTtsState('playing');
      return;
    }
    versesQueueRef.current = allVerses;
    currentQueueIndexRef.current = 0;
    speakVerse(allVerses[0], 0);
  }, [allVerses, ttsState, speakVerse]);

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause();
    setTtsState('paused');
  }, []);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setTtsState('idle');
    setCurrentVerseIndex(-1);
  }, []);

  const handleSkipNext = useCallback(() => {
    if (currentQueueIndexRef.current < versesQueueRef.current.length - 1) {
      window.speechSynthesis.cancel();
      currentQueueIndexRef.current += 1;
      speakVerse(versesQueueRef.current[currentQueueIndexRef.current], currentQueueIndexRef.current);
    }
  }, [speakVerse]);

  const handleSkipPrev = useCallback(() => {
    if (currentQueueIndexRef.current > 0) {
      window.speechSynthesis.cancel();
      currentQueueIndexRef.current -= 1;
      speakVerse(versesQueueRef.current[currentQueueIndexRef.current], currentQueueIndexRef.current);
    }
  }, [speakVerse]);

  const toggleAutoRead = useCallback(() => {
    const newState = !autoRead;
    setAutoRead(newState);
    if (newState && ttsState === 'idle' && allVerses.length > 0) {
      versesQueueRef.current = allVerses;
      currentQueueIndexRef.current = 0;
      speakVerse(allVerses[0], 0);
    }
  }, [autoRead, ttsState, allVerses, speakVerse]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
  }, [speed]);

  const handleDaySelect = useCallback((day: number) => {
    handleStop();
    setSelectedDay(day);
  }, [handleStop]);

  const groupedVerses = useMemo(() => {
    const groups: { bookName: string; chapter: number; verses: BibleVerse[] }[] = [];
    for (const v of allVerses) {
      const last = groups[groups.length - 1];
      if (last && last.bookName === v.bookName && last.chapter === v.chapter) {
        last.verses.push(v);
      } else {
        groups.push({ bookName: v.bookName, chapter: v.chapter, verses: [v] });
      }
    }
    return groups;
  }, [allVerses]);

  const isLoading = planLoading || progressLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="每日讀經" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="compact" title="每日讀經" />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground" data-testid="text-plan-not-found">找不到此讀經計劃</p>
          <Button variant="outline" onClick={() => navigate('/learn/reading-plans')} data-testid="button-back-to-plans">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回讀經計劃
          </Button>
        </div>
      </div>
    );
  }

  const filledFields = [
    devotionalForm.titlePhrase,
    devotionalForm.heartbeatVerse,
    devotionalForm.observation,
    devotionalForm.coreInsightCategory,
    devotionalForm.coreInsightNote,
    devotionalForm.scholarsNote,
    devotionalForm.actionPlan,
    devotionalForm.coolDownNote,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background" data-testid="reading-experience-page">
      <Header variant="compact" title="每日讀經" />

      <div className="max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-4 md:px-6 pb-24">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/learn/reading-plans')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base sm:text-lg truncate" data-testid="text-plan-name">
              {plan.name}
            </h2>
            <p className="text-xs text-muted-foreground" data-testid="text-plan-progress">
              已完成 {completedCount}/{totalDays} 天 ({overallProgress}%)
            </p>
          </div>
        </div>

        <Progress value={overallProgress} className="h-2 mb-4" data-testid="progress-overall" />

        <div
          ref={dayStripRef}
          className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-hide"
          data-testid="day-navigation"
        >
          {progressEntries.map((entry) => {
            const isSelected = entry.dayNumber === selectedDay;
            const calcDay = plan.startDate ? calculateCurrentDay(plan.startDate) : 1;
            const isToday = entry.dayNumber === Math.min(calcDay, totalDays);
            return (
              <button
                key={entry.dayNumber}
                data-day={entry.dayNumber}
                onClick={() => handleDaySelect(entry.dayNumber)}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[3rem] h-14 rounded-md text-xs transition-colors shrink-0',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : entry.isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-muted text-muted-foreground',
                  isToday && !isSelected && 'ring-2 ring-primary ring-offset-1'
                )}
                data-testid={`button-day-${entry.dayNumber}`}
              >
                <span className="font-medium">{entry.dayNumber}</span>
                {entry.isCompleted && <Check className="w-3 h-3 mt-0.5" />}
              </button>
            );
          })}
        </div>

        {currentDayEntry && (
          <Card className="mb-4">
            <CardContent className="py-3 px-3 sm:px-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm" data-testid="text-scripture-ref">
                    {currentDayEntry.scriptureReference}
                  </span>
                  {currentDayEntry.isCompleted && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      已完成
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground" data-testid="text-day-label">
                  第 {selectedDay} 天
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4 sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
          <CardContent className="py-2 px-3 sm:px-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSkipPrev}
                  disabled={ttsState === 'idle'}
                  data-testid="button-skip-prev"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                {ttsState === 'playing' ? (
                  <Button size="icon" variant="ghost" onClick={handlePause} data-testid="button-pause">
                    <Pause className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePlay}
                    disabled={allVerses.length === 0}
                    data-testid="button-play"
                  >
                    <Play className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleStop}
                  disabled={ttsState === 'idle'}
                  data-testid="button-stop"
                >
                  <Square className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSkipNext}
                  disabled={ttsState === 'idle'}
                  data-testid="button-skip-next"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cycleSpeed}
                  className="text-xs font-mono"
                  data-testid="button-speed"
                >
                  {speed}x
                </Button>
                {voices.length > 0 && (
                  <Select value={selectedVoiceURI} onValueChange={handleVoiceChange}>
                    <SelectTrigger className="h-8 w-auto max-w-[120px] text-xs gap-1" data-testid="select-voice">
                      <Mic className="w-3 h-3 flex-shrink-0" />
                      <SelectValue placeholder="聲音" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>
                          {v.name.replace(/Microsoft |Google |Apple /g, '').substring(0, 20)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant={autoRead ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAutoRead}
                  className="text-xs gap-1"
                  data-testid="button-toggle-auto-read"
                >
                  {autoRead ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {autoRead ? '自動朗讀' : '自己閱讀'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6" data-testid="scripture-display">
          {versesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : allVerses.length === 0 && currentDayEntry ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>無法載入經文內容</p>
                <p className="text-xs mt-1">{currentDayEntry.scriptureReference}</p>
              </CardContent>
            </Card>
          ) : (
            groupedVerses.map((group) => (
              <div key={`${group.bookName}-${group.chapter}`} className="mb-6">
                <h3
                  className="font-semibold text-sm text-muted-foreground mb-3"
                  data-testid={`text-chapter-title-${group.bookName}-${group.chapter}`}
                >
                  {group.bookName} 第{group.chapter}章
                </h3>
                <div className="space-y-1 leading-relaxed">
                  {group.verses.map((verse) => {
                    const globalIndex = allVerses.indexOf(verse);
                    const isHighlighted = globalIndex === currentVerseIndex;
                    return (
                      <span
                        key={`${verse.bookName}-${verse.chapter}-${verse.verse}`}
                        className={cn(
                          'inline transition-colors duration-200',
                          isHighlighted && 'bg-yellow-200 dark:bg-yellow-800/50 rounded px-0.5'
                        )}
                        data-testid={`verse-${verse.bookName}-${verse.chapter}-${verse.verse}`}
                      >
                        <sup className="text-xs text-muted-foreground mr-0.5 font-medium">
                          {verse.verse}
                        </sup>
                        <span className="text-base">{verse.text}</span>
                        {' '}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {!currentDayEntry?.isCompleted && currentDayEntry && (
          <div className="mb-6">
            <Button
              className="w-full"
              onClick={() => markCompleteMutation.mutate()}
              disabled={markCompleteMutation.isPending}
              data-testid="button-mark-complete"
            >
              {markCompleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              標記今天已完成
            </Button>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader
            className="cursor-pointer py-3 px-3 sm:px-4"
            onClick={() => setDevotionalExpanded(!devotionalExpanded)}
            data-testid="button-toggle-devotional"
          >
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                靈修筆記
                {filledFields > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {filledFields}/8
                  </Badge>
                )}
              </CardTitle>
              {devotionalExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>

          {devotionalExpanded && (
            <CardContent className="px-3 sm:px-4 pb-4 space-y-6" data-testid="devotional-form">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">暖身 Warm-up</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-titlePhrase" className="text-xs sm:text-sm">
                    1. 定標題
                  </Label>
                  <Input
                    id="dev-titlePhrase"
                    value={devotionalForm.titlePhrase}
                    onChange={(e) => updateDevotionalField('titlePhrase', e.target.value)}
                    placeholder="幫這段經文下一個標題"
                    data-testid="input-title-phrase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-heartbeatVerse" className="text-xs sm:text-sm">
                    2. 心跳的時刻
                  </Label>
                  <AutoResizeTextarea
                    id="dev-heartbeatVerse"
                    value={devotionalForm.heartbeatVerse}
                    onChange={(e) => updateDevotionalField('heartbeatVerse', e.target.value)}
                    placeholder="哪一節經文讓你心跳加速？"
                    minRows={2}
                    data-testid="textarea-heartbeat-verse"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-observation" className="text-xs sm:text-sm">
                    3. 查看聖經的資訊
                  </Label>
                  <AutoResizeTextarea
                    id="dev-observation"
                    value={devotionalForm.observation}
                    onChange={(e) => updateDevotionalField('observation', e.target.value)}
                    placeholder="你觀察到什麼？"
                    minRows={2}
                    data-testid="textarea-observation"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium">重訓 Core Training</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">4. 思想神的話</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {INSIGHT_CATEGORIES.map((cat) => (
                      <Button
                        key={cat.value}
                        variant={devotionalForm.coreInsightCategory === cat.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          updateDevotionalField('coreInsightCategory', cat.value);
                        }}
                        className="text-xs gap-1"
                        data-testid={`button-category-${cat.value}`}
                      >
                        <span>{cat.emoji}</span>
                        {cat.label}
                      </Button>
                    ))}
                  </div>
                  <AutoResizeTextarea
                    value={devotionalForm.coreInsightNote}
                    onChange={(e) => updateDevotionalField('coreInsightNote', e.target.value)}
                    placeholder="從經文中你學到什麼？"
                    minRows={2}
                    data-testid="textarea-core-insight"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-scholarsNote" className="text-xs sm:text-sm">
                    5. 學長姐的話
                  </Label>
                  <AutoResizeTextarea
                    id="dev-scholarsNote"
                    value={devotionalForm.scholarsNote}
                    onChange={(e) => updateDevotionalField('scholarsNote', e.target.value)}
                    placeholder="查閱資料或聽過的教導"
                    minRows={2}
                    data-testid="textarea-scholars-note"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">伸展 Stretch</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-actionPlan" className="text-xs sm:text-sm">
                    6. 帶一招
                  </Label>
                  <AutoResizeTextarea
                    id="dev-actionPlan"
                    value={devotionalForm.actionPlan}
                    onChange={(e) => updateDevotionalField('actionPlan', e.target.value)}
                    placeholder="今天你要如何實踐？"
                    minRows={2}
                    data-testid="textarea-action-plan"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dev-coolDownNote" className="text-xs sm:text-sm">
                    7. 安靜的心
                  </Label>
                  <AutoResizeTextarea
                    id="dev-coolDownNote"
                    value={devotionalForm.coolDownNote}
                    onChange={(e) => updateDevotionalField('coolDownNote', e.target.value)}
                    placeholder="安靜在神面前，寫下你的禱告"
                    minRows={2}
                    data-testid="textarea-cool-down"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                {savingState === 'saved' && (
                  <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    已儲存
                  </span>
                )}
                <Button
                  onClick={saveDevotionalNote}
                  disabled={savingState === 'saving'}
                  data-testid="button-save-devotional"
                >
                  {savingState === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      儲存中...
                    </>
                  ) : (
                    '儲存筆記'
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ReadingExperiencePage;
