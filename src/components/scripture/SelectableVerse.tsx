import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SelectableVerseProps {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  className?: string;
}

export const SelectableVerse = ({ bookName, chapter, verse, text, className = '' }: SelectableVerseProps) => {
  const [isSelected, setIsSelected] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fullReference = `${bookName} ${chapter}:${verse}`;
  const fullText = `${text}\n— ${fullReference}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast({ title: '已複製', description: fullReference });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: '複製失敗', variant: 'destructive' });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: fullReference,
          text: fullText,
        });
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

  return (
    <div 
      className={`group relative cursor-pointer select-text ${isSelected ? 'bg-primary/10 rounded' : ''} ${className}`}
      onClick={() => setIsSelected(!isSelected)}
      data-testid={`verse-${chapter}-${verse}`}
    >
      <p className="text-sm leading-relaxed pr-16">
        <span className="text-primary font-medium mr-2">{verse}</span>
        {text}
      </p>
      
      <div className={`absolute right-0 top-0 flex gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={handleCopy}
          data-testid={`button-copy-verse-${chapter}-${verse}`}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={handleShare}
          data-testid={`button-share-verse-${chapter}-${verse}`}
        >
          <Share2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default SelectableVerse;
