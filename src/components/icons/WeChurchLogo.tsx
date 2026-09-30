import { cn } from '@/lib/utils';

interface WeChurchLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

export function WeChurchLogo({ size = 48, className }: WeChurchLogoProps) {
  return <img src="/wechurch-handshake.png" width={Math.round(size * 1.35)} height={size} alt="" aria-hidden="true"
    className={cn('wechurch-handshake-logo block shrink-0 object-contain', className)} />;
}

export function WeChurchIcon({ size = 32, className }: Pick<WeChurchLogoProps, 'size' | 'className'>) {
  return <WeChurchLogo size={size} className={className} />;
}
