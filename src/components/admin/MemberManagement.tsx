import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Loader2, MoreHorizontal, Shield, Users, Crown, Star, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AppRole } from '@/hooks/useUserRole';

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
}

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  admin: { label: '管理員 Admin', variant: 'destructive', icon: <Shield className="w-3 h-3" /> },
  leader: { label: '小組長 Leader', variant: 'default', icon: <Crown className="w-3 h-3" /> },
  future_leader: { label: '儲備小組長', variant: 'secondary', icon: <Star className="w-3 h-3" /> },
  member: { label: '成員 Member', variant: 'outline', icon: <Users className="w-3 h-3" /> },
};

export const MemberManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, email, display_name, created_at');

      if (profileError) throw profileError;

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (roleError) throw roleError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email || 'N/A',
          display_name: profile.display_name,
          role: (userRole?.role as AppRole) || 'member',
          created_at: profile.created_at,
        };
      });

      // Sort by role hierarchy, then by name
      usersWithRoles.sort((a, b) => {
        const roleOrder = { admin: 0, leader: 1, future_leader: 2, member: 3 };
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role];
        }
        return (a.display_name || a.email).localeCompare(b.display_name || b.email);
      });

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('[MemberManagement] Error fetching users:', err);
      toast.error('無法載入使用者列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);

    try {
      // Check if role exists for this user
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast.success(`角色已更新為 ${roleConfig[newRole].label}`);
      await fetchUsers();
    } catch (err: any) {
      console.error('[MemberManagement] Error updating role:', err);
      toast.error('更新角色失敗', {
        description: err.message || 'Unknown error',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          會員管理 Member Management
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchUsers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重新整理
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱 Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>角色 Role</TableHead>
                <TableHead>加入日期</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    尚無註冊使用者
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.display_name || user.email.split('@')[0]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleConfig[user.role].variant} className="gap-1">
                        {roleConfig[user.role].icon}
                        {roleConfig[user.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'yyyy/MM/dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      {updatingUserId === user.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.user_id, 'admin')}
                              disabled={user.role === 'admin'}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              設為管理員
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.user_id, 'leader')}
                              disabled={user.role === 'leader'}
                            >
                              <Crown className="w-4 h-4 mr-2" />
                              設為小組長
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.user_id, 'future_leader')}
                              disabled={user.role === 'future_leader'}
                            >
                              <Star className="w-4 h-4 mr-2" />
                              設為儲備小組長
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.user_id, 'member')}
                              disabled={user.role === 'member'}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              設為一般成員
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          共 {users.length} 位註冊使用者 ・ 
          管理員: {users.filter(u => u.role === 'admin').length} ・ 
          小組長: {users.filter(u => u.role === 'leader').length} ・ 
          儲備: {users.filter(u => u.role === 'future_leader').length}
        </p>
      </CardContent>
    </Card>
  );
};
