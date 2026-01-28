import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdminForceRefreshProps {
  sessionId: string;
  /** Show as icon-only button */
  iconOnly?: boolean;
}

/**
 * Admin-only button to broadcast force_refresh to all connected clients
 * Useful when participants' lists get out of sync
 */
export const AdminForceRefresh: React.FC<AdminForceRefreshProps> = ({
  sessionId,
  iconOnly = false,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleForceRefresh = async () => {
    setIsSending(true);
    setSent(false);

    try {
      // Broadcast to all clients listening on this session's system_messages channel
      const channel = supabase.channel(`system_messages_${sessionId}`);
      
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'force_refresh',
        payload: { timestamp: Date.now() },
      });

      // Unsubscribe after sending
      await supabase.removeChannel(channel);

      setSent(true);
      toast.success('已發送強制刷新廣播');
      
      // Reset sent state after 3 seconds
      setTimeout(() => setSent(false), 3000);
    } catch (error) {
      console.error('[AdminForceRefresh] Error:', error);
      toast.error('發送失敗');
    } finally {
      setIsSending(false);
    }
  };

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleForceRefresh}
            disabled={isSending}
            className="h-8 w-8"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sent ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Radio className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>強制所有用戶刷新</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleForceRefresh}
      disabled={isSending}
      className="gap-2"
    >
      {isSending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          發送中...
        </>
      ) : sent ? (
        <>
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          已發送
        </>
      ) : (
        <>
          <Radio className="h-4 w-4" />
          強制全員刷新
        </>
      )}
    </Button>
  );
};
