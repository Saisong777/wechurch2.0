import React from 'react';
import { Quote, User } from 'lucide-react';

interface QuoteBlockProps {
  quote: string;
  author?: string;
}

export const QuoteBlock: React.FC<QuoteBlockProps> = ({ quote, author }) => {
  return (
    <div className="relative pl-4 py-2 my-2 border-l-2 border-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/10 rounded-r-lg">
      <Quote className="absolute -left-2 -top-1 w-4 h-4 text-yellow-500 bg-background rounded-full" />
      <p className="text-sm italic text-foreground/90 leading-relaxed">
        「{quote}」
      </p>
      {author && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <User className="w-3 h-3" />
          — {author}
        </p>
      )}
    </div>
  );
};
