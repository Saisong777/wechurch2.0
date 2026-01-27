import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Maximize2, Download } from 'lucide-react';
import { getSessionJoinUrl } from '@/lib/url-helpers';

interface SessionQRCodeProps {
  sessionId: string;
  shortCode?: string;
  verseReference?: string;
}

export const SessionQRCode: React.FC<SessionQRCodeProps> = ({ sessionId, shortCode, verseReference }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Use short code for the URL if available, otherwise fall back to sessionId
  const codeForUrl = shortCode || sessionId;
  const joinUrl = getSessionJoinUrl(codeForUrl);

  const handleDownload = () => {
    const svg = document.getElementById('session-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `soul-gym-${shortCode || sessionId.slice(0, 8)}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="w-5 h-5 text-secondary" />
          掃描加入 Scan to Join
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg">
          <QRCodeSVG
            id="session-qr-code"
            value={joinUrl}
            size={180}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#1a1a2e"
          />
        </div>
        
        {/* Show short code prominently */}
        {shortCode && (
          <div className="text-center">
            <p className="text-2xl font-mono font-bold tracking-[0.3em]">{shortCode}</p>
            <p className="text-xs text-muted-foreground mt-1">課程代碼</p>
          </div>
        )}
        
        <p className="text-center text-sm text-muted-foreground">
          掃描 QR Code 或輸入代碼加入
        </p>
        
        <div className="flex gap-2">
          <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Maximize2 className="w-4 h-4 mr-2" />
                放大
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-center">
                  {verseReference || '查經聚會'}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 space-y-4">
                <div className="p-6 bg-white rounded-xl shadow-lg">
                  <QRCodeSVG
                    value={joinUrl}
                    size={280}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#1a1a2e"
                  />
                </div>
                {shortCode && (
                  <p className="text-3xl font-mono font-bold tracking-[0.4em]">{shortCode}</p>
                )}
                <p className="text-center text-muted-foreground">
                  掃描或輸入代碼加入
                </p>
                <p className="text-xs text-muted-foreground text-center break-all px-4">
                  {joinUrl}
                </p>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            下載
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
