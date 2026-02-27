import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Inbox, Mail, MailOpen, Archive, ArchiveRestore,
  ChevronLeft, Search, Loader2, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import DOMPurify from 'dompurify';

interface InboxEmail {
  id: number;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  isRead: boolean;
  isArchived: boolean;
  resendEmailId: string | null;
  receivedAt: string;
}

interface AdminInboxProps {
  onBack: () => void;
}

export function AdminInbox({ onBack }: AdminInboxProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);

  const { data: emails = [], isLoading, refetch } = useQuery<InboxEmail[]>({
    queryKey: ['/api/admin/inbox', showArchived],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/inbox?archived=${showArchived}`);
      return res.json();
    },
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/inbox/unread-count'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/inbox/unread-count');
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      await apiRequest('PATCH', `/api/admin/inbox/${id}/read`, { isRead });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inbox/unread-count'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: number; isArchived: boolean }) => {
      await apiRequest('PATCH', `/api/admin/inbox/${id}/archive`, { isArchived });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inbox/unread-count'] });
      if (selectedEmail) {
        setSelectedEmail(null);
      }
      toast.success(showArchived ? '已還原' : '已封存');
    },
  });

  const handleSelectEmail = (email: InboxEmail) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      markReadMutation.mutate({ id: email.id, isRead: true });
    }
  };

  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.fromEmail.toLowerCase().includes(q) ||
      (email.fromName?.toLowerCase().includes(q)) ||
      (email.subject?.toLowerCase().includes(q))
    );
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (selectedEmail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)} data-testid="button-back-to-list">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回收件匣
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => markReadMutation.mutate({ id: selectedEmail.id, isRead: !selectedEmail.isRead })}
            data-testid="button-toggle-read"
          >
            {selectedEmail.isRead ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {selectedEmail.isRead ? '標為未讀' : '標為已讀'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveMutation.mutate({ id: selectedEmail.id, isArchived: !selectedEmail.isArchived })}
            data-testid="button-archive-email"
          >
            {selectedEmail.isArchived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
            {selectedEmail.isArchived ? '還原' : '封存'}
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-email-subject">{selectedEmail.subject || '(無主旨)'}</h2>
              <div className="text-sm text-muted-foreground mt-1" data-testid="text-email-date">
                {formatFullDate(selectedEmail.receivedAt)}
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 text-sm">
              <div>
                <span className="text-muted-foreground">寄件人：</span>
                <span className="font-medium" data-testid="text-email-from">
                  {selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.fromEmail}>` : selectedEmail.fromEmail}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">收件人：</span>
                <span data-testid="text-email-to">{selectedEmail.toEmail}</span>
              </div>
            </div>
            <Separator />
            <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="text-email-body">
              {selectedEmail.bodyHtml ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.bodyHtml) }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">{selectedEmail.bodyText || '(無內容)'}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-dashboard">
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">收件匣</h2>
          {(unreadData?.count ?? 0) > 0 && (
            <Badge variant="destructive" className="text-xs" data-testid="badge-unread-count">
              {unreadData!.count}
            </Badge>
          )}
        </div>
        <div className="flex-1" />
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => { setShowArchived(!showArchived); setSearchQuery(''); }}
          data-testid="button-toggle-archived"
        >
          <Archive className="w-4 h-4 mr-1" />
          {showArchived ? '查看收件匣' : '已封存'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-inbox">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜尋寄件人或主旨..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-inbox"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{showArchived ? '沒有已封存的郵件' : searchQuery ? '找不到符合的郵件' : '收件匣是空的'}</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-1">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-colors cursor-pointer ${
                  email.isRead
                    ? 'bg-card hover:bg-accent/50 border-border/50'
                    : 'bg-primary/5 hover:bg-primary/10 border-primary/20 font-medium'
                }`}
                data-testid={`inbox-email-${email.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0">
                    {email.isRead ? (
                      <MailOpen className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Mail className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : ''}`} data-testid={`text-from-${email.id}`}>
                        {email.fromName || email.fromEmail}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0" data-testid={`text-date-${email.id}`}>
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                    <div className={`text-sm truncate mt-0.5 ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {email.subject || '(無主旨)'}
                    </div>
                    {email.bodyText && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {email.bodyText.substring(0, 80)}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
