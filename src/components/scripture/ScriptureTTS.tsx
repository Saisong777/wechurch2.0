import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptureTTSProps { text: string; className?: string; compact?: boolean; label?: string }
type TtsState = 'idle' | 'playing' | 'paused';
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];
const VOICE_STORAGE_KEY = 'wechurch-tts-voice';

function synthesis() {
  return typeof window !== 'undefined' ? window.speechSynthesis : undefined;
}

export function ScriptureTTS({ text, className, compact = false, label }: ScriptureTTSProps) {
  const [state, setState] = useState<TtsState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [speed, setSpeed] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);

  const cancel = useCallback(() => {
    clearTimeout(restartRef.current);
    restartRef.current = undefined;
    // Old browser callbacks can arrive after cancellation or a replacement.
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
      synthesis()?.cancel();
    }
  }, []);
  const stop = useCallback(() => { cancel(); setState('idle'); }, [cancel]);

  useEffect(() => { stop(); return cancel; }, [text, stop, cancel]);
  useEffect(() => {
    const synth = synthesis();
    if (!synth) return;
    const load = () => {
      const available = synth.getVoices()
        .filter(voice => /^(zh|cmn)(-|_)/i.test(voice.lang))
        .sort((a, b) => Number(!/TW/i.test(a.lang)) - Number(!/TW/i.test(b.lang)));
      setVoices(available);
      let stored: string | null = null;
      try { stored = localStorage.getItem(VOICE_STORAGE_KEY); } catch { /* Storage is optional. */ }
      setVoiceURI(current => available.find(v => v.voiceURI === current)?.voiceURI
        || available.find(v => v.voiceURI === stored)?.voiceURI || available[0]?.voiceURI || '');
    };
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, []);
  useEffect(() => {
    if (!panelOpen) return;
    const outside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setPanelOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanelOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [panelOpen]);

  const speak = useCallback((uri = voiceURI, rate = speed) => {
    cancel();
    const synth = synthesis();
    if (!synth || !text.trim()) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = rate;
      utterance.voice = voices.find(voice => voice.voiceURI === uri) || null;
      const finished = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setState('idle');
      };
      utterance.onend = finished;
      utterance.onerror = finished;
      utteranceRef.current = utterance;
      setState('playing');
      synth.speak(utterance);
    } catch { stop(); }
  }, [cancel, stop, text, voices, voiceURI, speed]);

  const playPause = () => {
    try {
      if (state === 'idle') speak();
      else if (state === 'playing') {
        if (restartRef.current) { stop(); return; }
        synthesis()?.pause();
        setState('paused');
      } else {
        synthesis()?.resume();
        setState('playing');
      }
    } catch { stop(); }
  };
  const restart = (uri: string, rate: number) => {
    const wasPlaying = state === 'playing';
    stop();
    if (wasPlaying) {
      setState('playing');
      restartRef.current = setTimeout(() => {
        restartRef.current = undefined;
        speak(uri, rate);
      }, 50);
    }
  };

  if (!synthesis() || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const controls = <div className="flex items-center gap-2 flex-wrap">
    <Button size="icon" variant="ghost" onClick={playPause} disabled={!text.trim()}
      aria-label={state === 'playing' ? '暫停朗讀' : state === 'paused' ? '繼續朗讀' : '開始朗讀'}
      title={state === 'playing' ? '暫停朗讀' : '朗讀'} data-testid="button-tts-play-pause">
      {state === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
    </Button>
    <Button size="icon" variant="ghost" onClick={stop} disabled={state === 'idle'}
      aria-label="停止朗讀" title="停止朗讀" data-testid="button-tts-stop"><Square className="w-4 h-4" /></Button>
    <Select value={String(speed)} onValueChange={value => {
      const rate = Number(value);
      if (!SPEED_OPTIONS.includes(rate)) return;
      setSpeed(rate);
      restart(voiceURI, rate);
    }}>
      <SelectTrigger className="h-9 w-20 text-xs" aria-label="朗讀速度" data-testid="select-tts-speed"><SelectValue /></SelectTrigger>
      <SelectContent>{SPEED_OPTIONS.map(rate => <SelectItem key={rate} value={String(rate)}>{rate}x</SelectItem>)}</SelectContent>
    </Select>
    {voices.length > 0 && <Select value={voiceURI} onValueChange={uri => {
      setVoiceURI(uri);
      try { localStorage.setItem(VOICE_STORAGE_KEY, uri); } catch { /* Storage is optional. */ }
      restart(uri, speed);
    }}>
      <SelectTrigger className="h-9 w-40 max-w-full text-xs" aria-label="朗讀語音" data-testid="select-tts-voice"><SelectValue /></SelectTrigger>
      <SelectContent>{voices.map(voice => <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
        {voice.name.replace(/^(Microsoft|Google|Apple)\s+/i, '').trim()}
      </SelectItem>)}</SelectContent>
    </Select>}
  </div>;
  if (!compact) return <div className={className} data-testid="scripture-tts-controls">{controls}</div>;
  return <div className={cn('relative inline-block', className)} ref={panelRef}>
    <Button size={label ? 'sm' : 'icon'} variant={label ? 'outline' : 'ghost'}
      className="gap-1.5" aria-label={label || '朗讀設定'} aria-expanded={panelOpen}
      onClick={() => setPanelOpen(open => !open)} data-testid="button-tts-compact-toggle">
      <Volume2 className={cn('w-4 h-4', state === 'playing' && 'text-primary')} />{label}
    </Button>
    {panelOpen && <div className="absolute right-0 top-full mt-1 z-50 rounded-md border bg-popover p-3 shadow-md w-64 max-w-[calc(100vw-2rem)]">{controls}</div>}
  </div>;
}
export default ScriptureTTS;
