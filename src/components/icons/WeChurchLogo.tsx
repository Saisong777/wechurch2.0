import React from 'react';
import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

/**
 * WeChurch Logo - a warm home-and-heart mark.
 * IMPORTANT: keep fill="none" on paths directly for stable WebView rendering.
 */
export const WeChurchLogo: React.FC<WeChurchLogoProps> = ({
  size = 48,
  className,
  variant = 'icon',
}) => {
  const gradientId = `wechurch-warm-${variant}-${size}`;
  const glowId = `wechurch-glow-${variant}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FB7FF" />
          <stop offset="0.54" stopColor="#2384F5" />
          <stop offset="1" stopColor="#5B7CFF" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21 17) rotate(52) scale(47)">
          <stop stopColor="#FFFFFF" stopOpacity="0.62" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="3" y="3" width="58" height="58" rx="19" fill={`url(#${gradientId})`} />
      <rect x="3" y="3" width="58" height="58" rx="19" fill={`url(#${glowId})`} />
      <path
        d="M14 34.5 32 19.5 50 34.5"
        fill="none"
        stroke="#F8FBFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 33.5V48H43.5V33.5"
        fill="none"
        stroke="#F8FBFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M32 42.5C27.8 39.5 25.5 37.3 25.5 34.6C25.5 32.7 26.9 31.3 28.7 31.3C30.1 31.3 31.2 32.1 32 33.3C32.8 32.1 33.9 31.3 35.3 31.3C37.1 31.3 38.5 32.7 38.5 34.6C38.5 37.3 36.2 39.5 32 42.5Z"
        fill="none"
        stroke="#FFF7EC"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="19.5" r="2.8" fill="#FFF7EC" />
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
  const gradientId = `wechurch-icon-warm-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="5" y1="4" x2="27" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FB7FF" />
          <stop offset="0.6" stopColor="#2384F5" />
          <stop offset="1" stopColor="#5B7CFF" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill={`url(#${gradientId})`} />
      <path
        d="M7 17 16 9.5 25 17"
        fill="none"
        stroke="#F8FBFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 16.8V24H21.5V16.8"
        fill="none"
        stroke="#F8FBFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 21.5C13.9 20 12.8 18.9 12.8 17.6C12.8 16.6 13.5 16 14.4 16C15.1 16 15.6 16.4 16 17C16.4 16.4 16.9 16 17.6 16C18.5 16 19.2 16.6 19.2 17.6C19.2 18.9 18.1 20 16 21.5Z"
        fill="none"
        stroke="#FFF7EC"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="9.5" r="1.5" fill="#FFF7EC" />
    </svg>
  );
};
