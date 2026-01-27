import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type CardLevel = Database['public']['Enums']['card_level'];

interface ParsedQuestion {
  level: CardLevel;
  content_text: string;
  content_text_en: string;
  isValid: boolean;
  error?: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `level,content_text,content_text_en
L1,你今天吃了什麼早餐？,What did you have for breakfast today?
L1,你最喜歡的季節是什麼？為什麼？,What is your favorite season and why?
L2,分享一個最近讓你開心的小事,Share something small that made you happy recently
L2,如果可以瞬間學會一項技能，你會選什麼？,If you could instantly learn any skill, what would it be?
L3,你生命中最重要的三個價值觀是什麼？,What are the three most important values in your life?`;

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [csvInput, setCsvInput] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const resetState = () => {
    setCsvInput('');
    setParsedQuestions([]);
    setStep('input');
  };

  const parseCSV = useCallback((input: string): ParsedQuestion[] => {
    const lines = input.trim().split('\n');
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1);
    
    return dataLines.map((line, index) => {
      // Simple CSV parsing (handle quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const [level, content_text, content_text_en] = values;
      
      // Validate
      const validLevels: CardLevel[] = ['L1', 'L2', 'L3'];
      const normalizedLevel = level?.toUpperCase() as CardLevel;
      
      if (!validLevels.includes(normalizedLevel)) {
        return {
          level: 'L1',
          content_text: content_text || '',
          content_text_en: content_text_en || '',
          isValid: false,
          error: `第 ${index + 2} 行：無效的等級「${level}」，必須是 L1、L2 或 L3`,
        };
      }

      if (!content_text?.trim()) {
        return {
          level: normalizedLevel,
          content_text: '',
          content_text_en: content_text_en || '',
          isValid: false,
          error: `第 ${index + 2} 行：中文內容不能為空`,
        };
      }

      return {
        level: normalizedLevel,
        content_text: content_text.trim(),
        content_text_en: content_text_en?.trim() || '',
        isValid: true,
      };
    });
  }, []);

  const handleParse = () => {
    setIsParsing(true);
    try {
      const parsed = parseCSV(csvInput);
      if (parsed.length === 0) {
        toast.error('無法解析 CSV，請確認格式正確');
        return;
      }
      setParsedQuestions(parsed);
      setStep('preview');
    } catch (error) {
      toast.error('解析失敗');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const validQuestions = parsedQuestions.filter(q => q.isValid);
    if (validQuestions.length === 0) {
      toast.error('沒有可匯入的有效問題');
      return;
    }

    setIsImporting(true);
    try {
      const { error } = await supabase
        .from('card_questions')
        .insert(
          validQuestions.map((q, index) => ({
            level: q.level,
            content_text: q.content_text,
            content_text_en: q.content_text_en || null,
            is_active: true,
            sort_order: index,
          }))
        );

      if (error) throw error;

      toast.success(`成功匯入 ${validQuestions.length} 個問題！`);
      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('匯入失敗');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvInput(text);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'icebreaker_questions_template.csv';
    link.click();
  };

  const validCount = parsedQuestions.filter(q => q.isValid).length;
  const invalidCount = parsedQuestions.filter(q => !q.isValid).length;

  const levelColors: Record<CardLevel, string> = {
    L1: 'bg-emerald-500',
    L2: 'bg-amber-500',
    L3: 'bg-rose-500',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            批量匯入題目
          </DialogTitle>
          <DialogDescription>
            使用 CSV 格式批量匯入破冰問題。格式：level, content_text, content_text_en
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4 py-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>上傳 CSV 檔案</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  選擇檔案
                </Button>
                <Button variant="ghost" size="icon" onClick={downloadTemplate} title="下載範本">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Manual Input */}
            <div className="space-y-2">
              <Label>或直接貼上 CSV 內容</Label>
              <Textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder={`level,content_text,content_text_en\nL1,你好嗎？,How are you?`}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Sample Format */}
            <Alert>
              <AlertDescription className="text-sm">
                <strong>格式說明：</strong><br />
                • 第一行為標題行：level,content_text,content_text_en<br />
                • level 必須是 L1、L2 或 L3<br />
                • content_text（中文）為必填<br />
                • content_text_en（英文）為選填
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-accent" />
                <span className="text-sm">有效：{validCount} 題</span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">無效：{invalidCount} 題</span>
                </div>
              )}
            </div>

            {/* Preview List */}
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
              {parsedQuestions.map((q, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded',
                    q.isValid ? 'bg-muted/50' : 'bg-destructive/10'
                  )}
                >
                  <Badge className={cn('text-white text-xs', levelColors[q.level])}>
                    {q.level}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    {q.isValid ? (
                      <>
                        <p className="text-sm truncate">{q.content_text}</p>
                        {q.content_text_en && (
                          <p className="text-xs text-muted-foreground truncate">
                            {q.content_text_en}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-destructive">{q.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleParse}
                disabled={!csvInput.trim() || isParsing}
              >
                {isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                預覽
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep('input')}>
                返回修改
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                匯入 {validCount} 題
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
