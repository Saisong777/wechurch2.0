import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePotentialMembers, useSimulateParticipant, type PotentialMember } from '@/hooks/usePotentialMembers';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ArrowLeft, Users } from 'lucide-react';
import { CRMStatsCards } from '@/components/admin/CRMStatsCards';
import { CRMMemberCard } from '@/components/admin/CRMMemberCard';
import { CRMMemberTable } from '@/components/admin/CRMMemberTable';
import { CRMFilters } from '@/components/admin/CRMFilters';
import { CRMBulkActions } from '@/components/admin/CRMBulkActions';
import { LinkUserDialog } from '@/components/admin/LinkUserDialog';
import { AuthForm } from '@/components/auth/AuthForm';
import { supabase } from '@/integrations/supabase/client';

const CRMPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isLeader, isAdmin, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  
  const [status, setStatus] = useState<'all' | 'pending' | 'member' | 'declined'>('all');
  const [subscribed, setSubscribed] = useState<'all' | boolean>('all');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const { 
    data, 
    isLoading, 
    isRefetching,
    stats, 
    statsLoading, 
    updateMember,
    bulkUpdateStatus,
    bulkUpdateSubscription,
    bulkDelete,
    deleteMember,
    linkUserManually,
    forceRefetch,
  } = usePotentialMembers({ status, subscribed });

  // Get active session for simulation
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const simulateParticipant = useSimulateParticipant();

  // Fetch active session on mount
  useState(() => {
    const fetchActiveSession = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setActiveSessionId(data.id);
      }
    };
    fetchActiveSession();
  });

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (!data?.members) return;
    const allIds = data.members.map(m => m.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handlers
  const handleBulkUpdateStatus = (newStatus: PotentialMember['status']) => {
    bulkUpdateStatus.mutate(
      { ids: Array.from(selectedIds), status: newStatus },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  const handleBulkUpdateSubscription = (newSubscribed: boolean) => {
    bulkUpdateSubscription.mutate(
      { ids: Array.from(selectedIds), subscribed: newSubscribed },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  // Single member handlers
  const handleUpdateStatus = (id: string, newStatus: PotentialMember['status']) => {
    updateMember.mutate({ id, updates: { status: newStatus } });
  };

  const handleToggleSubscription = (id: string, newSubscribed: boolean) => {
    updateMember.mutate({ id, updates: { subscribed: newSubscribed } });
  };

  const handleLinkUser = (id: string) => {
    setSelectedMemberId(id);
    setLinkDialogOpen(true);
  };

  const handleLinkConfirm = (memberId: string, userId: string) => {
    linkUserManually.mutate({ memberId, userId });
  };

  const handleDeleteClick = (id: string) => {
    setMemberToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      deleteMember.mutate(memberToDelete);
      setMemberToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleSimulate = () => {
    if (activeSessionId) {
      simulateParticipant.mutate(activeSessionId);
    }
  };

  const isUpdating = bulkUpdateStatus.isPending || bulkUpdateSubscription.isPending || bulkDelete.isPending;

  // Loading state
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Auth required
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-md mx-auto p-4 pt-8">
          <AuthForm onSuccess={() => {}} />
        </div>
      </div>
    );
  }

  // Permission check
  if (!isLeader) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">權限不足</h2>
            <p className="text-muted-foreground mb-4">
              只有領袖或管理員可以訪問會員管理系統
            </p>
            <Button onClick={() => navigate('/')}>返回首頁</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">會員管理 CRM</h1>
            <p className="text-sm text-muted-foreground">追蹤查經參與者</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <CRMStatsCards
          total={stats?.total ?? 0}
          converted={stats?.converted ?? 0}
          pending={stats?.pending ?? 0}
          avgAttendance={stats?.avgAttendance ?? 0}
          loading={statsLoading}
        />

        {/* Filters & Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">會員列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CRMFilters
              status={status}
              subscribed={subscribed}
              onStatusChange={setStatus}
              onSubscribedChange={setSubscribed}
              onRefresh={forceRefetch}
              members={data?.members ?? []}
              isRefreshing={isRefetching}
              onSimulate={activeSessionId ? handleSimulate : undefined}
              isSimulating={simulateParticipant.isPending}
            />

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <CRMBulkActions
                selectedCount={selectedIds.size}
                onClearSelection={handleClearSelection}
                onBulkUpdateStatus={handleBulkUpdateStatus}
                onBulkUpdateSubscription={handleBulkUpdateSubscription}
                onBulkDelete={handleBulkDelete}
                isUpdating={isUpdating}
              />
            )}

            {/* Member List */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : data?.members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>尚無會員資料</p>
                <p className="text-sm">參與者加入查經後會自動出現在這裡</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {data?.members.map((member) => (
                  <CRMMemberCard
                    key={member.id}
                    member={member}
                    isSelected={selectedIds.has(member.id)}
                    onToggleSelect={handleToggleSelect}
                    onUpdateStatus={handleUpdateStatus}
                    onToggleSubscription={handleToggleSubscription}
                    onLinkUser={handleLinkUser}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            ) : (
              <CRMMemberTable
                members={data?.members ?? []}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onUpdateStatus={handleUpdateStatus}
                onToggleSubscription={handleToggleSubscription}
                onLinkUser={handleLinkUser}
                onDelete={handleDeleteClick}
              />
            )}

            {/* Pagination info */}
            {data && data.totalCount > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                顯示 {data.members.length} / {data.totalCount} 筆
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Link User Dialog */}
      <LinkUserDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        memberId={selectedMemberId}
        onLink={handleLinkConfirm}
      />

      {/* Single Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將永久刪除該會員資料，無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CRMPage;
