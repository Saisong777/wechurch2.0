import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DevotionalAnalysisBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevotionalAnalysisBatchDialog({ open, onOpenChange }: DevotionalAnalysisBatchDialogProps) {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [noteCount, setNoteCount] = useState<number | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setNoteCount(null);
    try {
      const body: any = {};
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;
      const res = await apiRequest('POST', '/api/devotional-notes/analyze-batch', body);
      const data = await res.json();
      setAnalysisResult(data.analysis);
      setNoteCount(data.noteCount);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI 分析失敗';
      toast({ title: '分析失敗', description: message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            靈修筆記整合分析
          </DialogTitle>
          <DialogDescription>
            選擇日期範圍，AI 將整合分析您的靈修筆記
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-date-from" className="text-xs">起始日期</Label>
              <Input
                id="batch-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-batch-date-from"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-date-to" className="text-xs">結束日期</Label>
              <Input
                id="batch-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-batch-date-to"
              />
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full"
            data-testid="button-batch-analyze"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                AI 分析中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                開始整合分析
              </>
            )}
          </Button>

          {analysisResult && (
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="w-4 h-4" />
                  AI 整合分析結果
                </div>
                {noteCount !== null && (
                  <span className="text-xs text-muted-foreground">
                    共 {noteCount} 篇筆記
                  </span>
                )}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap" data-testid="text-batch-analysis-result">
                {analysisResult}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
