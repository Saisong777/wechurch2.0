import React from 'react';
import { Quote, User } from 'lucide-react';

interface QuoteBlockProps {
  quote: string;
  author?: string;
}

export const QuoteBlock: React.FC<QuoteBlockProps> = ({ quote, author }) => {
  return (
    <div className="relative pl-5 py-3 my-2 border-l-3 border-yellow-400 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-950/20 dark:to-transparent rounded-r-lg shadow-sm">
      <Quote className="absolute -left-2.5 top-2 w-5 h-5 text-yellow-500 bg-background rounded-full p-0.5 shadow-sm" />
      <p className="text-sm text-foreground/90 leading-relaxed pl-1">
        {quote}
      </p>
      {author && (
        <p className="text-xs mt-2 flex items-center gap-1.5 pl-1">
          <User className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-primary">{author}</span>
        </p>
      )}
    </div>
  );
};
