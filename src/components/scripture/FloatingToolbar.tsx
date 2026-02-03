import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Image, Check, X } from 'lucide-react';

interface FloatingToolbarProps {
  visible: boolean;
  getAnchorRect: () => DOMRect | null;
  onCopy: () => void;
  onShare: () => void;
  onCreateCard: () => void;
  onClear: () => void;
  selectedCount: number;
  copied: boolean;
}

export const FloatingToolbar = ({
  visible,
  getAnchorRect,
  onCopy,
  onShare,
  onCreateCard,
  onClear,
  selectedCount,
  copied,
}: FloatingToolbarProps) => {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!visible || !mounted) return null;

  const toolbarContent = isMobile ? (
    <div
      ref={toolbarRef}
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-background border-t border-border shadow-lg p-2 pb-safe animate-in slide-in-from-bottom duration-200"
      data-testid="floating-toolbar"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          已選 {selectedCount} 節
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5"
          onClick={onCopy}
          data-testid="button-toolbar-copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="text-xs">複製</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5"
          onClick={onShare}
          data-testid="button-toolbar-share"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="text-xs">分享</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5"
          onClick={onCreateCard}
          data-testid="button-toolbar-card"
        >
          <Image className="w-3.5 h-3.5" />
          <span className="text-xs">圖卡</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClear}
          data-testid="button-toolbar-clear"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  ) : (
    <DesktopToolbar
      getAnchorRect={getAnchorRect}
      selectedCount={selectedCount}
      onCopy={onCopy}
      onShare={onShare}
      onCreateCard={onCreateCard}
      onClear={onClear}
      copied={copied}
    />
  );

  return createPortal(toolbarContent, document.body);
};

const DesktopToolbar = ({
  getAnchorRect,
  selectedCount,
  onCopy,
  onShare,
  onCreateCard,
  onClear,
  copied,
}: Omit<FloatingToolbarProps, 'visible'>) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const rafRef = useRef<number>();

  const updatePosition = useCallback(() => {
    const anchorRect = getAnchorRect();
    if (!anchorRect) return;

    const toolbarHeight = 44;
    const toolbarWidth = 280;
    const padding = 8;
    
    let top = anchorRect.top - toolbarHeight - padding;
    let left = anchorRect.left + (anchorRect.width / 2) - (toolbarWidth / 2);

    if (top < padding) {
      top = anchorRect.bottom + padding;
    }

    if (left < padding) left = padding;
    if (left + toolbarWidth > window.innerWidth - padding) {
      left = window.innerWidth - toolbarWidth - padding;
    }

    setPosition({ top, left });
  }, [getAnchorRect]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updatePosition]);

  return (
    <div
      className="fixed z-[9999] bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
      }}
      data-testid="floating-toolbar"
    >
      <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
        已選 {selectedCount} 節
      </span>
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-1"
        onClick={onCopy}
        data-testid="button-toolbar-copy"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        <span className="text-xs">複製</span>
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-1"
        onClick={onShare}
        data-testid="button-toolbar-share"
      >
        <Share2 className="w-3 h-3" />
        <span className="text-xs">分享</span>
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-1"
        onClick={onCreateCard}
        data-testid="button-toolbar-card"
      >
        <Image className="w-3 h-3" />
        <span className="text-xs">圖卡</span>
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        onClick={onClear}
        data-testid="button-toolbar-clear"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default FloatingToolbar;
