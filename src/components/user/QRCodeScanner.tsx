import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (sessionId: string) => void;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ open, onClose, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Extract session ID from URL or use directly
          let sessionId = decodedText;
          
          // Check if it's a URL with session_id parameter
          try {
            const url = new URL(decodedText);
            const sessionParam = url.searchParams.get('session_id') || url.searchParams.get('session');
            if (sessionParam) {
              sessionId = sessionParam;
            }
          } catch {
            // Not a URL, use as-is
          }

          scanner.stop().then(() => {
            setIsScanning(false);
            onScan(sessionId);
            onClose();
          });
        },
        () => {
          // QR code not found in frame - ignore
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setHasPermission(false);
      
      if (err.message?.includes('Permission')) {
        toast.error('請允許相機權限以掃描 QR Code');
      } else {
        toast.error('無法啟動相機，請確認裝置支援');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-secondary" />
            掃描 QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div 
            id="qr-reader" 
            ref={containerRef}
            className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
          />
          
          {hasPermission === false && (
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <p className="text-destructive text-sm mb-2">
                無法存取相機
              </p>
              <p className="text-muted-foreground text-xs">
                請在瀏覽器設定中允許相機權限，然後重新嘗試
              </p>
            </div>
          )}
          
          <p className="text-center text-sm text-muted-foreground">
            將 QR Code 對準相機框內
          </p>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleClose}
          >
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
