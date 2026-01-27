import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface GameTimerProps {
  isHost: boolean;
  showEnglish?: boolean;
  onTimerEnd?: () => void;
  // Sync props for group mode
  syncedDuration?: number;
  syncedStartedAt?: string | null;
  syncedRunning?: boolean;
  onTimerSync?: (duration: number, startedAt: string | null, running: boolean) => void;
}

const TIMER_PRESETS = [30, 60, 90, 120]; // seconds

export const GameTimer: React.FC<GameTimerProps> = ({
  isHost,
  showEnglish = false,
  onTimerEnd,
  syncedDuration,
  syncedStartedAt,
  syncedRunning,
  onTimerSync,
}) => {
  const isSyncMode = syncedDuration !== undefined;
  
  // Local state for standalone mode
  const [localDuration, setLocalDuration] = useState(60);
  const [localTimeLeft, setLocalTimeLeft] = useState(60);
  const [localRunning, setLocalRunning] = useState(false);
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasPlayedEndSound, setHasPlayedEndSound] = useState(false);
  
  const { playTickSound, playWarningSound, playTimerEndSound } = useSoundEffects({
    enabled: soundEnabled,
  });

  // Derive values based on sync mode
  const duration = isSyncMode ? (syncedDuration ?? 60) : localDuration;
  const isRunning = isSyncMode ? (syncedRunning ?? false) : localRunning;

  // Calculate time left for sync mode
  const calculateSyncedTimeLeft = useCallback(() => {
    if (!syncedStartedAt || !syncedRunning) {
      return syncedDuration ?? 60;
    }
    const startTime = new Date(syncedStartedAt).getTime();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, (syncedDuration ?? 60) - elapsed);
  }, [syncedStartedAt, syncedRunning, syncedDuration]);

  const timeLeft = isSyncMode ? calculateSyncedTimeLeft() : localTimeLeft;

  // Timer countdown logic
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (isSyncMode) {
        const newTime = calculateSyncedTimeLeft();
        
        // Play sounds at certain points
        if (newTime === 10 || newTime === 5) {
          playWarningSound();
        } else if (newTime <= 3 && newTime > 0) {
          playTickSound();
        } else if (newTime === 0 && !hasPlayedEndSound) {
          playTimerEndSound();
          setHasPlayedEndSound(true);
          onTimerEnd?.();
        }
      } else {
        setLocalTimeLeft((prev) => {
          const newTime = prev - 1;
          
          if (newTime === 10 || newTime === 5) {
            playWarningSound();
          } else if (newTime <= 3 && newTime > 0) {
            playTickSound();
          } else if (newTime === 0) {
            playTimerEndSound();
            onTimerEnd?.();
          }
          
          return newTime;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isSyncMode, calculateSyncedTimeLeft, playTickSound, playWarningSound, playTimerEndSound, onTimerEnd, hasPlayedEndSound]);

  // Auto-stop when time runs out (local mode only)
  useEffect(() => {
    if (!isSyncMode && localTimeLeft <= 0 && localRunning) {
      setLocalRunning(false);
    }
  }, [isSyncMode, localTimeLeft, localRunning]);

  // Reset end sound flag when timer restarts
  useEffect(() => {
    if (isRunning) {
      setHasPlayedEndSound(false);
    }
  }, [isRunning, syncedStartedAt]);

  // Reset local time when duration changes
  useEffect(() => {
    if (!isSyncMode && !localRunning) {
      setLocalTimeLeft(localDuration);
    }
  }, [isSyncMode, localDuration, localRunning]);

  const handleStart = useCallback(() => {
    if (isSyncMode && onTimerSync) {
      // Start synced timer
      onTimerSync(duration, new Date().toISOString(), true);
    } else {
      if (localTimeLeft <= 0) {
        setLocalTimeLeft(localDuration);
      }
      setLocalRunning(true);
    }
  }, [isSyncMode, onTimerSync, duration, localTimeLeft, localDuration]);

  const handlePause = useCallback(() => {
    if (isSyncMode && onTimerSync) {
      // Pause synced timer - calculate remaining and stop
      const remaining = calculateSyncedTimeLeft();
      onTimerSync(remaining, null, false);
    } else {
      setLocalRunning(false);
    }
  }, [isSyncMode, onTimerSync, calculateSyncedTimeLeft]);

  const handleReset = useCallback(() => {
    if (isSyncMode && onTimerSync) {
      onTimerSync(syncedDuration ?? 60, null, false);
    } else {
      setLocalRunning(false);
      setLocalTimeLeft(localDuration);
    }
  }, [isSyncMode, onTimerSync, syncedDuration, localDuration]);

  const handleDurationChange = useCallback((newDuration: number) => {
    if (isSyncMode && onTimerSync) {
      onTimerSync(newDuration, null, false);
    } else {
      setLocalDuration(newDuration);
    }
  }, [isSyncMode, onTimerSync]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const isWarning = timeLeft <= 10 && timeLeft > 0;
  const isEnded = timeLeft <= 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Timer Display */}
      <div className="relative">
        <motion.div
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center',
            'border-4 transition-colors duration-300',
            isEnded ? 'border-destructive bg-destructive/10' :
            isWarning ? 'border-warning bg-warning/10' :
            isRunning ? 'border-primary bg-primary/10' :
            'border-muted bg-muted/50'
          )}
          animate={isWarning && isRunning ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          {/* Progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
              className={cn(
                'transition-colors duration-300',
                isEnded ? 'text-destructive' :
                isWarning ? 'text-warning' :
                'text-primary'
              )}
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          
          <span className={cn(
            'text-2xl font-bold z-10',
            isEnded ? 'text-destructive' :
            isWarning ? 'text-warning' :
            'text-foreground'
          )}>
            {formatTime(timeLeft)}
          </span>
        </motion.div>
      </div>

      {/* Sync indicator for group mode */}
      {isSyncMode && !isHost && (
        <Badge variant="outline" className="text-xs">
          {showEnglish ? 'Synced with host' : '與主持人同步'}
        </Badge>
      )}

      {/* Controls - only for host */}
      {isHost && (
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
            >
              <Pause className="w-4 h-4 mr-1" />
              {showEnglish ? 'Pause' : '暫停'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleStart}
            >
              <Play className="w-4 h-4 mr-1" />
              {showEnglish ? 'Start' : '開始'}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            disabled={isRunning}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Settings Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isRunning}>
                <Settings2 className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="center">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {showEnglish ? 'Timer Duration' : '計時器時長'}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {TIMER_PRESETS.map((preset) => (
                      <Badge
                        key={preset}
                        variant={duration === preset ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleDurationChange(preset)}
                      >
                        {preset}s
                      </Badge>
                    ))}
                  </div>
                  <Slider
                    value={[duration]}
                    onValueChange={([val]) => handleDurationChange(val)}
                    min={15}
                    max={180}
                    step={15}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {formatTime(duration)}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {showEnglish ? 'Sound' : '音效'}
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Non-host view */}
      {!isHost && isRunning && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Badge variant={isWarning ? 'destructive' : 'secondary'}>
              <Timer className="w-3 h-3 mr-1" />
              {showEnglish ? 'Timer running' : '計時中'}
            </Badge>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Time's up message */}
      <AnimatePresence>
        {isEnded && (
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-sm font-medium text-destructive"
          >
            {showEnglish ? "Time's up!" : '時間到！'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
