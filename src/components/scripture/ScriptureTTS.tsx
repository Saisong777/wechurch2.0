import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Square, Volume2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptureTTSProps {
  text: string;
  className?: string;
  compact?: boolean;
  label?: string;
}

type TtsState = 'idle' | 'playing' | 'paused';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];
const VOICE_STORAGE_KEY = 'wechurch-tts-voice';

const MALE_VOICE_PATTERNS = [
  /male/i,
  /男/,
  /Yunxi/i,
  /Yunyang/i,
  /Yunjian/i,
  /Yunhao/i,
  /Yunfeng/i,
  /Yunze/i,
  /Yunxia/i,
  /YunJhe/i,
  /Zhiyu/i,
  /Kangkang/i,
  /Hanhan/i,
];

const FEMALE_VOICE_PATTERNS = [
  /female/i,
  /女/,
  /Xiaoxiao/i,
  /Xiaoyi/i,
  /Xiaomeng/i,
  /Xiaobei/i,
  /Xiaoni/i,
  /Xiaoxuan/i,
  /Xiaoshuang/i,
  /Xiaomo/i,
  /Xiaorui/i,
  /Xiaohan/i,
  /Xiaoqiu/i,
  /Xiaoyan/i,
  /Xiaozhen/i,
  /HsiaoChen/i,
  /HsiaoYu/i,
  /Yating/i,
  /Hanhan/i,
  /Liang/i,
  /Huihui/i,
  /Yaoyao/i,
  /Tingting/i,
  /Meijia/i,
];

function detectGender(voice: SpeechSynthesisVoice): 'male' | 'female' | 'unknown' {
  const nameAndLang = voice.name + ' ' + voice.voiceURI;
  if (MALE_VOICE_PATTERNS.some(p => p.test(nameAndLang))) return 'male';
  if (FEMALE_VOICE_PATTERNS.some(p => p.test(nameAndLang))) return 'female';
  return 'unknown';
}

function shortenVoiceName(name: string): string {
  return name
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Google\s+/i, '')
    .replace(/^Apple\s+/i, '')
    .replace(/\s+Online\s*\(Natural\)/i, '')
    .trim();
}

function getVoiceLabel(voice: SpeechSynthesisVoice): string {
  const shortName = shortenVoiceName(voice.name);
  const gender = detectGender(voice);
  const genderTag = gender === 'male' ? ' [男聲]' : gender === 'female' ? ' [女聲]' : '';
  return shortName + genderTag;
}

