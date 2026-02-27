import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, Mail, FileDown, Send, Copy, Paperclip, X, Image, File, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface Download {
  id: string;
  cardId: string;
  userName: string;
  userEmail: string;
  downloadedAt: string;
}

interface GroupedDownload {
  email: string;
  name: string;
  downloadCount: number;
  lastDownloadAt: string;
  downloads: Download[];
}

interface Attachment {
  file: File;
  url?: string;
  path?: string;
  uploading?: boolean;
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
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<{ name: string; email: string }[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group downloads by email
  const groupedDownloads = useMemo(() => {
    const grouped = new Map<string, GroupedDownload>();
    
    for (const download of downloads) {
      const email = download.userEmail.toLowerCase();
      const existing = grouped.get(email);
      
      if (existing) {
        existing.downloadCount++;
        existing.downloads.push(download);
        // Update last download time if this one is more recent
        if (new Date(download.downloadedAt) > new Date(existing.lastDownloadAt)) {
          existing.lastDownloadAt = download.downloadedAt;
          existing.name = download.userName; // Use most recent name
        }
      } else {
        grouped.set(email, {
          email: download.userEmail,
          name: download.userName,
          downloadCount: 1,
          lastDownloadAt: download.downloadedAt,
          downloads: [download],
        });
      }
    }
    
    // Sort by last download time (most recent first)
    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.lastDownloadAt).getTime() - new Date(a.lastDownloadAt).getTime()
    );
  }, [downloads]);

  // Calculate unique user count
  const uniqueUserCount = groupedDownloads.length;

  const toggleSelect = (email: string) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedEmails(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === groupedDownloads.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(groupedDownloads.map(g => g.email.toLowerCase())));
    }
  };

  const handleSendToSelected = () => {
    const recipients = groupedDownloads
      .filter(g => selectedEmails.has(g.email.toLowerCase()))
      .map(g => ({ name: g.name, email: g.email }));
    
    if (recipients.length === 0) {
      toast.error('請先選擇收件人');
      return;
    }
    
    setEmailRecipients(recipients);
    setEmailSubject(`${cardTitle} - 信息通知`);
    setEmailBody('');
    setAttachments([]);
    setShowEmailDialog(true);
  };

  const handleSendToOne = (grouped: GroupedDownload) => {
    setEmailRecipients([{ name: grouped.name, email: grouped.email }]);
    setEmailSubject(`${cardTitle} - 信息通知`);
    setEmailBody('');
    setAttachments([]);
    setShowEmailDialog(true);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超過 10MB 限制`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const attachment: Attachment = { 
          file, 
          uploading: false,
          url: base64,
          path: file.name 
        };
        newAttachments.push(attachment);
      } catch {
        toast.error(`無法讀取 ${file.name}`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    setAttachments(prev => prev.filter(a => a !== attachment));
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('請填寫主旨和內容');
      return;
    }

    // Check if any attachments are still uploading
    if (attachments.some(a => a.uploading)) {
      toast.error('請等待附件上傳完成');
      return;
    }

    setSending(true);
    try {
      const attachmentData = attachments
        .filter(a => a.url)
        .map(a => ({
          filename: a.file.name,
          content: a.url,
        }));

      // TODO: Migrate email sending to API endpoint
      // For now, show a message that this feature requires email service setup
      const response = await fetch('/api/send-bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipients: emailRecipients,
          subject: emailSubject,
          body: emailBody,
          isHtml: true,
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '發送失敗');
      }

      const data = await response.json();

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
      setAttachments([]);
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('發送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  const handleExportCSV = () => {
    const selectedGrouped = selectedEmails.size > 0 
      ? groupedDownloads.filter(g => selectedEmails.has(g.email.toLowerCase()))
      : groupedDownloads;
    
    const headers = ['序號', '姓名', 'Email', '下載次數', '最後下載時間'];
    const rows = selectedGrouped.map((g, index) => [
      index + 1,
      g.name,
      g.email,
      g.downloadCount,
      format(new Date(g.lastDownloadAt), 'yyyy/MM/dd HH:mm'),
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
    
    toast.success(`已匯出 ${selectedGrouped.length} 筆資料`);
  };

  const handleCopyEmails = () => {
    const selectedGrouped = selectedEmails.size > 0 
      ? groupedDownloads.filter(g => selectedEmails.has(g.email.toLowerCase()))
      : groupedDownloads;
    
    const emails = selectedGrouped.map(g => g.email).join(', ');
    navigator.clipboard.writeText(emails);
    toast.success(`已複製 ${selectedGrouped.length} 個 Email`);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>下載記錄 - {cardTitle}</span>
              <div className="flex items-center gap-2">
                {downloads.length > 0 && (
                  <>
                    <Badge variant="secondary">
                      {uniqueUserCount} 人
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      共 {downloads.length} 次
                    </Badge>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : groupedDownloads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無下載記錄
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap border-b pb-3">
                <span className="text-sm text-muted-foreground">
                  已選擇 {selectedEmails.size} 人
                </span>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmails}
                  disabled={groupedDownloads.length === 0}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  複製 Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={groupedDownloads.length === 0}
                >
                  <FileDown className="w-4 h-4 mr-1" />
                  匯出 CSV
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleSendToSelected}
                  disabled={selectedEmails.size === 0}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  發信 ({selectedEmails.size})
                </Button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedEmails.size === groupedDownloads.length && groupedDownloads.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="全選"
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-20 text-center">次數</TableHead>
                      <TableHead>最後下載</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedDownloads.map((g, index) => (
                      <TableRow key={g.email}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEmails.has(g.email.toLowerCase())}
                            onCheckedChange={() => toggleSelect(g.email.toLowerCase())}
                            aria-label={`選擇 ${g.name}`}
                          />
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {g.email}
                        </TableCell>
                        <TableCell className="text-center">
                          {g.downloadCount === 1 ? (
                            <span className="text-muted-foreground">1</span>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-primary hover:text-primary/80"
                                >
                                  {g.downloadCount}
                                  <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="center">
                                <div className="p-3 border-b">
                                  <p className="text-sm font-medium">下載時間記錄</p>
                                  <p className="text-xs text-muted-foreground">{g.name} 共下載 {g.downloadCount} 次</p>
                                </div>
                                <div className="max-h-48 overflow-auto p-2">
                                  {g.downloads
                                    .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())
                                    .map((d, i) => (
                                      <div 
                                        key={d.id}
                                        className="flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted/50 rounded"
                                      >
                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">#{g.downloadCount - i}</span>
                                        <span>
                                          {format(new Date(d.downloadedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(g.lastDownloadAt), 'MM/dd HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSendToOne(g)}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>發送郵件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-auto">
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
              <Label>內容</Label>
              <RichTextEditor
                content={emailBody}
                onChange={setEmailBody}
                placeholder="輸入郵件內容..."
                minHeight="200px"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>附件</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4 mr-1" />
                  新增附件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                />
              </div>
              
              {attachments.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  {attachments.map((attachment, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      {attachment.uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        getFileIcon(attachment.file)
                      )}
                      <span className="flex-1 truncate">{attachment.file.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {(attachment.file.size / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(attachment)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                支援圖片、PDF、Office 文件，單檔最大 10MB
              </p>
            </div>

            <div className="flex gap-2 pt-2">
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
                disabled={sending || !emailSubject.trim() || !emailBody.trim() || attachments.some(a => a.uploading)}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    發送中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    發送
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
