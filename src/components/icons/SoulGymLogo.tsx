import React from 'react';
import { cn } from '@/lib/utils';

interface SoulGymLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

export const SoulGymLogo: React.FC<SoulGymLogoProps> = ({
  size = 48,
  className,
  variant = 'icon',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('', className)}
    >
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="soulGymGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" />
        </linearGradient>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(40, 80%, 55%)" />
          <stop offset="100%" stopColor="hsl(35, 90%, 45%)" />
        </linearGradient>
      </defs>
      
      {/* Outer ring - represents eternity/wholeness */}
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="url(#goldGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Dumbbell - horizontal bar */}
      <rect
        x="12"
        y="30"
        width="40"
        height="4"
        rx="2"
        fill="url(#soulGymGradient)"
      />
      
      {/* Dumbbell - left weight */}
      <rect
        x="8"
        y="24"
        width="8"
        height="16"
        rx="2"
        fill="url(#soulGymGradient)"
      />
      
      {/* Dumbbell - right weight */}
      <rect
        x="48"
        y="24"
        width="8"
        height="16"
        rx="2"
        fill="url(#soulGymGradient)"
      />
      
      {/* Cross - vertical beam (spiritual element) */}
      <rect
        x="30"
        y="14"
        width="4"
        height="36"
        rx="1"
        fill="url(#goldGradient)"
      />
      
      {/* Cross - horizontal beam */}
      <rect
        x="22"
        y="20"
        width="20"
        height="4"
        rx="1"
        fill="url(#goldGradient)"
      />
      
      {/* Light rays emanating from center */}
      <g opacity="0.6">
        <line x1="32" y1="8" x2="32" y2="12" stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="45" y1="12" x2="42" y2="15" stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="52" y1="21" x2="49" y2="22" stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="19" y1="12" x2="22" y2="15" stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="21" x2="15" y2="22" stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
};
