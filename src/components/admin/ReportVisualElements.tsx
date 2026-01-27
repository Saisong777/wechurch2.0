import React from 'react';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, Lightbulb, Target, Quote, User, Star, Circle } from 'lucide-react';

// Format markdown text - remove ** and replace with styled spans
export function formatMarkdownText(text: string): React.ReactNode[] {
  if (!text) return [text];
  
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;
  
  // Pattern for **bold** text
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = boldPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the bold text as a styled span
    parts.push(
      <span key={`bold-${keyIndex++}`} className="font-semibold text-foreground">
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

// Extract keywords from text for tag cloud - deduplicated
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  // Common stop words to filter out
  const stopWords = new Set([
    '的', '是', '在', '了', '和', '與', '有', '這', '那', '也', '就', '都', '而', '及', '但', '或',
    '被', '把', '讓', '將', '要', '會', '能', '可', '以', '為', '對', '於', '到', '從', '不', '很',
    '更', '最', '所', '個', '他', '她', '它', '們', '我', '你', '自己', '什麼', '如何', '怎樣',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which',
    'that', 'this', 'these', 'those', 'it', 'its', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
    'with', 'about', 'as', 'from', 'into', 'through', 'during', 'before', 'after', 'above',
  ]);
  
  // Keywords and phrases to look for
  const importantPatterns = [
    /神(?:的[愛恩典榮耀旨意國度])?/g,
    /耶穌(?:基督)?/g,
    /聖靈/g,
    /信心|信仰/g,
    /盼望|希望/g,
    /愛心|慈愛|愛/g,
    /救恩|拯救|救贖/g,
    /恩典/g,
    /饒恕|原諒/g,
    /悔改/g,
    /禱告|祈禱/g,
    /順服|服從/g,
    /謙卑/g,
    /聖潔/g,
    /公義|正義/g,
    /平安|和平/g,
    /喜樂|快樂/g,
    /永生|生命/g,
    /福音/g,
    /十字架/g,
    /復活/g,
    /天國|神國/g,
  ];
  
  // Use Map to track keywords and avoid duplicates
  const foundKeywords = new Map<string, boolean>();
  
  // Find important patterns
  for (const pattern of importantPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => {
        // Normalize and dedupe
        const normalized = m.trim();
        if (!foundKeywords.has(normalized)) {
          foundKeywords.set(normalized, true);
        }
      });
    }
  }
  
  // Extract Chinese phrases (2-4 characters that appear meaningful)
  const chinesePhrases = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  for (const phrase of chinesePhrases) {
    if (!stopWords.has(phrase) && phrase.length >= 2 && !foundKeywords.has(phrase)) {
      // Only add if it seems meaningful (not too common)
      if (foundKeywords.size < 6) {
        foundKeywords.set(phrase, true);
      }
    }
  }
  
  return Array.from(foundKeywords.keys()).slice(0, 6);
}

// Parse insights to extract quoted attributions (e.g., "王弟兄提到...")
export function parseInsightsWithQuotes(text: string): { quote: string; author?: string }[] {
  if (!text) return [];
  
  const quotes: { quote: string; author?: string }[] = [];
  
  // Pattern: Name + 提到/分享/說/認為 + content
  const attributionPattern = /([^\n。，]+?(?:弟兄|姊妹|姐妹|同學|老師))(?:提到|分享|說|認為|指出|表示)[：:「「]?\s*([^」」\n]+)/g;
  
  let match;
  while ((match = attributionPattern.exec(text)) !== null) {
    quotes.push({
      author: match[1].trim(),
      quote: match[2].trim(),
    });
  }
  
  // If no attributed quotes found, split by bullet points or newlines
  if (quotes.length === 0) {
    const lines = text.split(/[\n•\-\*]/).filter(l => l.trim().length > 10);
    for (const line of lines.slice(0, 3)) {
      quotes.push({ quote: line.trim() });
    }
  }
  
  return quotes.slice(0, 4);
}

// Keyword tag cloud component
interface KeywordTagCloudProps {
  keywords: string[];
  variant?: 'themes' | 'observations' | 'insights' | 'applications';
}

const variantColors = {
  themes: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200',
  observations: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 hover:bg-teal-200',
  insights: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 hover:bg-yellow-200',
  applications: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200',
};

export const KeywordTagCloud: React.FC<KeywordTagCloudProps> = ({ keywords, variant = 'themes' }) => {
  if (keywords.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {keywords.map((keyword, index) => (
        <span
          key={index}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${variantColors[variant]}`}
        >
          {keyword}
        </span>
      ))}
    </div>
  );
};

// Quote block component for insights
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

// Enhanced section renderer with visual elements
interface EnhancedSectionProps {
  type: 'themes' | 'observations' | 'insights' | 'applications';
  content: string;
  showKeywords?: boolean;
  showQuotes?: boolean;
}

const sectionConfig = {
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
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/^\s*[\*\-•]\s+/gm, '• ');
  
  return (
    <div className={`p-5 border-l-4 rounded-r-lg ${config.bgClass}`}>
      <h3 className={`flex items-center gap-2 font-semibold mb-3 ${config.textClass}`}>
        <Icon className="w-5 h-5" />
        {config.emoji} {config.title}
      </h3>
      
      {/* Keyword tag cloud - only show if we have keywords */}
      {keywords.length > 0 && (
        <KeywordTagCloud keywords={keywords} variant={type} />
      )}
      
      {/* For insights, show quote blocks if available */}
      {type === 'insights' && quotes.length > 0 ? (
        <div className="space-y-2">
          {quotes.map((q, idx) => (
            <QuoteBlock key={`quote-${idx}`} quote={q.quote.replace(/\*\*/g, '')} author={q.author} />
          ))}
          {/* Show remaining content not captured in quotes */}
          {(() => {
            const remainingLines = cleanContent.split(/\n/).filter(line => 
              !quotes.some(q => line.includes(q.quote.substring(0, 20)))
            ).join('\n').trim();
            return remainingLines ? (
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1 mt-3">
                {remainingLines}
              </div>
            ) : null;
          })()}
        </div>
      ) : (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1">
          {cleanContent}
        </div>
      )}
    </div>
  );
};

// Application action items extractor
export function extractActionItems(text: string): string[] {
  if (!text) return [];
  
  const items: string[] = [];
  
  // Split by common list patterns
  const lines = text.split(/[\n•\-\*\d+\.]+/).filter(l => l.trim().length > 5);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100) {
      items.push(trimmed);
    }
  }
  
  return items.slice(0, 5);
}

// Action item component with checkbox style
interface ActionItemListProps {
  items: string[];
}

export const ActionItemList: React.FC<ActionItemListProps> = ({ items }) => {
  if (items.length === 0) return null;
  
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, index) => (
        <div 
          key={index}
          className="flex items-start gap-3 p-2 rounded-lg bg-blue-100/30 dark:bg-blue-900/20"
        >
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex-shrink-0 mt-0.5 flex items-center justify-center">
            <span className="text-xs text-blue-600 font-bold">{index + 1}</span>
          </div>
          <p className="text-sm text-foreground">{item}</p>
        </div>
      ))}
    </div>
  );
};
