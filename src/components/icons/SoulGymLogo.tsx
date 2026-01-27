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
        <linearGradient id="soulGymOrange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(25, 95%, 53%)" />
          <stop offset="100%" stopColor="hsl(16, 100%, 50%)" />
        </linearGradient>
        <linearGradient id="soulGymDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(0, 0%, 15%)" />
          <stop offset="100%" stopColor="hsl(0, 0%, 8%)" />
        </linearGradient>
        <linearGradient id="fireGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(25, 95%, 53%)" />
          <stop offset="50%" stopColor="hsl(16, 100%, 55%)" />
          <stop offset="100%" stopColor="hsl(45, 100%, 60%)" />
        </linearGradient>
      </defs>
      
      {/* Outer ring - represents strength */}
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="url(#soulGymOrange)"
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
        fill="url(#soulGymOrange)"
      />
      
      {/* Cross - horizontal beam */}
      <rect
        x="22"
        y="22"
        width="20"
        height="4"
        rx="1"
        fill="url(#soulGymOrange)"
      />
      
      {/* Fire/energy rays */}
      <g opacity="0.8">
        <path d="M32 6 L34 12 L30 12 Z" fill="url(#fireGradient)" />
        <path d="M50 14 L46 18 L48 20 Z" fill="url(#fireGradient)" />
        <path d="M58 32 L52 30 L52 34 Z" fill="url(#fireGradient)" />
        <path d="M14 14 L18 18 L16 20 Z" fill="url(#fireGradient)" />
        <path d="M6 32 L12 30 L12 34 Z" fill="url(#fireGradient)" />
      </g>
    </svg>
  );
};
