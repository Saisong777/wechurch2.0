import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Image, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScriptureCardCreator } from './ScriptureCardCreator';

interface ClickableVerseProps {
  text: string;
  reference: string;
  className?: string;
}

export const ClickableVerse = ({ text, reference, className = '' }: ClickableVerseProps) => {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCardCreator, setShowCardCreator] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fullText = `${text}\n— ${reference}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast({ title: '已複製經文' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: '複製失敗', variant: 'destructive' });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: reference, text: fullText });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(fullText);
          toast({ title: '已複製到剪貼簿' });
        }
      }
    } else {
      await navigator.clipboard.writeText(fullText);
      toast({ title: '已複製到剪貼簿' });
    }
  };

  const handleCreateCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCardCreator(true);
    setShowActions(false);
  };

  const handleClick = () => {
    setShowActions(!showActions);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`cursor-pointer transition-all ${className}`}
        onClick={handleClick}
        data-testid="clickable-verse"
      >
        <div className="select-text">
          <p className="text-sm text-foreground leading-relaxed">{text}</p>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-primary font-medium">{reference}</p>
            {!showActions && (
              <p className="text-xs text-muted-foreground">點擊可複製分享</p>
            )}
          </div>
        </div>

        {showActions && (
          <div 
            className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCopy}
              data-testid="button-verse-copy"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">複製</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleShare}
              data-testid="button-verse-share"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-xs">分享</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCreateCard}
              data-testid="button-verse-card"
            >
              <Image className="w-3.5 h-3.5" />
              <span className="text-xs">圖卡</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={handleClose}
              data-testid="button-verse-close"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      <ScriptureCardCreator
        open={showCardCreator}
        onOpenChange={setShowCardCreator}
        verse={{ text, reference }}
      />
    </>
  );
};

export default ClickableVerse;
