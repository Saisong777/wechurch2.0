import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type CardLevel = 'L1' | 'L2' | 'L3';

interface IcebreakerCardProps {
  content: string | null;
  contentEn?: string | null;
  level: CardLevel;
  isFlipped: boolean;
  isDrawing: boolean;
  showEnglish?: boolean;
  onTap?: () => void;
}

const levelConfig: Record<CardLevel, { 
  label: string; 
  labelEn: string;
  bgClass: string; 
  borderClass: string;
  glowClass: string;
}> = {
  L1: {
    label: '真心話',
    labelEn: 'Warm-Up',
    bgClass: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    borderClass: 'border-emerald-300',
    glowClass: 'shadow-emerald-500/50',
  },
  L2: {
    label: '連結',
    labelEn: 'Connection',
    bgClass: 'bg-gradient-to-br from-amber-400 to-amber-600',
    borderClass: 'border-amber-300',
    glowClass: 'shadow-amber-500/50',
  },
  L3: {
    label: '深度',
    labelEn: 'Deep',
    bgClass: 'bg-gradient-to-br from-rose-400 to-rose-600',
    borderClass: 'border-rose-300',
    glowClass: 'shadow-rose-500/50',
  },
};

export const IcebreakerCard: React.FC<IcebreakerCardProps> = ({
  content,
  contentEn,
  level,
  isFlipped,
  isDrawing,
  showEnglish = false,
  onTap,
}) => {
  const config = levelConfig[level];

  // Determine which content to display
  const displayContent = showEnglish && contentEn ? contentEn : content;

  return (
    <div 
      className="perspective-1000 w-full max-w-sm mx-auto cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={onTap}
    >
      <motion.div
        className="relative w-full aspect-[3/4] preserve-3d"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{
          rotateY: isFlipped ? 180 : 0,
        }}
        transition={{
          duration: 0.6,
          type: 'spring',
          stiffness: 100,
          damping: 15,
        }}
      >
        {/* Card Back */}
        <div
          className={cn(
            'absolute inset-0 backface-hidden rounded-3xl',
            'flex flex-col items-center justify-center gap-4',
            'border-4 shadow-2xl',
            config.bgClass,
            config.borderClass,
            config.glowClass,
            isDrawing && 'animate-pulse'
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-5xl">🃏</span>
          </div>
          <div className="text-center text-white">
            <p className="text-2xl font-bold">{config.label}</p>
            <p className="text-sm opacity-80">{config.labelEn}</p>
          </div>
          {!content && (
            <p className="text-white/70 text-sm mt-4">點擊抽牌</p>
          )}
        </div>

        {/* Card Front */}
        <div
          className={cn(
            'absolute inset-0 backface-hidden rounded-3xl',
            'flex flex-col items-center justify-center',
            'border-4 shadow-2xl p-6',
            'bg-card text-card-foreground',
            config.borderClass,
          )}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Level Badge */}
          <div 
            className={cn(
              'absolute top-4 left-4 px-3 py-1 rounded-full text-white text-xs font-medium',
              config.bgClass
            )}
          >
            {showEnglish ? config.labelEn : config.label}
          </div>

          {/* Question Content */}
          <div className="flex-1 flex items-center justify-center w-full">
            <p className="text-xl md:text-2xl font-medium text-center leading-relaxed">
              {displayContent || '正在載入...'}
            </p>
          </div>

          {/* Secondary language hint if both are available */}
          {content && contentEn && (
            <p className="text-muted-foreground text-xs text-center mb-2 opacity-70">
              {showEnglish ? content : contentEn}
            </p>
          )}

          {/* Hint */}
          <p className="text-muted-foreground text-sm text-center">
            {showEnglish ? 'Answer freely, no right or wrong ✨' : '輕鬆回答，沒有標準答案 ✨'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
