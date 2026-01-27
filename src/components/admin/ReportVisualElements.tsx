// Re-export from refactored module for backward compatibility
// This file can be removed once all imports are updated to use report-elements directly

export { 
  formatMarkdownText, 
  extractKeywords, 
  parseInsightsWithQuotes, 
  extractActionItems,
  KeywordTagCloud,
  QuoteBlock,
  EnhancedSection,
  ActionItemList,
} from './report-elements';

export type { TagVariant } from './report-elements';
