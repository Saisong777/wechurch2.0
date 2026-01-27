import { useCallback, useRef } from 'react';

interface SoundOptions {
  volume?: number;
  enabled?: boolean;
}

export function useSoundEffects(options: SoundOptions = {}) {
  const { volume = 0.5, enabled = true } = options;
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Card flip sound - quick swoosh
  const playFlipSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Could not play flip sound:', e);
    }
  }, [enabled, volume, getAudioContext]);

  // Draw success sound - pleasant chime
  const playDrawSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      const ctx = getAudioContext();
      
      const playNote = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Play a pleasant ascending chime
      const now = ctx.currentTime;
      playNote(523.25, now, 0.15); // C5
      playNote(659.25, now + 0.08, 0.15); // E5
      playNote(783.99, now + 0.16, 0.2); // G5
    } catch (e) {
      console.warn('Could not play draw sound:', e);
    }
  }, [enabled, volume, getAudioContext]);

  // Timer tick sound - subtle click
  const playTickSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(volume * 0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.03);
    } catch (e) {
      console.warn('Could not play tick sound:', e);
    }
  }, [enabled, volume, getAudioContext]);

  // Timer warning sound - urgent beep
  const playWarningSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      const ctx = getAudioContext();
      
      const playBeep = (startTime: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, startTime);
        
        gainNode.gain.setValueAtTime(volume * 0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.1);
      };
      
      const now = ctx.currentTime;
      playBeep(now);
      playBeep(now + 0.15);
    } catch (e) {
      console.warn('Could not play warning sound:', e);
    }
  }, [enabled, volume, getAudioContext]);

  // Timer end sound - completion tone
  const playTimerEndSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      const ctx = getAudioContext();
      
      const playNote = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        gainNode.gain.setValueAtTime(volume * 0.5, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Descending tone to signal end
      const now = ctx.currentTime;
      playNote(783.99, now, 0.2); // G5
      playNote(659.25, now + 0.15, 0.2); // E5
      playNote(523.25, now + 0.3, 0.3); // C5
    } catch (e) {
      console.warn('Could not play timer end sound:', e);
    }
  }, [enabled, volume, getAudioContext]);

  return {
    playFlipSound,
    playDrawSound,
    playTickSound,
    playWarningSound,
    playTimerEndSound,
  };
}
