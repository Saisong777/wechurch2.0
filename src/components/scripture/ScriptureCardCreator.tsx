import { useState, useRef, useCallback, useEffect } from 'react';
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
  { id: 'top-left', name: '左上', justify: 'flex-start', alignItems: 'flex-start', textAlign: 'left' as const },
  { id: 'top-center', name: '上', justify: 'flex-start', alignItems: 'center', textAlign: 'center' as const },
  { id: 'top-right', name: '右上', justify: 'flex-start', alignItems: 'flex-end', textAlign: 'right' as const },
  { id: 'center-left', name: '左', justify: 'center', alignItems: 'flex-start', textAlign: 'left' as const },
  { id: 'center', name: '中', justify: 'center', alignItems: 'center', textAlign: 'center' as const },
  { id: 'center-right', name: '右', justify: 'center', alignItems: 'flex-end', textAlign: 'right' as const },
  { id: 'bottom-left', name: '左下', justify: 'flex-end', alignItems: 'flex-start', textAlign: 'left' as const },
  { id: 'bottom-center', name: '下', justify: 'flex-end', alignItems: 'center', textAlign: 'center' as const },
  { id: 'bottom-right', name: '右下', justify: 'flex-end', alignItems: 'flex-end', textAlign: 'right' as const },
];

const ASPECT_RATIOS = [
  { id: 'square', name: '正方形', w: 1, h: 1 },
  { id: 'portrait', name: '直式', w: 3, h: 4 },
  { id: 'story', name: '限動', w: 9, h: 16 },
  { id: 'landscape', name: '橫式', w: 4, h: 3 },
];

const FONT_SIZES = [
  { id: 'sm', name: '小', verse: 14, ref: 12, message: 12 },
  { id: 'md', name: '中', verse: 16, ref: 14, message: 14 },
  { id: 'lg', name: '大', verse: 20, ref: 16, message: 16 },
];

const CARD_RENDER_WIDTH = 400;

export const ScriptureCardCreator = ({ open, onOpenChange, verse }: ScriptureCardCreatorProps) => {
  const [cardBackground, setCardBackground] = useState(BACKGROUND_PRESETS[0].style);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');
  const [textPosition, setTextPosition] = useState(TEXT_POSITIONS[4]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[1]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(260);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const cardRenderHeight = Math.round(CARD_RENDER_WIDTH * aspectRatio.h / aspectRatio.w);

  useEffect(() => {
    if (!open || !previewContainerRef.current) return;
    const updateWidth = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth;
        const maxPreviewWidth = Math.min(containerWidth - 16, 300);
        setPreviewWidth(Math.max(200, maxPreviewWidth));
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [open]);

  const previewScale = previewWidth / CARD_RENDER_WIDTH;
  const previewHeight = cardRenderHeight * previewScale;

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
    
    let clone: HTMLElement | null = null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      clone = cardRef.current.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = `${CARD_RENDER_WIDTH}px`;
      clone.style.height = `${cardRenderHeight}px`;
      document.body.appendChild(clone);
      
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: CARD_RENDER_WIDTH,
        height: cardRenderHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: CARD_RENDER_WIDTH,
        windowHeight: cardRenderHeight,
      });
      
      document.body.removeChild(clone);
      return canvas;
    } catch (err) {
      console.error('Canvas generation failed:', err);
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
      return null;
    }
  }, [cardRenderHeight]);

  const saveImage = useCallback(async (dataUrl: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `verse-card-${Date.now()}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '經文圖卡' });
          toast({ title: '分享成功' });
          return;
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
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
      await saveImage(dataUrl);
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
      await saveImage(dataUrl);
    } catch (err) {
      console.error('Share failed:', err);
      toast({ title: '分享失敗', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const scrollContentRef = useRef<HTMLDivElement>(null);

  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      scrollContentRef.current?.scrollTo({
        top: scrollContentRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 300);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg w-[95vw] p-0 gap-0 flex flex-col z-[10000] !translate-y-0 !top-[8px] sm:!top-[50%] sm:!-translate-y-1/2"
        style={{ maxHeight: '80dvh', touchAction: 'pan-y' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-3 pb-1 flex-shrink-0">
          <DialogTitle className="text-base">製作經文圖卡</DialogTitle>
          <DialogDescription className="text-xs">
            選擇背景、調整文字，製作可分享的經文圖卡
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={scrollContentRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3">
            <div ref={previewContainerRef} className="flex justify-center relative">
              <div 
                style={{ 
                  width: previewWidth, 
                  height: previewHeight,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '0.5rem',
                  flexShrink: 0,
                }}
              >
                <div
                  ref={cardRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: CARD_RENDER_WIDTH,
                    height: cardRenderHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    background: customImage ? undefined : cardBackground,
                    overflow: 'hidden',
                  }}
                >
                  {customImage && (
                    <img
                      src={customImage}
                      alt="背景"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      crossOrigin="anonymous"
                    />
                  )}
                  {customImage && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)' }} />}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: textPosition.justify,
                    alignItems: textPosition.alignItems,
                    padding: '24px',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{
                      textAlign: textPosition.textAlign,
                      maxWidth: '100%',
                      wordBreak: 'break-word',
                    }}>
                      <p style={{
                        fontSize: fontSize.verse,
                        color: 'white',
                        fontWeight: 500,
                        lineHeight: 1.8,
                        marginBottom: 8,
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }}>
                        {verse.text}
                      </p>
                      <p style={{
                        fontSize: fontSize.ref,
                        color: 'rgba(255,255,255,0.9)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}>
                        — {verse.reference}
                      </p>
                      {personalMessage && (
                        <p style={{
                          fontSize: fontSize.message,
                          color: 'rgba(255,255,255,0.8)',
                          marginTop: 8,
                          fontStyle: 'italic',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          wordBreak: 'break-word',
                        }}>
                          {personalMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">背景樣式</label>
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`w-8 h-8 rounded-md border-2 transition-all ${
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
                    className={`px-2.5 h-8 rounded-md border-2 flex items-center gap-1 bg-muted text-xs font-medium ${
                      customImage ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-bg"
                  >
                    <Upload className="w-3 h-3" />
                    上傳
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">比例</label>
                  <div className="flex flex-wrap gap-1">
                    {ASPECT_RATIOS.map((ratio) => (
                      <Button
                        key={ratio.id}
                        variant={aspectRatio.id === ratio.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-1.5"
                        onClick={() => setAspectRatio(ratio)}
                        data-testid={`button-ratio-${ratio.id}`}
                      >
                        {ratio.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">文字大小</label>
                  <div className="flex gap-1">
                    {FONT_SIZES.map((size) => (
                      <Button
                        key={size.id}
                        variant={fontSize.id === size.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-1.5"
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
                <label className="text-xs font-medium mb-1 block text-muted-foreground">文字位置</label>
                <div className="grid grid-cols-3 gap-1 max-w-[120px]">
                  {TEXT_POSITIONS.map((pos) => (
                    <Button
                      key={pos.id}
                      variant={textPosition.id === pos.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-xs px-1"
                      onClick={() => setTextPosition(pos)}
                      data-testid={`button-pos-${pos.id}`}
                    >
                      {pos.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">個人感言（選填）</label>
                <Input
                  placeholder="寫下你的感言..."
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  onFocus={handleInputFocus}
                  className="h-9 text-base"
                  data-testid="input-personal-message"
                />
              </div>

              <div className="flex gap-2 pt-0.5">
                <Button 
                  onClick={handleDownloadCard} 
                  className="flex-1" 
                  size="sm"
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
                  className="flex-1" 
                  size="sm"
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
