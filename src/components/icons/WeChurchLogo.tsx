import React from 'react';
import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

/**
 * WeChurch Logo - Blue background with white church outline.
 * IMPORTANT: fill="none" must be on the <path> element directly (not SVG root)
 * to ensure correct cross-platform rendering (Android Chrome, WebView, etc.)
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
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block', className)}
    >
      {/* Solid blue background */}
      <rect width="64" height="64" rx="16" fill="#1D6FE0" />

      {/* House / church outline — fill="none" on path prevents default black SVG fill */}
      <path
        d="M32 16 L14 32 V48 H26 V38 A6 6 0 0 1 38 38 V48 H50 V32 Z"
        fill="none"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Head of person */}
      <circle cx="32" cy="24" r="3.5" fill="white" />
    </svg>
  );
};

/**
 * Simplified icon version for small sizes
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
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block', className)}
    >
      <rect width="32" height="32" rx="8" fill="#1D6FE0" />
      <path
        d="M16 8 L7 16 V24 H13 V19 A3 3 0 0 1 19 19 V24 H25 V16 Z"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="12" r="2" fill="white" />
    </svg>
  );
};
