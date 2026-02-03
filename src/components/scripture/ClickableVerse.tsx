import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Image, Check, MoreHorizontal } from 'lucide-react';
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
    setShowActions(false);
  };

  const handleCreateCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCardCreator(true);
    setShowActions(false);
  };

  const handleClick = () => {
    setShowActions(!showActions);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative cursor-pointer transition-all ${showActions ? 'ring-2 ring-primary/30 rounded-lg' : ''} ${className}`}
        onClick={handleClick}
        data-testid="clickable-verse"
      >
        <div className="select-text">
          <p className="text-sm text-foreground leading-relaxed">{text}</p>
          <p className="text-xs text-primary mt-1.5 font-medium">{reference}</p>
        </div>

        {showActions && (
          <div 
            className="absolute left-0 right-0 -bottom-1 translate-y-full z-50 animate-in fade-in slide-in-from-top-1 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-1.5 w-fit">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5"
                onClick={handleCopy}
                data-testid="button-verse-copy"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-xs">複製</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5"
                onClick={handleShare}
                data-testid="button-verse-share"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="text-xs">分享</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5"
                onClick={handleCreateCard}
                data-testid="button-verse-card"
              >
                <Image className="w-3.5 h-3.5" />
                <span className="text-xs">圖卡</span>
              </Button>
            </div>
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
