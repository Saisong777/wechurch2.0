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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserCheck, Bell, BellOff, Link2, Trash2, Shield, Crown, Star, Users, Church, Copy } from 'lucide-react';
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
  onAssignGroup?: (member: UnifiedMember, groupId: string) => void;
  onUpdateChurch?: (member: UnifiedMember, church: string) => void;
  onLinkUser: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyEmail?: (member: UnifiedMember) => void;
  isAdmin: boolean;
  groups?: Array<{ id: string; name: string; church: string; memberCount?: number }>;
  churches?: Array<{ id: string; name: string }>;
  groupsLoading?: boolean;
}

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  admin: { label: '系統管理員', variant: 'destructive', icon: <Shield className="w-3 h-3" /> },
  senior_pastor: { label: '主任牧師', variant: 'destructive', icon: <Crown className="w-3 h-3" /> },
  pastor: { label: '牧師', variant: 'default', icon: <UserCheck className="w-3 h-3" /> },
  minister: { label: '傳道人', variant: 'secondary', icon: <Star className="w-3 h-3" /> },
  group_leader: { label: '小組長', variant: 'default', icon: <Crown className="w-3 h-3" /> },
  leader: { label: '小組長', variant: 'default', icon: <Crown className="w-3 h-3" /> },
  future_leader: { label: '儲備領袖', variant: 'secondary', icon: <Star className="w-3 h-3" /> },
  member: { label: '會友', variant: 'outline', icon: <Users className="w-3 h-3" /> },
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
  onAssignGroup,
  onUpdateChurch,
  onLinkUser,
  onDelete,
  onCopyEmail,
  isAdmin,
  groups = [],
  churches = [],
  groupsLoading = false,
}: UnifiedMemberTableProps) => {
  const selectableMembers = members.filter(m => m.type === 'potential');
  const allSelected = selectableMembers.length > 0 && selectableMembers.every(m => selectedIds.has(m.id));
  const someSelected = selectableMembers.some(m => selectedIds.has(m.id)) && !allSelected;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={onToggleSelectAll}
                disabled={!selectableMembers.length}
                aria-label="選取本頁潛在會員"
              />
            </TableHead>
            <TableHead>類型</TableHead>
            <TableHead>會員 / Email</TableHead>
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
                data-state={isSelected ? 'selected' : undefined}
              >
                <TableCell>
                  {!isRegistered && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(member.id)}
                      aria-label={`選取 ${member.name}`}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={isRegistered ? 'default' : 'secondary'} className="text-xs">
                    {isRegistered ? '會員' : '潛在'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[360px]">
                  <div className="flex items-center gap-2 break-words font-medium">
                    {member.name}
                    {!member.subscribed && (
                      <BellOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{member.email || '未提供 Email'}</p>
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
                <TableCell className="text-center">{member.sessionsCount}</TableCell>
                <TableCell>
                  {member.lastSessionAt 
                    ? format(new Date(member.lastSessionAt), 'yyyy/MM/dd', { locale: zhTW })
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`${member.name} 的操作`} title="會員操作">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!member.email} onClick={() => onCopyEmail?.(member)}>
                        <Copy className="mr-2 h-4 w-4" />複製 Email
                      </DropdownMenuItem>
                      {isRegistered && member.userId && isAdmin && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger><Shield className="mr-2 h-4 w-4" />變更角色</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                          <DropdownMenuItem 
                            onClick={() => onUpdateRole(member.userId!, 'admin')}
                            disabled={member.role === 'admin'}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            設為系統管理員
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateRole(member.userId!, 'senior_pastor')}
                            disabled={member.role === 'senior_pastor'}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            設為主任牧師
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateRole(member.userId!, 'pastor')}
                            disabled={member.role === 'pastor'}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            設為牧師
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateRole(member.userId!, 'minister')}
                            disabled={member.role === 'minister'}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            設為傳道人
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onUpdateRole(member.userId!, 'group_leader')}
                            disabled={member.role === 'group_leader' || member.role === 'leader'}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            設為小組長
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onUpdateRole(member.userId!, 'future_leader')}
                            disabled={member.role === 'future_leader'}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            設為儲備
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onUpdateRole(member.userId!, 'member')}
                            disabled={member.role === 'member'}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            設為一般成員
                          </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      
                      {!isRegistered && (
                        <>
                          <DropdownMenuLabel>變更狀態</DropdownMenuLabel>
                          {member.status === 'pending' && (
                            <DropdownMenuItem onClick={() => onUpdateStatus(member.potentialMemberId!, 'member')}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              標記為已轉換
                            </DropdownMenuItem>
                          )}
                          {member.status === 'member' && (
                            <DropdownMenuItem onClick={() => onUpdateStatus(member.potentialMemberId!, 'pending')}>
                              標記為待跟進
                            </DropdownMenuItem>
                          )}
                          {member.status !== 'declined' && (
                            <DropdownMenuItem onClick={() => onUpdateStatus(member.potentialMemberId!, 'declined')}>
                              標記為已婉拒
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                        </>
                      )}

                      {member.potentialMemberId && (
                        <DropdownMenuItem 
                          onClick={() => onToggleSubscription(member.potentialMemberId!, !member.subscribed)}
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

                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Users className="h-4 w-4 mr-2" />
                              分到小組
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                              {groupsLoading ? (
                                <DropdownMenuItem disabled>讀取小組中</DropdownMenuItem>
                              ) : groups.length === 0 ? (
                                <DropdownMenuItem disabled>尚無小組</DropdownMenuItem>
                              ) : (
                                groups.map((group) => (
                                  <DropdownMenuItem key={group.id} onClick={() => onAssignGroup?.(member, group.id)}>
                                    {group.name}
                                    <span className="ml-2 text-xs text-muted-foreground">{group.church}</span>
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Church className="h-4 w-4 mr-2" />
                              調整教會
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {churches.length === 0 ? (
                                <DropdownMenuItem disabled>尚無教會選項</DropdownMenuItem>
                              ) : (
                                churches.map((church) => (
                                  <DropdownMenuItem key={church.id} onClick={() => onUpdateChurch?.(member, church.id)}>
                                    {church.name}
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}

                      {!isRegistered && !member.userId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled onClick={() => onLinkUser(member.potentialMemberId!)}>
                            <Link2 className="h-4 w-4 mr-2" />
                            手動連結用戶（尚未開放）
                          </DropdownMenuItem>
                        </>
                      )}

                      {!isRegistered && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onDelete(member.potentialMemberId!)}
                            disabled={!isAdmin}
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
