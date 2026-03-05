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
import { Plus, Eye, EyeOff, Loader2, BookOpen } from 'lucide-react';
import { useCreatePrayer, PrayerCategory, CATEGORY_LABELS } from '@/hooks/usePrayerWall';
import { vibrate } from '@/lib/utils';

export const CreatePrayerDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [scriptureReference, setScriptureReference] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState<PrayerCategory>('supplication');
  const createMutation = useCreatePrayer();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    vibrate(50);

    await createMutation.mutateAsync({
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
  };

  const isValid = content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 h-14 px-6 text-base shadow-lg">
          <Plus className="h-5 w-5" />
          發布禱告事項
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享你的禱告事項</DialogTitle>
          <DialogDescription>
            讓弟兄姊妹一起為你代禱
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selector */}
          <div className="space-y-2">
            <Label htmlFor="prayer-category">禱告分類</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as PrayerCategory)}>
              <SelectTrigger id="prayer-category">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="prayer-content">禱告內容</Label>
            <Textarea
              id="prayer-content"
              placeholder="請輸入你的禱告事項..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/500
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
            />
            <p className="text-xs text-muted-foreground">
              可附上支持你禱告的經文章節
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                發布中...
              </>
            ) : (
              '發布禱告'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
