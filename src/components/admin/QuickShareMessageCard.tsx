import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image, QrCode, Copy, Share2, Loader2, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface MessageCard {
  id: string;
  title: string;
  short_code: string;
  image_path: string;
  created_at: string;
}

interface QuickShareMessageCardProps {
  onManageCards?: () => void;
}

export const QuickShareMessageCard: React.FC<QuickShareMessageCardProps> = ({ onManageCards }) => {
  const [latestCard, setLatestCard] = useState<MessageCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRDialog, setShowQRDialog] = useState(false);

  useEffect(() => {
    fetchLatestCard();
  }, []);

  const fetchLatestCard = async () => {
    try {
      const { data, error } = await supabase
        .from('message_cards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestCard(data);
    } catch (err) {
      console.error('Error fetching latest card:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrl = (card: MessageCard) => {
    return `${window.location.origin}/card?code=${card.short_code}`;
  };

  const getImageUrl = (imagePath: string) => {
    const { data } = supabase.storage.from('message-cards').getPublicUrl(imagePath);
    return data.publicUrl;
  };

  const handleCopyLink = () => {
    if (!latestCard) return;
    navigator.clipboard.writeText(getDownloadUrl(latestCard));
    toast.success('已複製連結');
  };

  const handleShare = async () => {
    if (!latestCard) return;
    
    const shareData = {
      title: latestCard.title,
      text: `📖 ${latestCard.title}\n\n下載信息摘要圖片，代碼：${latestCard.short_code}`,
      url: getDownloadUrl(latestCard),
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!latestCard) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Image className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-3">尚未建立信息卡片</p>
          {onManageCards && (
            <Button variant="outline" size="sm" onClick={onManageCards}>
              新增卡片
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-secondary" />
              <CardTitle className="text-base">本週信息摘要</CardTitle>
            </div>
            <Badge variant="secondary" className="font-mono">
              {latestCard.short_code}
            </Badge>
          </div>
          <CardDescription className="text-sm truncate">
            {latestCard.title}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          {/* Thumbnail preview */}
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={getImageUrl(latestCard.image_path)}
              alt={latestCard.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setShowQRDialog(true)}
            >
              <QrCode className="w-4 h-4 mr-2" />
              顯示 QR Code
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="h-10"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              分享連結
            </Button>
          </div>

          {/* Quick link to manage */}
          {onManageCards && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={onManageCards}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              管理所有卡片
            </Button>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{latestCard.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <QRCodeSVG
                value={getDownloadUrl(latestCard)}
                size={220}
                level="H"
              />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">輸入代碼下載圖片</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-primary">
                {latestCard.short_code}
              </p>
            </div>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                複製連結
              </Button>
              <Button
                variant="gold"
                className="flex-1"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                分享
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              掃描 QR Code 或輸入代碼即可下載本週信息摘要圖片
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
