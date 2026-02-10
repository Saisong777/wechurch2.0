import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, Filter, Sparkles, Upload } from 'lucide-react';
import { BulkImportDialog } from './BulkImportDialog';
import { cn } from '@/lib/utils';

type CardLevel = 'L1' | 'L2' | 'L3';

interface CardQuestion {
  id: string;
  contentText: string;
  contentTextEn: string | null;
  level: CardLevel;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const levelConfig: Record<CardLevel, { label: string; labelEn: string; color: string }> = {
  L1: { label: '真心話卡', labelEn: 'Warm-Up', color: 'bg-emerald-500' },
  L2: { label: '連結卡', labelEn: 'Connection', color: 'bg-amber-500' },
  L3: { label: '深度卡', labelEn: 'Deep', color: 'bg-rose-500' },
};

export const CardQuestionManager: React.FC = () => {
  const [questions, setQuestions] = useState<CardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<CardLevel | 'all'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CardQuestion | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<CardQuestion | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    contentText: '',
    contentTextEn: '',
    level: 'L1' as CardLevel,
    isActive: true,
    sortOrder: 0,
  });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/card-questions');
      if (!response.ok) throw new Error('Failed to fetch questions');
      const data = await response.json();
      setQuestions(data || []);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      toast.error('無法載入題庫');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const openCreateDialog = () => {
    setEditingQuestion(null);
    setFormData({
      contentText: '',
      contentTextEn: '',
      level: 'L1',
      isActive: true,
      sortOrder: questions.length,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (question: CardQuestion) => {
    setEditingQuestion(question);
    setFormData({
      contentText: question.contentText,
      contentTextEn: question.contentTextEn || '',
      level: question.level,
      isActive: question.isActive,
      sortOrder: question.sortOrder,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.contentText.trim()) {
      toast.error('請輸入問題內容');
      return;
    }

    setSaving(true);
    try {
      if (editingQuestion) {
        const response = await fetch(`/api/card-questions/${editingQuestion.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentText: formData.contentText.trim(),
            contentTextEn: formData.contentTextEn.trim() || null,
            level: formData.level,
            isActive: formData.isActive,
            sortOrder: formData.sortOrder,
          }),
        });
        if (!response.ok) throw new Error('Failed to update');
        toast.success('問題已更新');
      } else {
        const response = await fetch('/api/card-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentText: formData.contentText.trim(),
            contentTextEn: formData.contentTextEn.trim() || null,
            level: formData.level,
            isActive: formData.isActive,
            sortOrder: formData.sortOrder,
          }),
        });
        if (!response.ok) throw new Error('Failed to create');
        toast.success('問題已新增');
      }

      setDialogOpen(false);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to save question:', error);
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!questionToDelete) return;

    try {
      const response = await fetch(`/api/card-questions/${questionToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success('問題已刪除');
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to delete question:', error);
      toast.error('刪除失敗');
    }
  };

  const toggleActive = async (question: CardQuestion) => {
    try {
      const response = await fetch(`/api/card-questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !question.isActive }),
      });
      if (!response.ok) throw new Error('Failed to update');
      
      setQuestions(prev => 
        prev.map(q => 
          q.id === question.id ? { ...q, isActive: !q.isActive } : q
        )
      );
      
      toast.success(question.isActive ? '問題已停用' : '問題已啟用');
    } catch (error) {
      console.error('Failed to toggle question:', error);
      toast.error('操作失敗');
    }
  };

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.contentText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.contentTextEn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesLevel = filterLevel === 'all' || q.level === filterLevel;
    const matchesActive = 
      filterActive === 'all' || 
      (filterActive === 'active' && q.isActive) ||
      (filterActive === 'inactive' && !q.isActive);
    return matchesSearch && matchesLevel && matchesActive;
  });

  // Stats
  const stats = {
    total: questions.length,
    active: questions.filter(q => q.isActive).length,
    L1: questions.filter(q => q.level === 'L1' && q.isActive).length,
    L2: questions.filter(q => q.level === 'L2' && q.isActive).length,
    L3: questions.filter(q => q.level === 'L3' && q.isActive).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">真心話題庫管理</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkImportOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            批量匯入
          </Button>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            新增問題
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">總題數</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
            <div className="text-xs text-muted-foreground">啟用中</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-emerald-500">{stats.L1}</div>
            <div className="text-xs text-muted-foreground">L1 真心話卡</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.L2}</div>
            <div className="text-xs text-muted-foreground">L2 連結卡</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-rose-500">{stats.L3}</div>
            <div className="text-xs text-muted-foreground">L3 深度卡</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋問題..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v as CardLevel | 'all')}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="等級" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等級</SelectItem>
            <SelectItem value="L1">L1 真心話卡</SelectItem>
            <SelectItem value="L2">L2 連結卡</SelectItem>
            <SelectItem value="L3">L3 深度卡</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => setFilterActive(v as 'all' | 'active' | 'inactive')}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="active">啟用中</SelectItem>
            <SelectItem value="inactive">已停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Questions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">等級</TableHead>
                  <TableHead>問題內容</TableHead>
                  <TableHead className="hidden md:table-cell">英文版</TableHead>
                  <TableHead className="w-20 text-center">狀態</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchQuery || filterLevel !== 'all' || filterActive !== 'all'
                        ? '沒有符合條件的問題'
                        : '尚無題目，點擊「新增問題」開始'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuestions.map((question) => (
                    <TableRow 
                      key={question.id}
                      className={cn(!question.isActive && 'opacity-50')}
                    >
                      <TableCell>
                        <Badge 
                          className={cn(
                            'text-white',
                            levelConfig[question.level].color
                          )}
                        >
                          {question.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="line-clamp-2">{question.contentText}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2 text-muted-foreground">
                          {question.contentTextEn || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={question.isActive}
                          onCheckedChange={() => toggleActive(question)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(question)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setQuestionToDelete(question);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? '編輯問題' : '新增問題'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>等級 *</Label>
              <Select 
                value={formData.level} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, level: v as CardLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      L1 真心話卡 (Warm-Up)
                    </span>
                  </SelectItem>
                  <SelectItem value="L2">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      L2 連結卡 (Connection)
                    </span>
                  </SelectItem>
                  <SelectItem value="L3">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      L3 深度卡 (Deep)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>問題內容（中文）*</Label>
              <Textarea
                value={formData.contentText}
                onChange={(e) => setFormData(prev => ({ ...prev, contentText: e.target.value }))}
                placeholder="輸入問題內容..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>問題內容（英文）</Label>
              <Textarea
                value={formData.contentTextEn}
                onChange={(e) => setFormData(prev => ({ ...prev, contentTextEn: e.target.value }))}
                placeholder="Enter question in English (optional)..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>啟用此問題</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingQuestion ? '儲存變更' : '新增問題'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此問題？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。如果只是想暫時停用，可以使用「停用」功能。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={fetchQuestions}
      />
    </div>
  );
};
