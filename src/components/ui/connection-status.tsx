import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  state: ConnectionState;
  lastSyncTime?: Date;
  className?: string;
}

const stateConfig: Record<ConnectionState, {
  icon: React.ElementType;
  label: string;
  labelEn: string;
  color: string;
  animate?: boolean;
}> = {
  connecting: {
    icon: Loader2,
    label: '連線中',
    labelEn: 'Connecting',
    color: 'text-muted-foreground',
    animate: true,
  },
  connected: {
    icon: Wifi,
    label: '已連線',
    labelEn: 'Connected',
    color: 'text-accent',
  },
  disconnected: {
    icon: WifiOff,
    label: '已斷線',
    labelEn: 'Disconnected',
    color: 'text-destructive',
  },
  reconnecting: {
    icon: Loader2,
    label: '重新連線中',
    labelEn: 'Reconnecting',
    color: 'text-secondary',
    animate: true,
  },
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  lastSyncTime,
  className,
}) => {
  const config = stateConfig[state];
  const Icon = config.icon;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        'bg-card border border-border shadow-sm',
        className
      )}
    >
      <Icon
        className={cn(
          'w-3.5 h-3.5',
          config.color,
          config.animate && 'animate-spin'
        )}
      />
      <span className={config.color}>
        {config.label}
      </span>
      {state === 'connected' && lastSyncTime && (
        <span className="text-muted-foreground ml-1">
          {formatTime(lastSyncTime)}
        </span>
      )}
    </div>
  );
};
