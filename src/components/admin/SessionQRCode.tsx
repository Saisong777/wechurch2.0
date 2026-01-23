import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Maximize2, Download } from 'lucide-react';

interface SessionQRCodeProps {
  sessionId: string;
  verseReference?: string;
}

export const SessionQRCode: React.FC<SessionQRCodeProps> = ({ sessionId, verseReference }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Build the join URL using the public app URL
  const publicBaseUrl = 'https://id-preview--535fde94-f0d2-40e6-b67e-11919e99216e.lovable.app';
  const joinUrl = `${publicBaseUrl}/user?session_id=${sessionId}`;

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
      downloadLink.download = `bible-study-${sessionId.slice(0, 8)}.png`;
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
        
        <p className="text-center text-sm text-muted-foreground">
          掃描 QR Code 加入查經
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
                <p className="text-center text-muted-foreground">
                  掃描加入 Scan to Join
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
