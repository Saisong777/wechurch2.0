import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const updatePosition = useCallback(() => {
    if (!visible) return;
    
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
  }, [visible, getAnchorRect]);

  useEffect(() => {
    if (!visible) return;

    const handleScrollOrResize = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible, updatePosition]);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[1000] bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150"
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
        className="h-7 px-2 gap-1"
        onClick={onCopy}
        data-testid="button-toolbar-copy"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        <span className="text-xs">複製</span>
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 px-2 gap-1"
        onClick={onShare}
        data-testid="button-toolbar-share"
      >
        <Share2 className="w-3 h-3" />
        <span className="text-xs">分享</span>
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 px-2 gap-1"
        onClick={onCreateCard}
        data-testid="button-toolbar-card"
      >
        <Image className="w-3 h-3" />
        <span className="text-xs">圖卡</span>
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-7 w-7"
        onClick={onClear}
        data-testid="button-toolbar-clear"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default FloatingToolbar;
