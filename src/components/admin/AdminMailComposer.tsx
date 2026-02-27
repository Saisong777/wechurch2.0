import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { toast } from 'sonner';
import { Mail, Send, Loader2, Users, Search, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EmailUser {
  id: string;
  email: string;
  displayName: string | null;
  church: string | null;
  role: string;
}

type RecipientMode = 'all' | 'role' | 'church' | 'individual';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理員',
  leader: '小組長',
  future_leader: '儲備小組長',
  member: '會員',
};

interface AdminMailComposerProps {
  onBack: () => void;
}

export const AdminMailComposer: React.FC<AdminMailComposerProps> = ({ onBack }) => {
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedChurch, setSelectedChurch] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<EmailUser[]>({
    queryKey: ['/api/admin/users-for-email'],
  });

  const churches = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach(u => { if (u.church) set.add(u.church); });
    return Array.from(set).sort();
  }, [allUsers]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach(u => set.add(u.role));
    return Array.from(set).sort();
  }, [allUsers]);

  const recipients = useMemo((): EmailUser[] => {
    switch (recipientMode) {
      case 'all':
        return allUsers;
      case 'role':
        return selectedRole ? allUsers.filter(u => u.role === selectedRole) : [];
      case 'church':
        return selectedChurch ? allUsers.filter(u => u.church === selectedChurch) : [];
      case 'individual':
        return allUsers.filter(u => selectedUserIds.has(u.id));
      default:
        return [];
    }
  }, [recipientMode, allUsers, selectedRole, selectedChurch, selectedUserIds]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const q = searchQuery.toLowerCase();
    return allUsers.filter(u =>
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.church && u.church.toLowerCase().includes(q))
    );
  }, [allUsers, searchQuery]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const recipientList = recipients.map(u => ({
        email: u.email,
        name: u.displayName || undefined,
      }));
      const res = await apiRequest('POST', '/api/send-bulk-email', {
        recipients: recipientList,
        subject,
        body,
        isHtml: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSendResult({ sent: data.sent, failed: data.failed });
      if (data.failed === 0) {
        toast.success(`成功寄出 ${data.sent} 封郵件`);
      } else {
        toast.warning(`寄出 ${data.sent} 封，失敗 ${data.failed} 封`);
      }
    },
    onError: (error: any) => {
      toast.error('寄送失敗', { description: error.message });
    },
  });

  const handleSend = () => {
    if (recipients.length === 0) {
      toast.error('請選擇收件人');
      return;
    }
    if (!subject.trim()) {
      toast.error('請輸入郵件主旨');
      return;
    }
    if (!body.trim() || body === '<p></p>') {
      toast.error('請輸入郵件內容');
      return;
    }
    sendMutation.mutate();
  };

  const handleReset = () => {
    setSubject('');
    setBody('');
    setRecipientMode('all');
    setSelectedRole('');
    setSelectedChurch('');
    setSelectedUserIds(new Set());
    setSearchQuery('');
    setSendResult(null);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      filteredUsers.forEach(u => next.add(u.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      filteredUsers.forEach(u => next.delete(u.id));
      return next;
    });
  };

  if (sendResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h3 className="text-xl font-semibold">郵件已寄出</h3>
            <div className="flex justify-center gap-4">
              <Badge variant="default" className="text-base px-3 py-1">成功 {sendResult.sent} 封</Badge>
              {sendResult.failed > 0 && (
                <Badge variant="destructive" className="text-base px-3 py-1">失敗 {sendResult.failed} 封</Badge>
              )}
            </div>
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={onBack} data-testid="button-back-to-dashboard">
                返回管理台
              </Button>
              <Button onClick={handleReset} data-testid="button-compose-new">
                撰寫新郵件
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-mail-back">
          <ChevronLeft className="w-4 h-4" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold font-display">信件系統</h2>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">收件人</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ['all', '全部', <Users key="all" className="w-3.5 h-3.5" />],
              ['role', '按角色', null],
              ['church', '按教會', null],
              ['individual', '個人', null],
            ] as [RecipientMode, string, React.ReactNode | null][]).map(([mode, label, icon]) => (
              <Button
                key={mode}
                variant={recipientMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRecipientMode(mode);
                  setSendResult(null);
                }}
                data-testid={`button-recipient-${mode}`}
              >
                {icon}
                {label}
              </Button>
            ))}
          </div>

          {recipientMode === 'role' && (
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="選擇角色" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {recipientMode === 'church' && (
            <Select value={selectedChurch} onValueChange={setSelectedChurch}>
              <SelectTrigger data-testid="select-church">
                <SelectValue placeholder="選擇教會" />
              </SelectTrigger>
              <SelectContent>
                {churches.length === 0 ? (
                  <SelectItem value="_none" disabled>尚無教會資料</SelectItem>
                ) : (
                  churches.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          {recipientMode === 'individual' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋姓名、Email 或教會..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-users"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAllFiltered} data-testid="button-select-all">
                  全選
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllFiltered} data-testid="button-deselect-all">
                  取消
                </Button>
              </div>
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {usersLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">找不到使用者</p>
                  ) : (
                    filteredUsers.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                        data-testid={`user-row-${u.id}`}
                      >
                        <Checkbox
                          checked={selectedUserIds.has(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                        />
                        <span className="text-sm truncate flex-1">
                          {u.displayName || u.email}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-32">
                          {u.displayName ? u.email : ''}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span data-testid="text-recipient-count">
              {usersLoading ? '載入中...' : `將寄給 ${recipients.length} 人`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">郵件內容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-subject">主旨</Label>
            <Input
              id="email-subject"
              placeholder="輸入郵件主旨..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-2">
            <Label>內容</Label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="撰寫郵件內容..."
              minHeight="200px"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={onBack} data-testid="button-cancel-email">
          取消
        </Button>
        <Button
          onClick={handleSend}
          disabled={sendMutation.isPending || recipients.length === 0}
          className="gap-2"
          data-testid="button-send-email"
        >
          {sendMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              寄送中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              寄出郵件
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
