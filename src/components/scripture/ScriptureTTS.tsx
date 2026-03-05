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

function detectGender(voice: SpeechSynthesisVoice | { name: string, gender?: string }): 'male' | 'female' | 'unknown' {
  if ('gender' in voice && voice.gender) {
    return voice.gender.toLowerCase() === 'male' ? 'male' : 'female';
  }
  const nm = voice.name;
  const uri = 'voiceURI' in voice ? voice.voiceURI : '';
  const nameAndLang = nm + ' ' + uri;
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

function getVoiceLabel(voice: SpeechSynthesisVoice | { name: string, gender?: string }): string {
  const shortName = shortenVoiceName(voice.name);
  const gender = detectGender(voice);
  const genderTag = gender === 'male' ? ' [男聲]' : gender === 'female' ? ' [女聲]' : '';
  return shortName + genderTag;
}

function isTtsSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis;
  } catch {
    return false;
  }
}

function safeSpeechSynthesis() {
  if (!isTtsSupported()) return null;
  return window.speechSynthesis;
}

const GCP_KEY_STORAGE = 'wechurch-gcp-tts-key';

// Standard Google Cloud Chinese voices for quick access if we don't want to fetch the whole list
const GCP_DEFAULT_VOICES = [
  { name: 'cmn-TW-Wavenet-A', gender: 'female', lang: 'cmn-TW' },
  { name: 'cmn-TW-Wavenet-B', gender: 'male', lang: 'cmn-TW' },
  { name: 'cmn-TW-Wavenet-C', gender: 'male', lang: 'cmn-TW' },
  { name: 'cmn-CN-Wavenet-A', gender: 'female', lang: 'cmn-CN' },
  { name: 'cmn-CN-Wavenet-B', gender: 'male', lang: 'cmn-CN' },
  { name: 'cmn-CN-Wavenet-C', gender: 'male', lang: 'cmn-CN' },
  { name: 'cmn-CN-Wavenet-D', gender: 'female', lang: 'cmn-CN' },
];

