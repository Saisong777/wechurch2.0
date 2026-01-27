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
    
    // Check for overall/synthesis report first
    // Pattern: "全會眾綜合分析" or "全體" or "第 0 組" (overall marker)
    const overallMatch = groupReport.match(/全會眾(?:綜合)?分析|全體(?:整合)?報告|第\s*0\s*組/i);
    
    if (overallMatch) {
      section.groupNumber = 0;
      section.groupInfo = '📊 全會眾綜合分析';
    } else {
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
    
    // Helper function to extract section content by looking for next section header
    const extractSectionContent = (
      text: string, 
      startPattern: RegExp, 
      endMarkers: string[]
    ): string | null => {
      const startMatch = text.match(startPattern);
      if (!startMatch) return null;
      
      const startIdx = startMatch.index! + startMatch[0].length;
      let endIdx = text.length;
      
      // Find the earliest next section marker
      // Section headers must start at the beginning of a line (after newline)
      // and be formatted as **emoji** or emoji at line start
      for (const marker of endMarkers) {
        // Create patterns for section headers that:
        // 1. Start at beginning of line (after \n)
        // 2. Have the marker at line start, not as part of list content
        const emojiChar = marker.replace(/\*\*/g, '');
        // Match: newline followed by optional ** and the emoji
        const headerPattern = new RegExp(`\\n\\*{0,2}${emojiChar}[^\\n]*[：:]`, 'i');
        const markerMatch = text.slice(startIdx).match(headerPattern);
        if (markerMatch && markerMatch.index !== undefined) {
          // +1 to not include the newline in the content
          const absoluteIdx = startIdx + markerMatch.index + 1;
          if (absoluteIdx < endIdx) {
            endIdx = absoluteIdx;
          }
        }
      }
      
      // Also look for "---" separator on its own line
      const dashMatch = text.slice(startIdx).match(/\n---(?:\n|$)/);
      if (dashMatch && dashMatch.index !== undefined) {
        const absoluteDashIdx = startIdx + dashMatch.index;
        if (absoluteDashIdx < endIdx) {
          endIdx = absoluteDashIdx;
        }
      }
      
      return text.slice(startIdx, endIdx).trim();
    };
    
    // Section markers to look for (order matters for proper boundary detection)
    const SECTION_MARKERS = ['**📖', '📖', '**🔍', '🔍', '**💡', '💡', '**🎯', '🎯', '**👤', '👤'];
    
    // Extract themes - handle various formats:
    // **📖 主題（Themes）：** or **📖 主題：** or 📖 主題： or 主題（Themes）：
    const themesContent = extractSectionContent(
      groupReport,
      /\*{0,2}📖?\s*主題(?:（Themes）)?[：:\s]*\*{0,2}\s*/i,
      ['**🔍', '🔍', '**💡', '💡', '**🎯', '🎯', '**👤', '👤']
    );
    if (themesContent) {
      section.themes = cleanMarkdown(themesContent);
    }
    
    // Extract observations - handle various formats:
    // **🔍 事實發現（Observations）：** or **🔍 事實發現：** or 事實發現：
    const obsContent = extractSectionContent(
      groupReport,
      /\*{0,2}🔍?\s*事實發現(?:（Observations）)?[：:\s]*\*{0,2}\s*/i,
      ['**💡', '💡', '**🎯', '🎯', '**👤', '👤']
    );
    if (obsContent) {
      section.observations = cleanMarkdown(obsContent);
    }
    
    // Extract insights (獨特亮光) - handle various formats:
    // **💡 獨特亮光（Unique Insights）：** or **💡 獨特亮光：** or 獨特亮光：
    const insightsContent = extractSectionContent(
      groupReport,
      /\*{0,2}💡\s*獨特亮光[^*\n]*\*{0,2}\s*/i,
      ['**🎯', '🎯', '**👤', '👤']
    );
    if (insightsContent) {
      section.insights = cleanMarkdown(insightsContent);
    }
    
    // Extract applications - handle various formats:
    // **🎯 如何應用（Applications）：** or **🎯 應用：** or 如何應用：
    const appContent = extractSectionContent(
      groupReport,
      /\*{0,2}🎯?\s*(?:如何)?應用(?:（Applications）)?[：:\s]*\*{0,2}\s*/i,
      ['**👤', '👤']
    );
    if (appContent) {
      section.applications = cleanMarkdown(appContent);
    }
    
    // Extract personal contributions (at the end) - handle **👤 個人貢獻摘要：** format
    const contribContent = extractSectionContent(
      groupReport,
      /\*{0,2}👤\s*個人貢獻[^：:\n]*[：:\s]*\*{0,2}\s*/i,
      [] // Last section, no end markers
    );
    if (contribContent) {
      section.contributions = cleanMarkdown(contribContent);
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
