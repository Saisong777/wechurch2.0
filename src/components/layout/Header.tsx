import React from 'react';
import { BookIcon } from '@/components/icons/BookIcon';
import { CrossIcon } from '@/components/icons/CrossIcon';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

export const Header: React.FC<HeaderProps> = ({
  title = '靈魂健身房',
  subtitle = 'Soul Gym',
  showLogo = true,
  className,
  variant = 'default',
}) => {
  return (
    <header className={cn(
      'w-full',
      variant === 'default' ? 'py-6' : 'py-4',
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3">
          {showLogo && (
            <div className="relative">
              <div className="absolute inset-0 bg-secondary/20 rounded-full blur-xl animate-pulse-soft" />
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full gradient-navy">
                <CrossIcon className="text-secondary" size={24} />
              </div>
            </div>
          )}
          <div className="text-center">
            <h1 className={cn(
              'font-serif font-bold text-foreground',
              variant === 'default' ? 'text-3xl md:text-4xl' : 'text-2xl'
            )}>
              {title}
            </h1>
            {subtitle && variant === 'default' && (
              <p className="text-muted-foreground text-sm mt-1 tracking-wide">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