export function ScriptureTTS({ text, className, compact = false, label }: ScriptureTTSProps) {
  const [ttsState, setTtsState] = useState<TtsState>('idle');
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice | { name: string, gender?: string, voiceURI?: string, lang?: string }>>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [gcpKey, setGcpKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGcpActive, setIsGcpActive] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(GCP_KEY_STORAGE);
      if (storedKey) {
        setGcpKey(storedKey);
        setIsGcpActive(true);
      }
    } catch { }
  }, []);

  const loadVoices = useCallback(() => {
    try {
      if (isGcpActive && gcpKey) {
        // Use predefined GCP voices to avoid additional network calls purely for listing
        const gcpOptions = GCP_DEFAULT_VOICES.map(v => ({
          ...v,
          voiceURI: v.name,
        }));
        setVoices(gcpOptions);

        try {
          const stored = localStorage.getItem(VOICE_STORAGE_KEY);
          if (stored && gcpOptions.some(v => v.voiceURI === stored)) {
            setSelectedVoiceURI(stored);
          } else {
            setSelectedVoiceURI(gcpOptions[0].voiceURI);
          }
        } catch { }
        return;
      }

      const synth = safeSpeechSynthesis();
      if (!synth) {
        setSupported(false);
        return;
      }
      const allVoices = synth.getVoices();
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
        try {
          const stored = localStorage.getItem(VOICE_STORAGE_KEY);
          const storedVoice = stored ? sorted.find(v => v.voiceURI === stored) : null;

          if (storedVoice) {
            setSelectedVoiceURI(storedVoice.voiceURI);
          } else {
            const defaultVoice = sorted[0];
            setSelectedVoiceURI(defaultVoice.voiceURI);
            localStorage.setItem(VOICE_STORAGE_KEY, defaultVoice.voiceURI);
          }
        } catch { }
      }
    } catch (e) {
      console.warn('[ScriptureTTS] loadVoices error:', e);
      if (!isGcpActive) setSupported(false);
    }
  }, [isGcpActive, gcpKey]);

  useEffect(() => {
    try {
      const synth = safeSpeechSynthesis();
      if (!synth) {
        setSupported(false);
        return;
      }
      loadVoices();
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', loadVoices);
        return () => {
          try { synth.removeEventListener('voiceschanged', loadVoices); } catch { }
        };
      } else if ('onvoiceschanged' in synth) {
        synth.onvoiceschanged = loadVoices;
        return () => {
          try { synth.onvoiceschanged = null; } catch { }
        };
      }
    } catch (e) {
      console.warn('[ScriptureTTS] init error:', e);
      setSupported(false);
    }
  }, [loadVoices]);

  useEffect(() => {
    return () => {
      try {
        const synth = safeSpeechSynthesis();
        if (synth) synth.cancel();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      } catch { }
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

  const startSpeech = useCallback(async () => {
    if (isGcpActive && gcpKey) {
      setTtsState('playing');
      try {
        const voiceConfig = GCP_DEFAULT_VOICES.find(v => v.name === selectedVoiceURI) || GCP_DEFAULT_VOICES[0];
        const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${gcpKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: voiceConfig.lang, name: voiceConfig.name },
            audioConfig: { audioEncoding: 'MP3', speakingRate: speed },
          }),
        });

        if (!res.ok) {
          console.error('[ScriptureTTS] GCP synthesis failed', await res.text());
          throw new Error('GCP API Request failed');
        }

        const data = await res.json();
        const audioStr = 'data:audio/mp3;base64,' + data.audioContent;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(audioStr);
        audio.onended = () => setTtsState('idle');
        audio.onerror = () => setTtsState('idle');
        audioRef.current = audio;
        audio.play().catch(e => {
          console.warn('[ScriptureTTS] play gcp audio blocked:', e);
          setTtsState('idle');
        });
      } catch (e) {
        console.warn('[ScriptureTTS] startSpeech GCP error:', e);
        setTtsState('idle');
      }
      return;
    }

    try {
      const synth = safeSpeechSynthesis();
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = speed;

      const voice = voices.find(v => ('voiceURI' in v ? v.voiceURI : v.name) === selectedVoiceURI);
      if (voice && 'localService' in voice) { // Check if it's a native SpeechSynthesisVoice
        utterance.voice = voice as SpeechSynthesisVoice;
      }

      utterance.onend = () => {
        setTtsState('idle');
      };
      utterance.onerror = () => {
        setTtsState('idle');
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
      setTtsState('playing');
    } catch (e) {
      console.warn('[ScriptureTTS] startSpeech error:', e);
      setTtsState('idle');
    }
  }, [text, speed, voices, selectedVoiceURI, isGcpActive, gcpKey]);

  const handlePlayPause = useCallback(() => {
    try {
      if (ttsState === 'idle') {
        startSpeech();
        return;
      }

      if (isGcpActive && gcpKey) {
        if (audioRef.current) {
          if (ttsState === 'playing') {
            audioRef.current.pause();
            setTtsState('paused');
          } else {
            audioRef.current.play();
            setTtsState('playing');
          }
        }
        return;
      }

      const synth = safeSpeechSynthesis();
      if (!synth) return;
      if (ttsState === 'playing') {
        synth.pause();
        setTtsState('paused');
      } else if (ttsState === 'paused') {
        synth.resume();
        setTtsState('playing');
      }
    } catch (e) {
      console.warn('[ScriptureTTS] playPause error:', e);
      setTtsState('idle');
    }
  }, [ttsState, startSpeech, isGcpActive, gcpKey]);

  const handleStop = useCallback(() => {
    try {
      if (isGcpActive && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } else {
        const synth = safeSpeechSynthesis();
        if (synth) synth.cancel();
      }
    } catch { }
    setTtsState('idle');
  }, [isGcpActive]);

  const handleVoiceChange = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try { localStorage.setItem(VOICE_STORAGE_KEY, voiceURI); } catch { }
    if (ttsState !== 'idle') {
      try {
        const synth = safeSpeechSynthesis();
        if (!synth) return;
        synth.cancel();
        setTimeout(() => {
          try {
            const s = safeSpeechSynthesis();
            if (!s) return;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = speed;
            const voice = voices.find(v => v.voiceURI === voiceURI);
            if (voice) utterance.voice = voice;
            utterance.onend = () => setTtsState('idle');
            utterance.onerror = () => setTtsState('idle');
            utteranceRef.current = utterance;
            s.speak(utterance);
            setTtsState('playing');
          } catch { setTtsState('idle'); }
        }, 50);
      } catch { setTtsState('idle'); }
    }
  }, [ttsState, text, speed, voices]);

  const handleSpeedChange = useCallback((newSpeed: string) => {
    const s = parseFloat(newSpeed);
    setSpeed(s);
    if (ttsState !== 'idle') {
      try {
        const synth = safeSpeechSynthesis();
        if (!synth) return;
        synth.cancel();
        setTimeout(() => {
          try {
            const sy = safeSpeechSynthesis();
            if (!sy) return;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = s;
            const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
            if (voice) utterance.voice = voice;
            utterance.onend = () => setTtsState('idle');
            utterance.onerror = () => setTtsState('idle');
            utteranceRef.current = utterance;
            sy.speak(utterance);
            setTtsState('playing');
          } catch { setTtsState('idle'); }
        }, 50);
      } catch { setTtsState('idle'); }
    }
  }, [ttsState, text, voices, selectedVoiceURI]);

  if (!supported) {
    return null;
  }

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

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">語音</span>
        {voices.length > 0 ? (
          <Select value={selectedVoiceURI} onValueChange={handleVoiceChange}>
            <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-tts-voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map(v => {
                const uri = 'voiceURI' in v ? v.voiceURI : v.name;
                return (
                  <SelectItem key={uri} value={uri || ''} data-testid={`option-voice-${uri}`}>
                    {getVoiceLabel(v)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground" data-testid="text-no-chinese-voices">
            此設備不支援中文語音
          </span>
        )}
      </div>

      <div className="pt-2 border-t mt-1 flex justify-between items-center">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {isGcpActive ? (
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
          )}
          {isGcpActive ? 'Google Cloud 高音質' : '免費設備語音'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 gap-1"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="w-3 h-3" />
          設定
        </Button>
      </div>

      {showSettings && (
        <div className="p-3 bg-muted/50 rounded-md border mt-1 space-y-2">
          <label className="text-xs font-medium block">Google Cloud TTS 金鑰 (選填)</label>
          <p className="text-[10px] text-muted-foreground">
            填入有效金鑰以啟用高音質 AI 語音。金鑰僅安全儲存於您目前的瀏覽器中。
          </p>
          <input
            type="password"
            value={gcpKey}
            onChange={(e) => {
              const val = e.target.value.trim();
              setGcpKey(val);
              if (val) {
                try { localStorage.setItem(GCP_KEY_STORAGE, val); setIsGcpActive(true); } catch { }
              } else {
                try { localStorage.removeItem(GCP_KEY_STORAGE); setIsGcpActive(false); } catch { }
              }
              setTtsState('idle'); // Stop playback on change
            }}
            placeholder="AIzaSy..."
            className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
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
            {voices.map(v => {
              const uri = 'voiceURI' in v ? v.voiceURI : v.name;
              return (
                <SelectItem key={uri} value={uri || ''} data-testid={`option-voice-${uri}`}>
                  {getVoiceLabel(v)}
                </SelectItem>
              );
            })}
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
