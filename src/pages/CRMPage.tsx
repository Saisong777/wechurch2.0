import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { useUnifiedMembers, useSimulateParticipant, PotentialMember } from '@/hooks/useUnifiedMembers';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Users, RefreshCw, Copy, FlaskConical, UserCheck, Clock } from 'lucide-react';
import { UnifiedStatsCards } from '@/components/admin/UnifiedStatsCards';
import { UnifiedMemberCard } from '@/components/admin/UnifiedMemberCard';
import { UnifiedMemberTable } from '@/components/admin/UnifiedMemberTable';
import { CRMBulkActions } from '@/components/admin/CRMBulkActions';
import { LinkUserDialog } from '@/components/admin/LinkUserDialog';
import { AuthForm } from '@/components/auth/AuthForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CRMPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isLeader, isAdmin, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  
  const [tab, setTab] = useState<'all' | 'registered' | 'potential'>('all');
  const [status, setStatus] = useState<'all' | 'pending' | 'member' | 'declined'>('all');
  const [role, setRole] = useState<AppRole | 'all'>('all');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const { 
    data: members, 
    isLoading, 
    isRefetching,
    stats, 
    statsLoading, 
    updateRole,
    updatePotentialMember,
    bulkUpdateStatus,
    bulkUpdateSubscription,
    bulkDelete,
    deleteMember,
    linkUserManually,
    forceRefetch,
  } = useUnifiedMembers({ tab, status, role });

  // Get active session for simulation
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const simulateParticipant = useSimulateParticipant();

  useEffect(() => {
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
  }, []);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

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
    if (!members) return;
    const selectableIds = members.filter(m => m.type === 'potential').map(m => m.id);
    const allSelected = selectableIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handlers
  const handleBulkUpdateStatus = (newStatus: PotentialMember['status']) => {
    // Get potential_member_ids from selected unified members
    const pmIds = members
      ?.filter(m => selectedIds.has(m.id) && m.potential_member_id)
      .map(m => m.potential_member_id!) || [];
    
    bulkUpdateStatus.mutate(
      { ids: pmIds, status: newStatus },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  const handleBulkUpdateSubscription = (newSubscribed: boolean) => {
    const pmIds = members
      ?.filter(m => selectedIds.has(m.id) && m.potential_member_id)
      .map(m => m.potential_member_id!) || [];
    
    bulkUpdateSubscription.mutate(
      { ids: pmIds, subscribed: newSubscribed },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  const handleBulkDelete = () => {
    const pmIds = members
      ?.filter(m => selectedIds.has(m.id) && m.potential_member_id)
      .map(m => m.potential_member_id!) || [];
    
    bulkDelete.mutate(pmIds, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  // Single member handlers
  const handleUpdateRole = (userId: string, newRole: AppRole) => {
    updateRole.mutate({ userId, newRole });
  };

  const handleUpdateStatus = (id: string, newStatus: PotentialMember['status']) => {
    updatePotentialMember.mutate({ id, updates: { status: newStatus } });
  };

  const handleToggleSubscription = (id: string, newSubscribed: boolean) => {
    updatePotentialMember.mutate({ id, updates: { subscribed: newSubscribed } });
  };

  const handleLinkUser = (id: string) => {
    setSelectedMemberId(id);
    setLinkDialogOpen(true);
  };

  const handleLinkConfirm = (potentialMemberId: string, userId: string) => {
    linkUserManually.mutate({ potentialMemberId, userId });
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

  const handleCopyEmails = () => {
    const emails = members
      ?.filter(m => m.type === 'potential' && m.subscribed)
      .map(m => m.email)
      .join(', ') || '';
    
    if (emails) {
      navigator.clipboard.writeText(emails);
      toast.success(`已複製 ${emails.split(',').length} 個 Email`);
    } else {
      toast.info('沒有可複製的 Email');
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
            <h1 className="text-lg font-semibold">會員管理系統</h1>
            <p className="text-sm text-muted-foreground">統一管理會員與潛在會員</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <UnifiedStatsCards
          registeredCount={stats?.registeredCount ?? 0}
          adminCount={stats?.adminCount ?? 0}
          leaderCount={stats?.leaderCount ?? 0}
          potentialTotal={stats?.potentialTotal ?? 0}
          linkedCount={stats?.linkedCount ?? 0}
          pendingCount={stats?.pendingCount ?? 0}
          avgAttendance={stats?.avgAttendance ?? 0}
          loading={statsLoading}
        />

        {/* Tabs & Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                  <TabsTrigger value="all" className="gap-2">
                    <Users className="h-4 w-4" />
                    全部
                  </TabsTrigger>
                  <TabsTrigger value="registered" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    已註冊
                  </TabsTrigger>
                  <TabsTrigger value="potential" className="gap-2">
                    <Clock className="h-4 w-4" />
                    潛在會員
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex gap-2">
                {activeSessionId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSimulate}
                    disabled={simulateParticipant.isPending}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    模擬
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCopyEmails}>
                  <Copy className="h-4 w-4 mr-2" />
                  複製 Email
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={forceRefetch}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-wrap gap-2">
              {(tab === 'all' || tab === 'registered') && isAdmin && (
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部角色</SelectItem>
                    <SelectItem value="admin">管理員</SelectItem>
                    <SelectItem value="leader">小組長</SelectItem>
                    <SelectItem value="future_leader">儲備</SelectItem>
                    <SelectItem value="member">成員</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {(tab === 'all' || tab === 'potential') && (
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    <SelectItem value="pending">待跟進</SelectItem>
                    <SelectItem value="member">已轉換</SelectItem>
                    <SelectItem value="declined">已婉拒</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

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
            ) : !members || members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>尚無會員資料</p>
                <p className="text-sm">參與者加入查經後會自動出現在這裡</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {members.map((member) => (
                  <UnifiedMemberCard
                    key={member.id}
                    member={member}
                    isSelected={selectedIds.has(member.id)}
                    onToggleSelect={handleToggleSelect}
                    onUpdateRole={handleUpdateRole}
                    onUpdateStatus={handleUpdateStatus}
                    onToggleSubscription={handleToggleSubscription}
                    onLinkUser={handleLinkUser}
                    onDelete={handleDeleteClick}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            ) : (
              <UnifiedMemberTable
                members={members}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onUpdateRole={handleUpdateRole}
                onUpdateStatus={handleUpdateStatus}
                onToggleSubscription={handleToggleSubscription}
                onLinkUser={handleLinkUser}
                onDelete={handleDeleteClick}
                isAdmin={isAdmin}
              />
            )}

            {/* Count info */}
            {members && members.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                顯示 {members.length} 筆資料
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
