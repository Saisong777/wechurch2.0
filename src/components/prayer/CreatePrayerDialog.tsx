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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useCreatePrayer } from '@/hooks/usePrayerWall';

export const CreatePrayerDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const createMutation = useCreatePrayer();

  const handleSubmit = async () => {
    if (!content.trim()) return;

    await createMutation.mutateAsync({
      content: content.trim(),
      isAnonymous,
    });

    setContent('');
    setIsAnonymous(false);
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
