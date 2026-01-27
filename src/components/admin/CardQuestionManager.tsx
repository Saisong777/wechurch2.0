import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import type { Database } from '@/integrations/supabase/types';

type CardLevel = Database['public']['Enums']['card_level'];

interface CardQuestion {
  id: string;
  content_text: string;
  content_text_en: string | null;
  level: CardLevel;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const levelConfig: Record<CardLevel, { label: string; labelEn: string; color: string }> = {
  L1: { label: '破冰卡', labelEn: 'Warm-Up', color: 'bg-emerald-500' },
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
    content_text: '',
    content_text_en: '',
    level: 'L1' as CardLevel,
    is_active: true,
    sort_order: 0,
  });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      // Use RPC or direct query - admins have full access
      const { data, error } = await supabase
        .from('card_questions')
        .select('*')
        .order('level', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
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
      content_text: '',
      content_text_en: '',
      level: 'L1',
      is_active: true,
      sort_order: questions.length,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (question: CardQuestion) => {
    setEditingQuestion(question);
    setFormData({
      content_text: question.content_text,
      content_text_en: question.content_text_en || '',
      level: question.level,
      is_active: question.is_active,
      sort_order: question.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.content_text.trim()) {
      toast.error('請輸入問題內容');
      return;
    }

    setSaving(true);
    try {
      if (editingQuestion) {
        // Update existing question
        const { error } = await supabase
          .from('card_questions')
          .update({
            content_text: formData.content_text.trim(),
            content_text_en: formData.content_text_en.trim() || null,
            level: formData.level,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          })
          .eq('id', editingQuestion.id);

        if (error) throw error;
        toast.success('問題已更新');
      } else {
        // Create new question
        const { error } = await supabase
          .from('card_questions')
          .insert({
            content_text: formData.content_text.trim(),
            content_text_en: formData.content_text_en.trim() || null,
            level: formData.level,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          });

        if (error) throw error;
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
      const { error } = await supabase
        .from('card_questions')
        .delete()
        .eq('id', questionToDelete.id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('card_questions')
        .update({ is_active: !question.is_active })
        .eq('id', question.id);

      if (error) throw error;
      
      setQuestions(prev => 
        prev.map(q => 
          q.id === question.id ? { ...q, is_active: !q.is_active } : q
        )
      );
      
      toast.success(question.is_active ? '問題已停用' : '問題已啟用');
    } catch (error) {
      console.error('Failed to toggle question:', error);
      toast.error('操作失敗');
    }
  };

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.content_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.content_text_en?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesLevel = filterLevel === 'all' || q.level === filterLevel;
    const matchesActive = 
      filterActive === 'all' || 
      (filterActive === 'active' && q.is_active) ||
      (filterActive === 'inactive' && !q.is_active);
    return matchesSearch && matchesLevel && matchesActive;
  });

  // Stats
  const stats = {
    total: questions.length,
    active: questions.filter(q => q.is_active).length,
    L1: questions.filter(q => q.level === 'L1' && q.is_active).length,
    L2: questions.filter(q => q.level === 'L2' && q.is_active).length,
    L3: questions.filter(q => q.level === 'L3' && q.is_active).length,
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
          <h2 className="text-xl font-semibold">破冰題庫管理</h2>
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
            <div className="text-xs text-muted-foreground">L1 破冰卡</div>
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
            <SelectItem value="L1">L1 破冰卡</SelectItem>
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
                      className={cn(!question.is_active && 'opacity-50')}
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
                        <p className="line-clamp-2">{question.content_text}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2 text-muted-foreground">
                          {question.content_text_en || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={question.is_active}
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
                      L1 破冰卡 (Warm-Up)
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
                value={formData.content_text}
                onChange={(e) => setFormData(prev => ({ ...prev, content_text: e.target.value }))}
                placeholder="輸入問題內容..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>問題內容（英文）</Label>
              <Textarea
                value={formData.content_text_en}
                onChange={(e) => setFormData(prev => ({ ...prev, content_text_en: e.target.value }))}
                placeholder="Enter question in English (optional)..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>啟用此問題</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
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
