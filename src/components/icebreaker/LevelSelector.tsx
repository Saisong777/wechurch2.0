import React from 'react';
import { cn } from '@/lib/utils';

type CardLevel = 'L1' | 'L2' | 'L3';

interface LevelSelectorProps {
  currentLevel: CardLevel;
  onLevelChange: (level: CardLevel) => void;
  disabled?: boolean;
}

const levels: { value: CardLevel; label: string; labelEn: string; emoji: string; color: string }[] = [
  { value: 'L1', label: '破冰', labelEn: 'Warm-Up', emoji: '🟢', color: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400' },
  { value: 'L2', label: '連結', labelEn: 'Connection', emoji: '🟡', color: 'bg-amber-500 hover:bg-amber-600 border-amber-400' },
  { value: 'L3', label: '深度', labelEn: 'Deep', emoji: '🔴', color: 'bg-rose-500 hover:bg-rose-600 border-rose-400' },
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
            'border-2 shadow-lg',
            'active:scale-95 touch-manipulation',
            level.color,
            currentLevel === level.value 
              ? 'ring-2 ring-offset-2 ring-offset-background scale-105' 
              : 'opacity-70 hover:opacity-100',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span>{level.emoji}</span>
          <span className="hidden sm:inline">{level.label}</span>
          <span className="sm:hidden">{level.value}</span>
        </button>
      ))}
    </div>
  );
};
