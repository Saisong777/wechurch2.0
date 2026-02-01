import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, FileDown, Send, Copy, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';

interface Download {
  id: string;
  card_id: string;
  user_name: string;
  user_email: string;
  downloaded_at: string;
}

interface DownloadRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardTitle: string;
  downloads: Download[];
  loading: boolean;
}

export const DownloadRecordsDialog: React.FC<DownloadRecordsDialogProps> = ({
  open,
  onOpenChange,
  cardTitle,
  downloads,
  loading,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<{ name: string; email: string }[]>([]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === downloads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(downloads.map(d => d.id)));
    }
  };

  const handleSendToSelected = () => {
    const recipients = downloads
      .filter(d => selectedIds.has(d.id))
      .map(d => ({ name: d.user_name, email: d.user_email }));
    
    if (recipients.length === 0) {
      toast.error('請先選擇收件人');
      return;
    }
    
    setEmailRecipients(recipients);
    setEmailSubject(`${cardTitle} - 信息通知`);
    setEmailBody('');
    setShowEmailDialog(true);
  };

  const handleSendToOne = (download: Download) => {
    setEmailRecipients([{ name: download.user_name, email: download.user_email }]);
    setEmailSubject(`${cardTitle} - 信息通知`);
    setEmailBody('');
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('請填寫主旨和內容');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-bulk-notification', {
        body: {
          recipients: emailRecipients,
          subject: emailSubject,
          body: emailBody,
        },
      });

      if (error) throw error;

      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      const errors = (data as any)?.errors as Array<{ email: string; error: string }> | undefined;

      if (sent === 0 && failed > 0) {
        toast.error(`全部發送失敗（${failed}）`);
      } else if (failed > 0) {
        const first = errors?.[0];
        toast.warning(`已發送 ${sent} 封，失敗 ${failed} 封${first ? `（例：${first.email}：${first.error}）` : ''}`);
      } else {
        toast.success(`已發送 ${sent || emailRecipients.length} 封郵件`);
      }

      setShowEmailDialog(false);
      setEmailSubject('');
      setEmailBody('');
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('發送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  const handleExportCSV = () => {
    const selectedDownloads = selectedIds.size > 0 
      ? downloads.filter(d => selectedIds.has(d.id))
      : downloads;
    
    const headers = ['序號', '姓名', 'Email', '下載時間'];
    const rows = selectedDownloads.map((d, index) => [
      index + 1,
      d.user_name,
      d.user_email,
      format(new Date(d.downloaded_at), 'yyyy/MM/dd HH:mm'),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cardTitle}_下載名單_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`已匯出 ${selectedDownloads.length} 筆資料`);
  };

  const handleCopyEmails = () => {
    const selectedDownloads = selectedIds.size > 0 
      ? downloads.filter(d => selectedIds.has(d.id))
      : downloads;
    
    const emails = selectedDownloads.map(d => d.user_email).join(', ');
    navigator.clipboard.writeText(emails);
    toast.success(`已複製 ${selectedDownloads.length} 個 Email`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>下載記錄 - {cardTitle}</span>
              {downloads.length > 0 && (
                <Badge variant="secondary">共 {downloads.length} 人</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : downloads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無下載記錄
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap border-b pb-3">
                <span className="text-sm text-muted-foreground">
                  已選擇 {selectedIds.size} 人
                </span>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmails}
                  disabled={downloads.length === 0}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  複製 Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={downloads.length === 0}
                >
                  <FileDown className="w-4 h-4 mr-1" />
                  匯出 CSV
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleSendToSelected}
                  disabled={selectedIds.size === 0}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  發信 ({selectedIds.size})
                </Button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === downloads.length && downloads.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="全選"
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloads.map((d, index) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(d.id)}
                            onCheckedChange={() => toggleSelect(d.id)}
                            aria-label={`選擇 ${d.user_name}`}
                          />
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{d.user_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {d.user_email}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(d.downloaded_at), 'MM/dd HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSendToOne(d)}
                            title="發送郵件"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>發送郵件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">收件人</p>
              <p className="text-sm font-medium">
                {emailRecipients.length === 1 
                  ? `${emailRecipients[0].name} <${emailRecipients[0].email}>`
                  : `${emailRecipients.length} 位收件人`
                }
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-subject">主旨</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="郵件主旨"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-body">內容</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="輸入郵件內容..."
                rows={6}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEmailDialog(false)}
              >
                取消
              </Button>
              <Button
                variant="gold"
                className="flex-1"
                onClick={handleSendEmail}
                disabled={sending || !emailSubject.trim() || !emailBody.trim()}
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />發送中...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />發送</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
