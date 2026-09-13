import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

export function WeChurchLogo({ size = 48, className }: WeChurchLogoProps) {
  return <img src="/wechurch-together.png" width={size} height={size} alt="" aria-hidden="true"
    className={cn('block shrink-0 object-contain', className)} />;
}

export function WeChurchIcon({ size = 32, className }: Pick<WeChurchLogoProps, 'size' | 'className'>) {
  return <WeChurchLogo size={size} className={className} />;
}
