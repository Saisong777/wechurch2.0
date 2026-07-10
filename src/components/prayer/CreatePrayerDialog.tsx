import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Eye, EyeOff, Loader2, BookOpen, HeartHandshake } from 'lucide-react';
import { useCreatePrayer, PrayerCategory, CATEGORY_LABELS, type Prayer } from '@/hooks/usePrayerWall';
import { cn, vibrate } from '@/lib/utils';

const PRAYER_PROMPTS = [
  '請為我的家人...',
  '請為我這週的決定...',
  '感謝神最近...',
];

const CATEGORY_HINTS: Record<PrayerCategory, string> = {
  thanksgiving: '為已經領受的恩典感謝',
  supplication: '邀請大家一起守望需要',
  praise: '把焦點放回神的良善',
  other: '其他想被記念的事情',
};

interface CreatePrayerDialogProps {
  onCreated?: (prayer: Prayer) => void;
}

export const CreatePrayerDialog: React.FC<CreatePrayerDialogProps> = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [scriptureReference, setScriptureReference] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState<PrayerCategory>('supplication');
  const createMutation = useCreatePrayer();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    vibrate(50);

    const createdPrayer = await createMutation.mutateAsync({
      content: content.trim(),
      isAnonymous,
      category,
      scriptureReference: scriptureReference.trim() || undefined,
    });

    setContent('');
    setScriptureReference('');
    setIsAnonymous(false);
    setCategory('supplication');
    setOpen(false);
    onCreated?.(createdPrayer);
  };

  const isValid = content.trim().length > 0;
  const remainingChars = 500 - content.length;

  const applyPrompt = (prompt: string) => {
    setContent((current) => current.trim() ? current : prompt);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 gap-2 rounded-lg px-5 text-sm shadow-sm sm:h-12 sm:text-base">
          <Plus className="h-5 w-5" />
          寫下代禱
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/10">
            <HeartHandshake className="h-5 w-5 text-rose-600" />
          </div>
          <DialogTitle>分享代禱</DialogTitle>
          <DialogDescription>
            寫下你願意讓大家一起守望的部分即可。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Category Selector */}
          <div className="space-y-2">
            <Label htmlFor="prayer-category">禱告分類</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as PrayerCategory)}>
              <SelectTrigger id="prayer-category" className="h-11 rounded-lg">
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as PrayerCategory[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[category]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prayer-content">禱告內容</Label>
            <div className="flex flex-wrap gap-2">
              {PRAYER_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => applyPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            <Textarea
              id="prayer-content"
              placeholder="例如：請為我下週的工作面談禱告，求神賜下平安與清楚的方向。"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="resize-none rounded-lg text-base leading-7"
              maxLength={500}
            />
            <p
              className={cn(
                'text-right text-xs text-muted-foreground',
                remainingChars <= 40 && 'text-amber-600',
                remainingChars <= 10 && 'text-destructive'
              )}
            >
              還可輸入 {remainingChars} 字
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scripture-ref" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              相關經文（選填）
            </Label>
            <Input
              id="scripture-ref"
              placeholder="例如：詩篇 23:1-3、約翰福音 3:16"
              value={scriptureReference}
              onChange={(e) => setScriptureReference(e.target.value)}
              maxLength={100}
              className="h-11 rounded-lg"
            />
            <p className="text-xs text-muted-foreground">
              可附上支持你禱告的經文章節
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              {isAnonymous ? (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Eye className="h-5 w-5 text-primary" />
              )}
              <div>
                <Label htmlFor="anonymous-switch" className="cursor-pointer">
                  匿名發布
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isAnonymous ? '不會顯示你的名字' : '會顯示你的名字'}
                </p>
              </div>
            </div>
            <Switch
              id="anonymous-switch"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
            className="rounded-lg"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                發布中
              </>
            ) : (
              '發布代禱'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
