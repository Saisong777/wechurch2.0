// Report parsing utilities for AI report viewer

export interface GroupReport {
  groupNumber: number;
  groupInfo?: string;
  members?: string;
  verse?: string;
  contributions?: string;  // Personal contributions summary
  themes?: string;
  observations?: string;
  insights?: string;
  applications?: string;
  raw: string;
}

// Chinese numeral to Arabic number conversion
const CHINESE_NUMERALS: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
};

function parseChineseNumeral(str: string): number | null {
  // Direct lookup
  if (CHINESE_NUMERALS[str]) return CHINESE_NUMERALS[str];
  
  // Handle compound numerals like 二十一 = 21
  if (str.startsWith('二十') && str.length === 3) {
    const ones = CHINESE_NUMERALS[str[2]];
    if (ones) return 20 + ones;
  }
  if (str.startsWith('十') && str.length === 2) {
    const ones = CHINESE_NUMERALS[str[1]];
    if (ones) return 10 + ones;
  }
  
  return null;
}

// Clean markdown formatting - remove ** and handle list items
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
    .replace(/^\s*\*\s+/gm, '• ')        // Replace * at line start with bullet
    .replace(/^\s*-\s+/gm, '• ')         // Replace - at line start with bullet
    .trim();
}

// Score a section to determine quality (for deduplication)
function getScore(s: Partial<GroupReport>): number {
  const len = (v?: string) => (v ? v.trim().length : 0);
  // Prefer structured sections heavily; raw-only headers will score low.
  // Also penalize very short raw content (likely just headers)
  const rawLen = len(s.raw);
  const rawScore = rawLen < 100 ? rawLen * 0.5 : Math.min(rawLen, 400);
  
  return (
    len(s.contributions) * 2 +
    len(s.themes) * 2 +
    len(s.observations) * 2 +
    len(s.insights) * 2 +
    len(s.applications) * 2 +
    rawScore +
    (s.members ? 100 : 0) +
    (s.verse ? 50 : 0)
  );
}

