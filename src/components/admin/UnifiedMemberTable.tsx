import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { MoreHorizontal, UserCheck, Bell, BellOff, Link2, Trash2, Shield, Crown, Star, Users } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { UnifiedMember, PotentialMember } from '@/hooks/useUnifiedMembers';
import { AppRole } from '@/hooks/useUserRole';

interface UnifiedMemberTableProps {
  members: UnifiedMember[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
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

export const UnifiedMemberTable = ({ 
  members, 
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateRole,
  onUpdateStatus,
  onToggleSubscription,
  onLinkUser,
  onDelete,
  isAdmin,
}: UnifiedMemberTableProps) => {
  const selectableMembers = members.filter(m => m.type === 'potential');
  const allSelected = selectableMembers.length > 0 && selectableMembers.every(m => selectedIds.has(m.id));
  const someSelected = selectableMembers.some(m => selectedIds.has(m.id)) && !allSelected;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                // @ts-ignore
                indeterminate={someSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>類型</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>角色/狀態</TableHead>
            <TableHead className="text-center">出席</TableHead>
            <TableHead>最後活動</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isSelected = selectedIds.has(member.id);
            const isRegistered = member.type === 'registered';
            
            return (
              <TableRow 
                key={member.id} 
                className={isSelected ? 'bg-muted/50' : ''}
              >
                <TableCell>
                  {!isRegistered && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(member.id)}
                      aria-label={`Select ${member.name}`}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={isRegistered ? 'default' : 'secondary'} className="text-xs">
                    {isRegistered ? '會員' : '潛在'}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {member.name}
                    {!member.subscribed && (
                      <BellOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email}
                </TableCell>
                <TableCell>
                  {isRegistered && member.role ? (
                    <Badge variant={roleConfig[member.role].variant} className="gap-1">
                      {roleConfig[member.role].icon}
                      {roleConfig[member.role].label}
                    </Badge>
                  ) : (
                    <Badge variant={statusConfig[member.status].variant}>
                      {statusConfig[member.status].label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">{member.sessions_count}</TableCell>
                <TableCell>
                  {member.last_session_at 
                    ? format(new Date(member.last_session_at), 'yyyy/MM/dd', { locale: zhTW })
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
