import React from 'react';
import { BookOpen, Search, Lightbulb, Target, Star, MessageCircle, Dumbbell, FileText, LucideIcon } from 'lucide-react';
import { extractKeywords, parseInsightsWithQuotes } from './utils';
import { KeywordTagCloud, TagVariant } from './KeywordTagCloud';
import { QuoteBlock } from './QuoteBlock';

type SectionType = 'themes' | 'observations' | 'insights' | 'applications'
  | 'topic' | 'theology' | 'highlights' | 'divergence' | 'soulGym' | 'summary';

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
    bgClass: 'bg-gradient-to-r from-green-50/70 to-green-50/20 dark:from-green-950/30 dark:to-green-950/10 border-green-500',
    textClass: 'text-green-700 dark:text-green-400',
  },
  observations: {
    icon: Search,
    emoji: '🔍',
    title: '事實發現 Observations',
    bgClass: 'bg-gradient-to-r from-teal-50/70 to-teal-50/20 dark:from-teal-950/30 dark:to-teal-950/10 border-teal-500',
    textClass: 'text-teal-700 dark:text-teal-400',
  },
  insights: {
    icon: Lightbulb,
    emoji: '💡',
    title: '獨特亮光 Unique Insights',
    bgClass: 'bg-gradient-to-r from-yellow-50/70 to-yellow-50/20 dark:from-yellow-950/30 dark:to-yellow-950/10 border-yellow-500',
    textClass: 'text-yellow-700 dark:text-yellow-400',
  },
  applications: {
    icon: Target,
    emoji: '🎯',
    title: '如何應用 Applications',
    bgClass: 'bg-gradient-to-r from-blue-50/70 to-blue-50/20 dark:from-blue-950/30 dark:to-blue-950/10 border-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  topic: {
    icon: BookOpen,
    emoji: '📖',
    title: '本次查經主題 Topic',
    bgClass: 'bg-gradient-to-r from-green-50/70 to-green-50/20 dark:from-green-950/30 dark:to-green-950/10 border-green-500',
    textClass: 'text-green-700 dark:text-green-400',
  },
  theology: {
    icon: Lightbulb,
    emoji: '💡',
    title: '神學亮光 Theology',
    bgClass: 'bg-gradient-to-r from-yellow-50/70 to-yellow-50/20 dark:from-yellow-950/30 dark:to-yellow-950/10 border-yellow-500',
    textClass: 'text-yellow-700 dark:text-yellow-400',
  },
  highlights: {
    icon: Star,
    emoji: '⭐',
    title: '亮光語錄 Highlights',
    bgClass: 'bg-gradient-to-r from-amber-50/70 to-amber-50/20 dark:from-amber-950/30 dark:to-amber-950/10 border-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  divergence: {
    icon: MessageCircle,
    emoji: '🔀',
    title: '觀點分歧 Divergence',
    bgClass: 'bg-gradient-to-r from-orange-50/70 to-orange-50/20 dark:from-orange-950/30 dark:to-orange-950/10 border-orange-500',
    textClass: 'text-orange-700 dark:text-orange-400',
  },
  soulGym: {
    icon: Dumbbell,
    emoji: '🏋️',
    title: 'SoulGym 微操練',
    bgClass: 'bg-gradient-to-r from-purple-50/70 to-purple-50/20 dark:from-purple-950/30 dark:to-purple-950/10 border-purple-500',
    textClass: 'text-purple-700 dark:text-purple-400',
  },
  summary: {
    icon: FileText,
    emoji: '📝',
    title: '一句話總結 Summary',
    bgClass: 'bg-gradient-to-r from-indigo-50/70 to-indigo-50/20 dark:from-indigo-950/30 dark:to-indigo-950/10 border-indigo-500',
    textClass: 'text-indigo-700 dark:text-indigo-400',
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
  const quotes = (type === 'insights' || type === 'highlights') && showQuotes ? parseInsightsWithQuotes(content) : [];
  
  // Format content with highlighted names and better structure
  const formatContent = (text: string): React.ReactNode => {
    // Clean markdown formatting
    let cleaned = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/^\s*\*\s+/gm, '• ')
      .replace(/^\s*-\s+/gm, '• ');
    
    // Highlight names (弟兄/姊妹/姐妹 patterns) - use non-global for testing
    const namePattern = /([^\s，。、：:]+(?:弟兄|姊妹|姐妹|同學|老師))/g;
    const nameTestPattern = /^[^\s，。、：:]+(?:弟兄|姊妹|姐妹|同學|老師)$/;
    const parts = cleaned.split(namePattern);
    
    return parts.map((part, idx) => {
      if (nameTestPattern.test(part)) {
        return (
          <span key={idx} className="font-semibold text-primary">
            {part}
          </span>
        );
      }
      return part;
    });
  };
  
  return (
    <div className={`p-3 sm:p-5 border-l-4 rounded-r-lg shadow-sm ${config.bgClass}`}>
      <h3 className={`flex items-center gap-2 font-bold text-sm sm:text-base mb-3 sm:mb-4 ${config.textClass}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">{config.emoji} {config.title}</span>
        <span className="sm:hidden">{config.emoji} {config.title.split(' ')[0]}</span>
      </h3>
      
      {/* Keyword tag cloud - only show if we have keywords */}
      {keywords.length > 0 && (
        <KeywordTagCloud keywords={keywords} variant={type as TagVariant} />
      )}
      
      {/* For insights, show quote blocks for all items */}
      {(type === 'insights' || type === 'highlights') && quotes.length > 0 ? (
        <div className="space-y-2 sm:space-y-3">
          {quotes.map((q, idx) => (
            <QuoteBlock key={`quote-${idx}`} quote={q.quote.replace(/\*\*/g, '')} author={q.author} />
          ))}
        </div>
      ) : (
        <div className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-6 sm:leading-7 pl-1">
          {formatContent(content)}
        </div>
      )}
    </div>
  );
};