export function ScriptureTTS({ text, className, compact = false, label }: ScriptureTTSProps) {
  const [ttsState, setTtsState] = useState<TtsState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadVoices = useCallback(() => {
    const allVoices = window.speechSynthesis.getVoices();
    const chineseVoices = allVoices.filter(v => v.lang.startsWith('zh'));
    const sorted = [...chineseVoices].sort((a, b) => {
      const gA = detectGender(a);
      const gB = detectGender(b);
      if (gA === 'male' && gB !== 'male') return -1;
      if (gA !== 'male' && gB === 'male') return 1;
      const twA = a.lang.startsWith('zh-TW') ? 0 : 1;
      const twB = b.lang.startsWith('zh-TW') ? 0 : 1;
      return twA - twB;
    });
    setVoices(sorted);

    if (sorted.length > 0) {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      const storedVoice = stored ? sorted.find(v => v.voiceURI === stored) : null;

      if (storedVoice) {
        setSelectedVoiceURI(storedVoice.voiceURI);
      } else {
        const defaultVoice = sorted[0];
        setSelectedVoiceURI(defaultVoice.voiceURI);
        localStorage.setItem(VOICE_STORAGE_KEY, defaultVoice.voiceURI);
      }
    }
  }, []);

  useEffect(() => {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [loadVoices]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  const startSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = speed;

    const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      setTtsState('idle');
    };
    utterance.onerror = () => {
      setTtsState('idle');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setTtsState('playing');
  }, [text, speed, voices, selectedVoiceURI]);

  const handlePlayPause = useCallback(() => {
    if (ttsState === 'idle') {
      startSpeech();
    } else if (ttsState === 'playing') {
      window.speechSynthesis.pause();
      setTtsState('paused');
    } else if (ttsState === 'paused') {
      window.speechSynthesis.resume();
      setTtsState('playing');
    }
  }, [ttsState, startSpeech]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setTtsState('idle');
  }, []);

  const handleVoiceChange = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    localStorage.setItem(VOICE_STORAGE_KEY, voiceURI);
    if (ttsState !== 'idle') {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = speed;
        const voice = voices.find(v => v.voiceURI === voiceURI);
        if (voice) utterance.voice = voice;
        utterance.onend = () => setTtsState('idle');
        utterance.onerror = () => setTtsState('idle');
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setTtsState('playing');
      }, 50);
    }
  }, [ttsState, text, speed, voices]);

  const handleSpeedChange = useCallback((newSpeed: string) => {
    const s = parseFloat(newSpeed);
    setSpeed(s);
    if (ttsState !== 'idle') {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = s;
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
        utterance.onend = () => setTtsState('idle');
        utterance.onerror = () => setTtsState('idle');
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setTtsState('playing');
      }, 50);
    }
  }, [ttsState, text, voices, selectedVoiceURI]);

  const controls = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePlayPause}
          data-testid="button-tts-play-pause"
        >
          {ttsState === 'playing' ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleStop}
          disabled={ttsState === 'idle'}
          data-testid="button-tts-stop"
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">速度</span>
        <Select value={String(speed)} onValueChange={handleSpeedChange}>
          <SelectTrigger className="h-8 w-20 text-xs" data-testid="select-tts-speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map(s => (
              <SelectItem key={s} value={String(s)} data-testid={`option-speed-${s}`}>
                {s}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {voices.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">語音</span>
          <Select value={selectedVoiceURI} onValueChange={handleVoiceChange}>
            <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-tts-voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map(v => (
                <SelectItem key={v.voiceURI} value={v.voiceURI} data-testid={`option-voice-${v.voiceURI}`}>
                  {getVoiceLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="text-no-chinese-voices">
          此設備不支援中文語音
        </p>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className={cn('relative inline-block', className)} ref={panelRef}>
        {label ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPanelOpen(prev => !prev)}
            data-testid="button-tts-compact-toggle"
          >
            <Volume2 className={cn('w-3.5 h-3.5', ttsState === 'playing' && 'text-primary')} />
            <span className="text-xs">{label}</span>
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPanelOpen(prev => !prev)}
            data-testid="button-tts-compact-toggle"
          >
            {ttsState === 'playing' ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        )}
        {panelOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 rounded-md border bg-popover p-3 shadow-md min-w-[200px]">
            {controls}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)} data-testid="scripture-tts-controls">
      <Button
        size="icon"
        variant="ghost"
        onClick={handlePlayPause}
        data-testid="button-tts-play-pause"
      >
        {ttsState === 'playing' ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleStop}
        disabled={ttsState === 'idle'}
        data-testid="button-tts-stop"
      >
        <Square className="w-4 h-4" />
      </Button>

      <Select value={String(speed)} onValueChange={handleSpeedChange}>
        <SelectTrigger className="h-8 w-20 text-xs" data-testid="select-tts-speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEED_OPTIONS.map(s => (
            <SelectItem key={s} value={String(s)} data-testid={`option-speed-${s}`}>
              {s}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {voices.length > 0 ? (
        <Select value={selectedVoiceURI} onValueChange={handleVoiceChange}>
          <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-tts-voice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voices.map(v => (
              <SelectItem key={v.voiceURI} value={v.voiceURI} data-testid={`option-voice-${v.voiceURI}`}>
                {getVoiceLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground" data-testid="text-no-chinese-voices">
          此設備不支援中文語音
        </span>
      )}
    </div>
  );
}

export default ScriptureTTS;
