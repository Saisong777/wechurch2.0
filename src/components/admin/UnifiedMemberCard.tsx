import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Mail, Bell, BellOff, UserCheck, Link2, Trash2, Shield, Crown, Star, Users } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { UnifiedMember, PotentialMember } from '@/hooks/useUnifiedMembers';
import { AppRole } from '@/hooks/useUserRole';

interface UnifiedMemberCardProps {
  member: UnifiedMember;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdateRole: (userId: string, role: AppRole) => void;
  onUpdateStatus: (id: string, status: PotentialMember['status']) => void;
  onToggleSubscription: (id: string, subscribed: boolean) => void;
  onLinkUser: (id: string) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  admin: { label: '管理員', variant: 'destructive', icon: <Shield className="w-3 h-3" /> },
  leader: { label: '小組長', variant: 'default', icon: <Crown className="w-3 h-3" /> },
  future_leader: { label: '儲備', variant: 'secondary', icon: <Star className="w-3 h-3" /> },
  member: { label: '成員', variant: 'outline', icon: <Users className="w-3 h-3" /> },
};

const statusConfig = {
  pending: { label: '待跟進', variant: 'secondary' as const },
  member: { label: '已轉換', variant: 'default' as const },
  declined: { label: '已婉拒', variant: 'outline' as const },
};

export const UnifiedMemberCard = ({ 
  member,
  isSelected,
  onToggleSelect, 
  onUpdateRole,
  onUpdateStatus, 
  onToggleSubscription,
  onLinkUser,
  onDelete,
  isAdmin,
}: UnifiedMemberCardProps) => {
  const isRegistered = member.type === 'registered';

  return (
    <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary bg-muted/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {!isRegistered && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(member.id)}
              className="mt-1"
              aria-label={`Select ${member.name}`}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={isRegistered ? 'default' : 'secondary'} className="text-xs shrink-0">
                {isRegistered ? '會員' : '潛在'}
              </Badge>
              <h3 className="font-medium truncate">{member.name}</h3>
              {isRegistered && member.role ? (
                <Badge variant={roleConfig[member.role].variant} className="gap-1 shrink-0">
                  {roleConfig[member.role].icon}
                  {roleConfig[member.role].label}
                </Badge>
              ) : (
                <Badge variant={statusConfig[member.status].variant} className="shrink-0">
                  {statusConfig[member.status].label}
                </Badge>
              )}
              {!member.subscribed && (
                <Badge variant="outline" className="shrink-0 text-muted-foreground">
                  <BellOff className="h-3 w-3 mr-1" />
                  未訂閱
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {member.email}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>出席 {member.sessions_count} 次</span>
              {member.last_session_at && (
                <span>最後：{format(new Date(member.last_session_at), 'MM/dd', { locale: zhTW })}</span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isRegistered && member.user_id && isAdmin && (
                <>
                  <DropdownMenuLabel>變更角色</DropdownMenuLabel>
                  <DropdownMenuItem 
                    onClick={() => onUpdateRole(member.user_id!, 'admin')}
                    disabled={member.role === 'admin'}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    設為管理員
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onUpdateRole(member.user_id!, 'leader')}
                    disabled={member.role === 'leader'}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    設為小組長
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onUpdateRole(member.user_id!, 'future_leader')}
                    disabled={member.role === 'future_leader'}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    設為儲備
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onUpdateRole(member.user_id!, 'member')}
                    disabled={member.role === 'member'}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    設為一般成員
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {!isRegistered && (
                <>
                  <DropdownMenuLabel>變更狀態</DropdownMenuLabel>
                  {member.status === 'pending' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(member.potential_member_id!, 'member')}>
                      <UserCheck className="h-4 w-4 mr-2" />
                      標記為已轉換
                    </DropdownMenuItem>
                  )}
                  {member.status === 'member' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(member.potential_member_id!, 'pending')}>
                      標記為待跟進
                    </DropdownMenuItem>
                  )}
                  {member.status !== 'declined' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(member.potential_member_id!, 'declined')}>
                      標記為已婉拒
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}

              {member.potential_member_id && (
                <DropdownMenuItem 
                  onClick={() => onToggleSubscription(member.potential_member_id!, !member.subscribed)}
                >
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
              )}

              {!isRegistered && !member.user_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onLinkUser(member.potential_member_id!)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    手動連結用戶
                  </DropdownMenuItem>
                </>
              )}

              {!isRegistered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(member.potential_member_id!)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    刪除
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
