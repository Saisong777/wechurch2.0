import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Mail, Bell, BellOff, UserCheck, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { PotentialMember } from '@/hooks/usePotentialMembers';

interface CRMMemberCardProps {
  member: PotentialMember;
  onUpdateStatus: (id: string, status: PotentialMember['status']) => void;
  onToggleSubscription: (id: string, subscribed: boolean) => void;
  onLinkUser: (id: string) => void;
}

export const CRMMemberCard = ({ 
  member, 
  onUpdateStatus, 
  onToggleSubscription,
  onLinkUser,
}: CRMMemberCardProps) => {
  const statusConfig = {
    pending: { label: '待跟進', variant: 'secondary' as const },
    member: { label: '會員', variant: 'default' as const },
    declined: { label: '已婉拒', variant: 'outline' as const },
  };

  const status = statusConfig[member.status];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{member.name}</h3>
              <Badge variant={status.variant} className="shrink-0">
                {status.label}
              </Badge>
              {!member.subscribed && (
                <Badge variant="outline" className="shrink-0 text-muted-foreground">
                  <BellOff className="h-3 w-3 mr-1" />
                  已取消訂閱
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {member.email}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>出席 {member.sessions_count} 次</span>
              <span>最後：{format(new Date(member.last_session_at), 'MM/dd', { locale: zhTW })}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.status === 'pending' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(member.id, 'member')}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  標記為會員
                </DropdownMenuItem>
              )}
              {member.status === 'member' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(member.id, 'pending')}>
                  標記為待跟進
                </DropdownMenuItem>
              )}
              {member.status !== 'declined' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(member.id, 'declined')}>
                  標記為已婉拒
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleSubscription(member.id, !member.subscribed)}>
                {member.subscribed ? (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    取消訂閱
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    啟用訂閱
                  </>
                )}
              </DropdownMenuItem>
              {!member.user_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onLinkUser(member.id)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    手動連結用戶
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};
