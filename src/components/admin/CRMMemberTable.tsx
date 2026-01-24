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
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserCheck, Bell, BellOff, Link2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { PotentialMember } from '@/hooks/usePotentialMembers';

interface CRMMemberTableProps {
  members: PotentialMember[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onUpdateStatus: (id: string, status: PotentialMember['status']) => void;
  onToggleSubscription: (id: string, subscribed: boolean) => void;
  onLinkUser: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CRMMemberTable = ({ 
  members, 
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateStatus,
  onToggleSubscription,
  onLinkUser,
  onDelete,
}: CRMMemberTableProps) => {
  const statusConfig = {
    pending: { label: '待跟進', variant: 'secondary' as const },
    member: { label: '會員', variant: 'default' as const },
    declined: { label: '已婉拒', variant: 'outline' as const },
  };

  const allSelected = members.length > 0 && members.every(m => selectedIds.has(m.id));
  const someSelected = members.some(m => selectedIds.has(m.id)) && !allSelected;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                // @ts-ignore - indeterminate is valid but not typed
                indeterminate={someSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="text-center">出席次數</TableHead>
            <TableHead>最後出席</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const status = statusConfig[member.status];
            const isSelected = selectedIds.has(member.id);
            return (
              <TableRow 
                key={member.id} 
                className={isSelected ? 'bg-muted/50' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(member.id)}
                    aria-label={`Select ${member.name}`}
                  />
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
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-center">{member.sessions_count}</TableCell>
                <TableCell>
                  {format(new Date(member.last_session_at), 'yyyy/MM/dd', { locale: zhTW })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(member.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        刪除
                      </DropdownMenuItem>
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
