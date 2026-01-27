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
        <linearGradient id="soulGymTeal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(172, 66%, 45%)" />
          <stop offset="100%" stopColor="hsl(168, 76%, 42%)" />
        </linearGradient>
        <linearGradient id="soulGymDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 20%, 18%)" />
          <stop offset="100%" stopColor="hsl(200, 25%, 12%)" />
        </linearGradient>
        <linearGradient id="energyGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(172, 66%, 45%)" />
          <stop offset="50%" stopColor="hsl(180, 70%, 50%)" />
          <stop offset="100%" stopColor="hsl(185, 75%, 55%)" />
        </linearGradient>
      </defs>
      
      {/* Outer ring - represents strength */}
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="url(#soulGymTeal)"
        strokeWidth="3"
        fill="none"
      />
      
      {/* Dumbbell - horizontal bar */}
      <rect
        x="12"
        y="30"
        width="40"
        height="4"
        rx="2"
        fill="url(#soulGymDark)"
      />
      
      {/* Dumbbell - left weight */}
      <rect
        x="8"
        y="24"
        width="8"
        height="16"
        rx="2"
        fill="url(#soulGymDark)"
      />
      
      {/* Dumbbell - right weight */}
      <rect
        x="48"
        y="24"
        width="8"
        height="16"
        rx="2"
        fill="url(#soulGymDark)"
      />
      
      {/* Cross/Plus - spiritual element (overlaid) */}
      <rect
        x="30"
        y="16"
        width="4"
        height="32"
        rx="1"
        fill="url(#soulGymTeal)"
      />
      
      {/* Cross - horizontal beam */}
      <rect
        x="22"
        y="22"
        width="20"
        height="4"
        rx="1"
        fill="url(#soulGymTeal)"
      />
      
      {/* Energy rays */}
      <g opacity="0.8">
        <path d="M32 6 L34 12 L30 12 Z" fill="url(#energyGradient)" />
        <path d="M50 14 L46 18 L48 20 Z" fill="url(#energyGradient)" />
        <path d="M58 32 L52 30 L52 34 Z" fill="url(#energyGradient)" />
        <path d="M14 14 L18 18 L16 20 Z" fill="url(#energyGradient)" />
        <path d="M6 32 L12 30 L12 34 Z" fill="url(#energyGradient)" />
      </g>
    </svg>
  );
};
