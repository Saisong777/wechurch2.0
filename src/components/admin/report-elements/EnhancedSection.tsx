import React from 'react';
import { BookOpen, Search, Lightbulb, Target, LucideIcon } from 'lucide-react';
import { extractKeywords, parseInsightsWithQuotes } from './utils';
import { KeywordTagCloud, TagVariant } from './KeywordTagCloud';
import { QuoteBlock } from './QuoteBlock';

type SectionType = 'themes' | 'observations' | 'insights' | 'applications';

interface SectionConfig {
  icon: LucideIcon;
  emoji: string;
  title: string;
  bgClass: string;
  textClass: string;
}

const sectionConfig: Record<SectionType, SectionConfig> = {
  themes: {
    icon: BookOpen,
    emoji: '📖',
    title: '主題 Themes',
    bgClass: 'bg-green-50/50 dark:bg-green-950/20 border-green-500',
    textClass: 'text-green-700 dark:text-green-400',
  },
  observations: {
    icon: Search,
    emoji: '🔍',
    title: '事實發現 Observations',
    bgClass: 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500',
    textClass: 'text-teal-700 dark:text-teal-400',
  },
  insights: {
    icon: Lightbulb,
    emoji: '💡',
    title: '獨特亮光 Unique Insights',
    bgClass: 'bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-500',
    textClass: 'text-yellow-700 dark:text-yellow-400',
  },
  applications: {
    icon: Target,
    emoji: '🎯',
    title: '如何應用 Applications',
    bgClass: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
};

interface EnhancedSectionProps {
  type: SectionType;
  content: string;
  showKeywords?: boolean;
  showQuotes?: boolean;
}

export const EnhancedSection: React.FC<EnhancedSectionProps> = ({
  type,
  content,
  showKeywords = true,
  showQuotes = true,
}) => {
  const config = sectionConfig[type];
  const Icon = config.icon;
  
  const keywords = showKeywords ? extractKeywords(content) : [];
  const quotes = type === 'insights' && showQuotes ? parseInsightsWithQuotes(content) : [];
  
  // Clean markdown formatting from content
  const cleanContent = content
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
    .replace(/^\s*\*\s+/gm, '• ')        // Replace * at line start with bullet
    .replace(/^\s*-\s+/gm, '• ');        // Replace - at line start with bullet
  
  return (
    <div className={`p-5 border-l-4 rounded-r-lg ${config.bgClass}`}>
      <h3 className={`flex items-center gap-2 font-semibold mb-3 ${config.textClass}`}>
        <Icon className="w-5 h-5" />
        {config.emoji} {config.title}
      </h3>
      
      {/* Keyword tag cloud - only show if we have keywords */}
      {keywords.length > 0 && (
        <KeywordTagCloud keywords={keywords} variant={type as TagVariant} />
      )}
      
      {/* For insights, show quote blocks for all items */}
      {type === 'insights' && quotes.length > 0 ? (
        <div className="space-y-2">
          {quotes.map((q, idx) => (
            <QuoteBlock key={`quote-${idx}`} quote={q.quote.replace(/\*\*/g, '')} author={q.author} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1">
          {cleanContent}
        </div>
      )}
    </div>
  );
};
