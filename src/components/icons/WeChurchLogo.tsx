import React from 'react';
import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

/**
 * WeChurch Logo - Minimalist, Durable, & Classic Design
 * A refined geometric mark combining:
 * - A House (shelter, community, church)
 * - A Person/Figure in the negative space (the "We" in WeChurch)
 * - Pure, minimal linework inside a rounded app-icon squircle
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
      {/* Solid blue background - avoids Android gradient ID conflict */}
      <rect width="64" height="64" rx="16" fill="#1D6FE0" />

      {/* 
        Minimalist Church/Person mark:
        A continuous stroke forming a house with an arched door.
        The arch and the dot above form a person being sheltered in the center.
      */}
      <path
        d="M32 16 L14 32 V48 H26 V38 A6 6 0 0 1 38 38 V48 H50 V32 Z"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center dot (Head of the person / Community Focus) */}
      <circle cx="32" cy="24" r="3.5" fill="white" />
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
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="8" fill="url(#wcIconPrimary)" />

      <path
        d="M16 8 L7 16 V24 H13 V19 A3 3 0 0 1 19 19 V24 H25 V16 Z"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="12" r="2" fill="white" />
    </svg>
  );
};
