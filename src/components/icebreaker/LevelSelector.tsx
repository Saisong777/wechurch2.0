import React from 'react';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';

type CardLevel = 'L1' | 'L2' | 'L3';

interface LevelSelectorProps {
  currentLevel: CardLevel;
  onLevelChange: (level: CardLevel) => void;
  disabled?: boolean;
}

const levels: { value: CardLevel; label: string; labelEn: string; color: string; iconColor: string }[] = [
  { value: 'L1', label: '真心話', labelEn: 'Warm-Up', color: 'bg-emerald-500 border-emerald-400', iconColor: 'text-emerald-200' },
  { value: 'L2', label: '連結', labelEn: 'Connection', color: 'bg-amber-500 border-amber-400', iconColor: 'text-amber-200' },
  { value: 'L3', label: '深度', labelEn: 'Deep', color: 'bg-rose-500 border-rose-400', iconColor: 'text-rose-200' },
];

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  currentLevel,
  onLevelChange,
  disabled,
}) => {
  return (
    <div className="flex gap-2 justify-center">
      {levels.map((level) => (
        <button
          key={level.value}
          onClick={() => onLevelChange(level.value)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl',
            'font-medium text-white transition-all duration-200',
            'border-2 shadow-lg touch-manipulation hover-elevate',
            level.color,
            currentLevel === level.value 
              ? 'ring-2 ring-offset-2 ring-offset-background scale-105' 
              : 'opacity-70',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Circle className={cn('w-4 h-4 fill-current', level.iconColor)} />
          <span className="hidden sm:inline">{level.label}</span>
          <span className="sm:hidden">{level.value}</span>
        </button>
      ))}
    </div>
  );
};
