import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { X, ChevronDown, UserCheck, Bell, BellOff, Trash2, Clock, UserX } from 'lucide-react';
import type { PotentialMember } from '@/hooks/useUnifiedMembers';

interface CRMBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUpdateStatus: (status: PotentialMember['status']) => void;
  onBulkUpdateSubscription: (subscribed: boolean) => void;
  onBulkDelete: () => void;
  isUpdating?: boolean;
}

export const CRMBulkActions = ({
  selectedCount,
  onClearSelection,
  onBulkUpdateStatus,
  onBulkUpdateSubscription,
  onBulkDelete,
  isUpdating,
}: CRMBulkActionsProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    onBulkDelete();
  };

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          已選擇 {selectedCount} 項
        </span>
        <div className="flex-1" />
        
        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isUpdating}>
              更改狀態
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('member')}>
              <UserCheck className="h-4 w-4 mr-2" />
              標記為會員
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('pending')}>
              <Clock className="h-4 w-4 mr-2" />
              標記為待跟進
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('declined')}>
              <UserX className="h-4 w-4 mr-2" />
              標記為已婉拒
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Subscription Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isUpdating}>
              訂閱設定
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onBulkUpdateSubscription(true)}>
              <Bell className="h-4 w-4 mr-2" />
              啟用訂閱
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkUpdateSubscription(false)}>
              <BellOff className="h-4 w-4 mr-2" />
              取消訂閱
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete Button */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isUpdating}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          刪除
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              您即將刪除 {selectedCount} 筆會員資料。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
