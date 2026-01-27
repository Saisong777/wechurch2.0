import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, ScanLine } from 'lucide-react';
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

      // Calculate square size based on container
      const containerWidth = containerRef.current.offsetWidth;
      const scanSize = Math.min(containerWidth - 40, 280); // Leave padding, max 280px

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: scanSize, height: scanSize },
          aspectRatio: 1, // Force square aspect ratio
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-secondary" />
            掃描 QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 px-4 pb-4">
          {/* Square Scanner Container */}
          <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
            <div 
              id="qr-reader" 
              ref={containerRef}
              className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
            />
            
            {/* Square Overlay Frame */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner brackets */}
                <div className="absolute inset-[15%]">
                  {/* Top-left corner */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-secondary rounded-tl-lg" />
                  {/* Top-right corner */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-secondary rounded-tr-lg" />
                  {/* Bottom-left corner */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-secondary rounded-bl-lg" />
                  {/* Bottom-right corner */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-secondary rounded-br-lg" />
                </div>
                
                {/* Animated scan line */}
                <div className="absolute inset-[15%] overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-secondary to-transparent animate-scan" />
                </div>
              </div>
            )}
            
            {/* Loading state */}
            {!isScanning && hasPermission !== false && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ScanLine className="w-8 h-8 animate-pulse" />
                  <span className="text-sm">啟動相機中...</span>
                </div>
              </div>
            )}
          </div>
          
          {hasPermission === false && (
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-destructive text-sm mb-1">
                無法存取相機
              </p>
              <p className="text-muted-foreground text-xs">
                請在瀏覽器設定中允許相機權限
              </p>
            </div>
          )}
          
          <p className="text-center text-sm text-muted-foreground">
            將 QR Code 對準方框內
          </p>
          
          <Button 
            variant="outline" 
            className="w-full h-12" 
            onClick={handleClose}
          >
            <X className="w-4 h-4 mr-2" />
            取消掃描
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};