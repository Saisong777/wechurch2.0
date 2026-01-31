import React from 'react';
import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

/**
 * WeChurch Logo - Modern & Joyful Community Design
 * Combines: Home (belonging), People (community), Abstract (modern)
 * Color: Sky Blue palette for openness and joy
 */
export const WeChurchLogo: React.FC<WeChurchLogoProps> = ({
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
      <defs>
        {/* Primary gradient - Sky Blue */}
        <linearGradient id="weChurchPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 85%, 55%)" />
          <stop offset="100%" stopColor="hsl(210, 90%, 45%)" />
        </linearGradient>
        
        {/* Secondary gradient - Warm accent */}
        <linearGradient id="weChurchAccent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(35, 95%, 60%)" />
          <stop offset="100%" stopColor="hsl(25, 100%, 65%)" />
        </linearGradient>
        
        {/* Light gradient for highlights */}
        <linearGradient id="weChurchLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 80%, 70%)" />
          <stop offset="100%" stopColor="hsl(205, 85%, 55%)" />
        </linearGradient>

        {/* Soft shadow */}
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(210, 90%, 45%)" floodOpacity="0.3"/>
        </filter>
      </defs>

      {/* Background circle - soft blue */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="url(#weChurchPrimary)"
        opacity="0.1"
      />
      
      {/* House roof - representing home/belonging */}
      <path
        d="M32 10 L52 26 L48 26 L48 40 L16 40 L16 26 L12 26 Z"
        fill="url(#weChurchPrimary)"
        filter="url(#softShadow)"
      />
      
      {/* Door/Window - welcoming entrance */}
      <rect
        x="27"
        y="28"
        width="10"
        height="12"
        rx="5"
        fill="white"
        opacity="0.9"
      />
      
      {/* Three people silhouettes - community */}
      {/* Center person (slightly larger) */}
      <circle cx="32" cy="48" r="4" fill="url(#weChurchAccent)" />
      <ellipse cx="32" cy="56" rx="5" ry="4" fill="url(#weChurchAccent)" />
      
      {/* Left person */}
      <circle cx="22" cy="50" r="3.5" fill="url(#weChurchLight)" />
      <ellipse cx="22" cy="57" rx="4" ry="3.5" fill="url(#weChurchLight)" />
      
      {/* Right person */}
      <circle cx="42" cy="50" r="3.5" fill="url(#weChurchLight)" />
      <ellipse cx="42" cy="57" rx="4" ry="3.5" fill="url(#weChurchLight)" />
      
      {/* Connecting arc - unity/togetherness */}
      <path
        d="M18 54 Q32 44 46 54"
        stroke="url(#weChurchPrimary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      
      {/* Sparkle/star elements - joy and energy */}
      <g opacity="0.8">
        <circle cx="10" cy="20" r="2" fill="url(#weChurchAccent)" />
        <circle cx="54" cy="18" r="2.5" fill="url(#weChurchAccent)" />
        <circle cx="8" cy="38" r="1.5" fill="url(#weChurchLight)" />
        <circle cx="56" cy="36" r="1.5" fill="url(#weChurchLight)" />
      </g>
    </svg>
  );
};

/**
 * Simplified icon version for small sizes (favicons, small buttons)
 */
export const WeChurchIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('', className)}
    >
      <defs>
        <linearGradient id="wcIconPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 85%, 55%)" />
          <stop offset="100%" stopColor="hsl(210, 90%, 45%)" />
        </linearGradient>
        <linearGradient id="wcIconAccent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(35, 95%, 60%)" />
          <stop offset="100%" stopColor="hsl(25, 100%, 65%)" />
        </linearGradient>
      </defs>
      
      {/* Simplified house + people */}
      <path
        d="M16 4 L28 13 L25 13 L25 20 L7 20 L7 13 L4 13 Z"
        fill="url(#wcIconPrimary)"
      />
      <rect x="13" y="14" width="6" height="6" rx="3" fill="white" opacity="0.9" />
      
      {/* Three dots representing people */}
      <circle cx="10" cy="26" r="2.5" fill="url(#wcIconPrimary)" />
      <circle cx="16" cy="25" r="3" fill="url(#wcIconAccent)" />
      <circle cx="22" cy="26" r="2.5" fill="url(#wcIconPrimary)" />
    </svg>
  );
};
