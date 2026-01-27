import React from 'react';

// Format markdown text - remove ** and replace with styled spans
export function formatMarkdownText(text: string): React.ReactNode[] {
  if (!text) return [text];
  
  const parts: React.ReactNode[] = [];
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
      React.createElement('span', {
        key: `bold-${keyIndex++}`,
        className: 'font-semibold text-foreground'
      }, match[1])
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

// Common stop words to filter out for keyword extraction
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

// Keywords and phrases to look for in spiritual content
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

// Extract keywords from text for tag cloud - deduplicated
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  
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
  
  // If no attributed quotes found, split by bullet points or newlines and show ALL as quotes
  if (quotes.length === 0) {
    const lines = text.split(/[\n•\-\*]/).filter(l => l.trim().length > 10);
    for (const line of lines) {
      quotes.push({ quote: line.trim() });
    }
  }
  
  // Return ALL quotes - no limit
  return quotes;
}

// Extract action items from application text
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
