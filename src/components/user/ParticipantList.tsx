import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Users, MapPin, CheckCircle, Clock } from 'lucide-react';
import { useSessionParticipants, useAdminForceRefresh, ParticipantPublic } from '@/hooks/useSessionParticipants';
import { cn } from '@/lib/utils';

interface ParticipantListProps {
  sessionId: string | null;
  /** Maximum height for the scroll area */
  maxHeight?: string;
  /** Show group numbers */
  showGroups?: boolean;
  /** Filter by specific group */
  groupFilter?: number;
  /** Highlight current user */
  currentUserId?: string;
  /** Custom polling interval */
  refetchInterval?: number;
  /** Show compact view */
  compact?: boolean;
}

// Skeleton loader component
const ParticipantSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-2 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-12" />
      </div>
    ))}
  </div>
);

// Single participant item
const ParticipantItem: React.FC<{
  participant: ParticipantPublic;
  isCurrentUser?: boolean;
  showGroup?: boolean;
  compact?: boolean;
}> = ({ participant, isCurrentUser, showGroup, compact }) => {
  const genderEmoji = participant.gender === 'male' ? '👨' : '👩';
  const isRemote = participant.location !== 'On-site';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg transition-colors',
        compact ? 'p-2' : 'p-3',
        isCurrentUser && 'bg-primary/10 border border-primary/20'
      )}
    >
      {/* Avatar/Gender indicator */}
      <div className={cn(
        'flex items-center justify-center rounded-full bg-muted',
        compact ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base'
      )}>
        {genderEmoji}
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            compact ? 'text-sm' : 'text-base'
          )}>
            {participant.display_name}
          </span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs">你</Badge>
          )}
        </div>
        
        {!compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {isRemote && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {participant.location}
              </span>
            )}
            {participant.status && (
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-3 w-3" />
                已確認
              </span>
            )}
          </div>
        )}
      </div>

      {/* Group badge */}
      {showGroup && participant.group_number && (
        <Badge variant="outline" className="shrink-0">
          第 {participant.group_number} 組
        </Badge>
      )}

      {/* Ready status indicator (compact mode) */}
      {compact && (
        participant.status ? (
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )
      )}
    </div>
  );
};

// Error state component
const ParticipantListError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <p className="text-muted-foreground mb-3">連線繁忙中...</p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RefreshCw className="h-4 w-4 mr-2" />
      重試
    </Button>
  </div>
);

export const ParticipantList: React.FC<ParticipantListProps> = ({
  sessionId,
  maxHeight = '300px',
  showGroups = true,
  groupFilter,
  currentUserId,
  refetchInterval = 5000,
  compact = false,
}) => {
  const {
    participants,
    totalCount,
    isLoading,
    isRefetching,
    error,
    refetchWithFeedback,
    forceRefresh,
  } = useSessionParticipants({
    sessionId,
    refetchInterval,
  });

  // Listen for admin force refresh broadcasts
  useAdminForceRefresh(sessionId, forceRefresh);

  // Filter participants if group filter is set
  const filteredParticipants = groupFilter
    ? participants.filter(p => p.group_number === groupFilter)
    : participants;

  // Sort: current user first, then by join time
  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
  });

  return (
    <div className="space-y-2">
      {/* Header with count and sync button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {groupFilter ? `第 ${groupFilter} 組` : '參與者'} ({filteredParticipants.length}
            {!groupFilter && totalCount > 0 && ` / ${totalCount}`})
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={refetchWithFeedback}
          disabled={isRefetching}
          className="h-8 px-2"
        >
          <RefreshCw className={cn(
            'h-4 w-4',
            isRefetching && 'animate-spin'
          )} />
          <span className="ml-1 text-xs">同步</span>
        </Button>
      </div>

      {/* Participant list */}
      <ScrollArea 
        className="rounded-md border" 
        style={{ maxHeight }}
      >
        {isLoading ? (
          <ParticipantSkeleton count={compact ? 3 : 5} />
        ) : error ? (
          <ParticipantListError onRetry={() => refetchWithFeedback()} />
        ) : sortedParticipants.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            尚無參與者
          </div>
        ) : (
          <div className={cn('space-y-1', compact ? 'p-1' : 'p-2')}>
            {sortedParticipants.map(participant => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                isCurrentUser={participant.id === currentUserId}
                showGroup={showGroups && !groupFilter}
                compact={compact}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
