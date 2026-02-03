import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Share2, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VerseData {
  text: string;
  reference: string;
}

interface ScriptureCardCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verse: VerseData;
}

const BACKGROUND_PRESETS = [
  { id: 'gradient1', name: '晨曦', style: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: '夕陽', style: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient3', name: '大海', style: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient4', name: '森林', style: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'gradient5', name: '天空', style: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 'gradient6', name: '星夜', style: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
];

const TEXT_POSITIONS = [
  { id: 'top-left', name: '左上', align: 'items-start justify-start', textAlign: 'text-left' },
  { id: 'top-center', name: '上', align: 'items-start justify-center', textAlign: 'text-center' },
  { id: 'top-right', name: '右上', align: 'items-start justify-end', textAlign: 'text-right' },
  { id: 'center-left', name: '左', align: 'items-center justify-start', textAlign: 'text-left' },
  { id: 'center', name: '中', align: 'items-center justify-center', textAlign: 'text-center' },
  { id: 'center-right', name: '右', align: 'items-center justify-end', textAlign: 'text-right' },
  { id: 'bottom-left', name: '左下', align: 'items-end justify-start', textAlign: 'text-left' },
  { id: 'bottom-center', name: '下', align: 'items-end justify-center', textAlign: 'text-center' },
  { id: 'bottom-right', name: '右下', align: 'items-end justify-end', textAlign: 'text-right' },
];

const ASPECT_RATIOS = [
  { id: 'square', name: '正方形', ratio: 'aspect-square', width: 400, height: 400 },
  { id: 'portrait', name: '直式', ratio: 'aspect-[3/4]', width: 400, height: 533 },
  { id: 'story', name: '限動', ratio: 'aspect-[9/16]', width: 400, height: 711 },
  { id: 'landscape', name: '橫式', ratio: 'aspect-[4/3]', width: 400, height: 300 },
];

const FONT_SIZES = [
  { id: 'sm', name: '小', verse: 'text-sm', ref: 'text-xs', message: 'text-xs' },
  { id: 'md', name: '中', verse: 'text-base', ref: 'text-sm', message: 'text-sm' },
  { id: 'lg', name: '大', verse: 'text-lg', ref: 'text-base', message: 'text-base' },
];

export const ScriptureCardCreator = ({ open, onOpenChange, verse }: ScriptureCardCreatorProps) => {
  const [cardBackground, setCardBackground] = useState(BACKGROUND_PRESETS[0].style);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');
  const [textPosition, setTextPosition] = useState(TEXT_POSITIONS[4]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[1]);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: '圖片太大', description: '請選擇小於 5MB 的圖片', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!cardRef.current) return null;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const element = cardRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.offsetWidth,
        windowHeight: element.offsetHeight,
      });
      
      return canvas;
    } catch (err) {
      console.error('Canvas generation failed:', err);
      return null;
    }
  }, []);

  const saveImage = useCallback((dataUrl: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>經文圖卡</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
              <img src="${dataUrl}" style="max-width:100%;max-height:100vh;" />
              <p style="position:fixed;bottom:20px;left:0;right:0;text-align:center;color:white;font-size:14px;">
                長按圖片可以儲存
              </p>
            </body>
          </html>
        `);
        newWindow.document.close();
        toast({ title: '圖片已生成', description: '請長按圖片儲存' });
        return;
      }
    }
    
    const link = document.createElement('a');
    link.download = `verse-card-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: '下載成功', description: '圖片已儲存' });
  }, [toast]);

  const handleDownloadCard = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const canvas = await generateCanvas();
      if (!canvas) {
        toast({ title: '生成失敗', description: '無法生成圖片，請重試', variant: 'destructive' });
        return;
      }

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      saveImage(dataUrl);
    } catch (err) {
      console.error('Download failed:', err);
      toast({ title: '下載失敗', description: '請重試', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareCard = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const canvas = await generateCanvas();
      if (!canvas) {
        toast({ title: '生成失敗', variant: 'destructive' });
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
      });

      if (!blob) {
        toast({ title: '生成失敗', variant: 'destructive' });
        return;
      }

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'verse-card.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: '經文卡片' });
            return;
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
          }
        }
      }
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      saveImage(dataUrl);
    } catch (err) {
      console.error('Share failed:', err);
      toast({ title: '分享失敗', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-[95vw] max-h-[85vh] p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle>製作經文圖卡</DialogTitle>
          <DialogDescription>
            選擇背景、調整文字，製作可分享的經文圖卡
          </DialogDescription>
        </DialogHeader>

        <div 
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <div
                ref={cardRef}
                className={`relative ${aspectRatio.ratio} w-full max-w-[280px] rounded-lg overflow-hidden shadow-lg flex-shrink-0`}
                style={{
                  background: customImage ? undefined : cardBackground,
                }}
              >
                {customImage && (
                  <img
                    src={customImage}
                    alt="背景"
                    className="absolute inset-0 w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                )}
                {customImage && <div className="absolute inset-0 bg-black/40" />}
                <div className={`relative h-full flex flex-col ${textPosition.align} p-4`}>
                  <div className={`${textPosition.textAlign} max-w-full`}>
                    <p className={`${fontSize.verse} text-white font-medium leading-relaxed mb-2 drop-shadow-lg break-words`}>
                      {verse.text}
                    </p>
                    <p className={`${fontSize.ref} text-white/90 drop-shadow`}>
                      — {verse.reference}
                    </p>
                    {personalMessage && (
                      <p className={`${fontSize.message} text-white/80 mt-2 italic drop-shadow break-words`}>
                        {personalMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">背景樣式</label>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`w-9 h-9 rounded-lg border-2 transition-all ${
                        cardBackground === preset.style && !customImage
                          ? 'border-primary ring-2 ring-primary/30 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ background: preset.style }}
                      onClick={() => { setCardBackground(preset.style); setCustomImage(null); }}
                      title={preset.name}
                      data-testid={`button-bg-${preset.id}`}
                    />
                  ))}
                  <button
                    className={`px-3 h-9 rounded-lg border-2 flex items-center gap-1.5 bg-muted text-xs font-medium ${
                      customImage ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-bg"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    上傳圖片
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">比例</label>
                  <div className="flex flex-wrap gap-1">
                    {ASPECT_RATIOS.map((ratio) => (
                      <Button
                        key={ratio.id}
                        variant={aspectRatio.id === ratio.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setAspectRatio(ratio)}
                        data-testid={`button-ratio-${ratio.id}`}
                      >
                        {ratio.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">文字大小</label>
                  <div className="flex gap-1">
                    {FONT_SIZES.map((size) => (
                      <Button
                        key={size.id}
                        variant={fontSize.id === size.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setFontSize(size)}
                        data-testid={`button-size-${size.id}`}
                      >
                        {size.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">文字位置</label>
                <div className="grid grid-cols-3 gap-1 max-w-[140px]">
                  {TEXT_POSITIONS.map((pos) => (
                    <Button
                      key={pos.id}
                      variant={textPosition.id === pos.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-1"
                      onClick={() => setTextPosition(pos)}
                      data-testid={`button-pos-${pos.id}`}
                    >
                      {pos.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">個人感言（選填）</label>
                <Input
                  placeholder="寫下你的感言..."
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  className="h-9"
                  data-testid="input-personal-message"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button 
                  onClick={handleDownloadCard} 
                  className="flex-1 h-10" 
                  disabled={isGenerating}
                  data-testid="button-download-card"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1.5" />
                  )}
                  下載圖片
                </Button>
                <Button 
                  onClick={handleShareCard} 
                  variant="outline" 
                  className="flex-1 h-10" 
                  disabled={isGenerating}
                  data-testid="button-share-card"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-1.5" />
                  )}
                  分享
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScriptureCardCreator;
