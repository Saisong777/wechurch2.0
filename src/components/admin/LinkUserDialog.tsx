import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface LinkUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  onLink: (memberId: string, userId: string) => void;
}

export const LinkUserDialog = ({ open, onOpenChange, memberId, onLink }: LinkUserDialogProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !email.trim()) return;

    setLoading(true);
    try {
      // Find user by email from API
      const response = await fetch(`/api/users?email=${encodeURIComponent(email.trim())}`);
      
      if (!response.ok) {
        toast.error('搜尋用戶時發生錯誤');
        return;
      }
      
      const users = await response.json();
      const user = users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
      
      if (!user) {
        toast.error('找不到此 Email 對應的用戶');
        return;
      }

      onLink(memberId, user.id);
      setEmail('');
      onOpenChange(false);
    } catch (err) {
      toast.error('連結失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手動連結用戶</DialogTitle>
          <DialogDescription>
            輸入已註冊用戶的 Email 來將此潛在會員與帳號連結
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="email">用戶 Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? '搜尋中...' : '連結'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
