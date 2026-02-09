import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, User, Camera, X } from 'lucide-react';
import { AvatarCropDialog } from './AvatarCropDialog';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [birthday, setBirthday] = useState('');
  const [userGender, setUserGender] = useState('');
  const [address, setAddress] = useState('');
  const [church, setChurch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      const metaDisplayName = user.user_metadata?.display_name || user.displayName;
      const metaAvatarUrl = user.user_metadata?.avatar_url;
      
      setDisplayName(metaDisplayName || user.email?.split('@')[0] || '');
      setAvatarUrl(metaAvatarUrl || null);
      setBirthday('');
      setUserGender('');
      setAddress('');
      setChurch('');
      fetchProfile();
    }
  }, [user, open]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/profile`);
      if (res.ok) {
        const data = await res.json();
        if (data.displayName) setDisplayName(data.displayName);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (data.birthday) setBirthday(data.birthday);
        if (data.userGender) setUserGender(data.userGender);
        if (data.address) setAddress(data.address);
        if (data.church) setChurch(data.church);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔案');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('圖片大小不能超過 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');

      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setAvatarUrl(`${data.avatarUrl}?t=${Date.now()}`);
      toast.success('頭像已上傳');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('上傳失敗，請重試');
    } finally {
      setIsUploading(false);
      setSelectedImageSrc(null);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    
    setIsUploading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      setAvatarUrl(null);
      toast.success('頭像已移除');
    } catch (error: any) {
      toast.error('移除失敗，請重試');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!displayName.trim()) {
      toast.error('顯示名稱不能為空');
      return;
    }

    if (!birthday) {
      toast.error('請填寫生日');
      return;
    }

    if (!userGender) {
      toast.error('請選擇性別');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          avatarUrl,
          birthday: birthday || null,
          userGender: userGender || null,
          address: address.trim() || null,
          church: church.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Update failed');

      toast.success('個人設定已更新');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('更新失敗，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              個人設定
            </DialogTitle>
            <DialogDescription>
              修改您的個人資料
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="w-24 h-24 cursor-pointer" onClick={handleAvatarClick}>
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={isUploading}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4 mr-1" />
                  移除頭像
                </Button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">顯示名稱</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="輸入您的顯示名稱"
                className="h-11"
                data-testid="input-display-name"
              />
            </div>

            <div className="space-y-2">
              <Label>電子郵件</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="h-11 bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                電子郵件無法修改
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthday">
                  生日 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="h-11 text-base"
                  data-testid="input-birthday"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userGender">
                  性別 <span className="text-destructive">*</span>
                </Label>
                <Select value={userGender} onValueChange={setUserGender}>
                  <SelectTrigger className="h-11" data-testid="select-gender">
                    <SelectValue placeholder="請選擇" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="church">
                所屬教會 <span className="text-xs text-muted-foreground">(選填)</span>
              </Label>
              <Input
                id="church"
                value={church}
                onChange={(e) => setChurch(e.target.value)}
                placeholder="輸入您所屬的教會"
                className="h-11"
                data-testid="input-church"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                地址 <span className="text-xs text-muted-foreground">(選填)</span>
              </Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="輸入您的地址"
                className="h-11"
                data-testid="input-address"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              data-testid="button-save-profile"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存變更'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};