// Parse report content into structured sections
export function parseReportContent(content: string): GroupReport[] {
  const sections: GroupReport[] = [];
  const groupIndex = new Map<number, number>();

  // Split by group separators if multiple groups
  const groupReports = content.split(/={40,}/);
  
  for (const groupReport of groupReports) {
    if (!groupReport.trim()) continue;
    
    const section: Partial<GroupReport> = {};
    
    // Extract group number - support multiple formats
    // Pattern 1: 第 N 組 or 第N組報告 (with Arabic numeral)
    const arabicMatch = groupReport.match(/第\s*(\d+)\s*組(?:報告)?/);
    // Pattern 2: 第N組 (with Chinese numeral like 第一組, 第二組)
    const chineseMatch = groupReport.match(/第([一二三四五六七八九十]+)組(?:報告)?/);
    // Pattern 3: **組別：** 第一組 or **組別：** 第 1 組 format
    const labelArabicMatch = groupReport.match(/組別[：:]\s*(?:\*\*)?\s*第\s*(\d+)\s*組/);
    const labelChineseMatch = groupReport.match(/組別[：:]\s*(?:\*\*)?\s*第([一二三四五六七八九十]+)組/);
    
    if (arabicMatch) {
      const groupNum = parseInt(arabicMatch[1], 10);
      section.groupNumber = groupNum;
      section.groupInfo = `第 ${groupNum} 組`;
    } else if (chineseMatch) {
      const groupNum = parseChineseNumeral(chineseMatch[1]);
      if (groupNum) {
        section.groupNumber = groupNum;
        section.groupInfo = `第 ${groupNum} 組`;
      }
    } else if (labelArabicMatch) {
      const groupNum = parseInt(labelArabicMatch[1], 10);
      section.groupNumber = groupNum;
      section.groupInfo = `第 ${groupNum} 組`;
    } else if (labelChineseMatch) {
      const groupNum = parseChineseNumeral(labelChineseMatch[1]);
      if (groupNum) {
        section.groupNumber = groupNum;
        section.groupInfo = `第 ${groupNum} 組`;
      }
    }
    
    // Extract members - handle bold syntax in value
    const membersMatch = groupReport.match(/(?:\*\*)?組員(?:\*\*)?[：:]\s*(?:\*\*)?\s*([^\n]+)/);
    if (membersMatch) {
      section.members = cleanMarkdown(membersMatch[1]);
    }
    
    // Extract verse - handle bold syntax in value
    const verseMatch = groupReport.match(/(?:\*\*)?查經經文(?:\*\*)?[：:]\s*(?:\*\*)?\s*([^\n]+)/);
    if (verseMatch) {
      section.verse = cleanMarkdown(verseMatch[1]);
    }
    
    // Extract themes - handle formats like "**📖 主題（Themes）：**" or "📖 主題：" (with or without English description)
    const themesMatch = groupReport.match(/(?:\*\*)?📖?\s*主題[^：:\n]*?[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?[🔍💡🎯👤]|---|\n\*\*[🔍💡🎯👤]|$)/i);
    if (themesMatch) {
      section.themes = cleanMarkdown(themesMatch[1]);
    }
    
    // Extract observations - handle formats like "**🔍 事實發現（Observations）：**" or "**🔍 事實發現：**"
    const obsMatch = groupReport.match(/(?:\*\*)?🔍?\s*事實發現[^：:\n]*?[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?[💡🎯👤]|---|\n\*\*[💡🎯👤]|$)/i);
    if (obsMatch) {
      section.observations = cleanMarkdown(obsMatch[1]);
    }
    
    // Extract insights - handle formats like "**💡 獨特亮光（Unique Insights）：**" or "**💡 獨特亮光：**"
    const insightsMatch = groupReport.match(/(?:\*\*)?💡?\s*獨特亮光[^：:\n]*?[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?[🎯👤]|---|\n\*\*[🎯👤]|$)/i);
    if (insightsMatch) {
      section.insights = cleanMarkdown(insightsMatch[1]);
    }
    
    // Extract applications - handle formats like "**🎯 如何應用（Applications）：**" or "**🎯 如何應用：**"
    const appMatch = groupReport.match(/(?:\*\*)?🎯?\s*(?:如何)?應用[^：:\n]*?[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:\*\*)?👤|---|\n\*\*👤|$)/i);
    if (appMatch) {
      section.applications = cleanMarkdown(appMatch[1]);
    }
    
    // Extract personal contributions (at the end) - handle formats like "**👤 個人貢獻摘要（Personal Contributions）：**"
    const contribMatch = groupReport.match(/(?:\*\*)?👤?\s*個人貢獻[^：:\n]*[：:]\s*(?:\*\*)?\s*([\s\S]*?)(?=---|$)/i);
    if (contribMatch) {
      section.contributions = cleanMarkdown(contribMatch[1]);
    }
    
    // Store raw content as fallback - also cleaned
    section.raw = cleanMarkdown(groupReport);

    // Only add sections that have meaningful content
    const sectionScore = getScore(section);
    
    if (section.groupNumber && section.groupNumber > 0) {
      const idx = groupIndex.get(section.groupNumber);
      if (idx === undefined) {
        // Only add if it has meaningful content (not just a header)
        if (sectionScore > 50) {
          groupIndex.set(section.groupNumber, sections.length);
          sections.push(section as GroupReport);
        }
      } else {
        const existing = sections[idx];
        if (sectionScore > getScore(existing)) {
          sections[idx] = section as GroupReport;
        }
      }
    } else if (section.raw && section.raw.length > 100 && sectionScore > 50) {
      // For overall reports or ungrouped content - only if substantial
      sections.push({ groupNumber: 0, raw: section.raw, ...section });
    }
  }
  
  return sections.length > 0 ? sections : [{ groupNumber: 0, raw: cleanMarkdown(content) }];
}
